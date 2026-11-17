"""Bounded execution contract. Alignment is an operator-supplied SAM adapter."""

from dataclasses import dataclass
import os
from pathlib import Path
import signal
import subprocess
import sys
from typing import Protocol

from pydantic import BaseModel, ConfigDict, Field

from app.core.config import Settings
from app.schemas.job import JobCreateRequest
from app.services.bowtie2_adapter import index_files


class PipelineUnavailable(ValueError):
    pass


class PipelineFailure(RuntimeError):
    pass


class PipelineTimeout(PipelineFailure):
    pass


def confined_file(root: Path, value: str | Path, *, relative: bool = False) -> Path:
    """Accept regular files beneath a configured root, never symlink components."""
    value = Path(value)
    if relative and (value.is_absolute() or ".." in value.parts):
        raise PipelineUnavailable("Invalid stored sample path.")
    root = root.absolute()
    candidate = value if value.is_absolute() else root / value
    if any(part in ("..",) for part in candidate.parts):
        raise PipelineUnavailable("Unsafe input path.")
    try:
        resolved = candidate.resolve(strict=True)
        resolved.relative_to(root.resolve(strict=True))
        if candidate.absolute() != resolved or not resolved.is_file():
            raise ValueError
    except (OSError, ValueError, RuntimeError):
        raise PipelineUnavailable("Input file is unavailable or outside its configured root.") from None
    return resolved


class ExecutionPlan(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    version: int = Field(default=1, ge=1, le=1)
    request: JobCreateRequest
    run_id: str = Field(pattern=r"^[a-f0-9]{32}$")
    reads: Path
    reference: Path
    outdir: Path
    alignment_strategy: str = Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$")
    alignment_adapter: Path | None = None
    # Optional additions preserve deserialization of stored version-1 Jobs.
    bowtie2: Path | None = None
    bowtie2_inspect: Path | None = None
    bowtie2_index_prefix: Path | None = None
    nextflow: Path | None = None
    fastp: Path | None = None
    samtools: Path | None = None
    bcftools: Path | None = None
    threads: int = Field(ge=1, le=64)
    timeout_seconds: float = Field(gt=0, allow_inf_nan=False)
    profile: str = Field(default="local", pattern=r"^local$")


def check_gate(settings: Settings, mode: str) -> None:
    if not settings.pipeline_enabled:
        raise PipelineUnavailable("Job execution is disabled by server configuration.")
    if mode == "synthetic" and not settings.pipeline_allow_synthetic:
        raise PipelineUnavailable("Synthetic execution is disabled by server configuration.")
    if mode == "nextflow" and (
        not settings.pipeline_alignment_strategy or not settings.pipeline_alignment_adapter
        or not settings.pipeline_nextflow_executable or not settings.pipeline_fastp_executable
        or not settings.pipeline_samtools_executable or not settings.pipeline_bcftools_executable
    ):
        raise PipelineUnavailable("Nextflow tools and an approved alignment adapter must be configured.")


def executable(value: Path | None) -> Path:
    if value is None:
        raise PipelineUnavailable("Executable is not configured.")
    try:
        path = value.resolve(strict=True)
        if not path.is_file() or not os.access(path, os.X_OK):
            raise ValueError
        # Nextflow embeds trusted executable paths in shell scripts. Keep the
        # operator contract narrow rather than accepting shell fragments.
        if any(c in str(path) for c in "\n\r\"'`$;|&<>\\"):
            raise ValueError
        return path
    except (OSError, ValueError):
        raise PipelineUnavailable("Configured executable is unavailable or unsafe.") from None


def validate_biological_plan(plan: ExecutionPlan) -> None:
    if plan.request.variant_ploidy not in (1, 2) or not 1 <= plan.threads <= 4:
        raise PipelineUnavailable("Nextflow requires ploidy 1 or 2 and at most four threads.")
    if plan.alignment_strategy == "bowtie2":
        if not plan.bowtie2_index_prefix or not plan.bowtie2 or not plan.bowtie2_inspect:
            raise PipelineUnavailable("Explicit Bowtie2 tools and index are required for this Job.")
        try:
            index_files(plan.bowtie2_index_prefix)
        except (ValueError, OSError):
            raise PipelineUnavailable("Bowtie2 index is incomplete or invalid.") from None


@dataclass(frozen=True)
class PipelineResult:
    vcf: Path
    qc: dict


class Executor(Protocol):
    def execute(self, plan: ExecutionPlan) -> PipelineResult: ...


class LocalExecutor:
    """Real subprocess path for synthetic smoke execution or configured Nextflow.

    No shell, inherited credentials, unbounded captured output, or automatic
    resume. Failed run directories are retained for operator review.
    """

    def execute(self, plan: ExecutionPlan) -> PipelineResult:
        if plan.request.execution_mode == "nextflow":
            validate_biological_plan(plan)
        plan.outdir.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        if plan.outdir.parent.resolve() != plan.outdir.parent.absolute():
            raise PipelineFailure("Unsafe output directory.")
        plan.outdir.mkdir(mode=0o700, exist_ok=False)
        if plan.request.execution_mode == "synthetic":
            command = [sys.executable, "-I", "-B", str(Path(__file__).with_name("synthetic_pipeline.py")),
                       str(plan.outdir / "result.vcf"), plan.request.vcf_sample,
                       str(plan.request.variant_ploidy)]
        else:
            params = {
                "reads": str(plan.reads), "reference": str(plan.reference),
                "outdir": str(plan.outdir), "sample_name": plan.request.vcf_sample,
                "alignment_strategy": plan.alignment_strategy,
                "alignment_adapter": str(plan.alignment_adapter), "fastp_executable": str(plan.fastp),
                "samtools_executable": str(plan.samtools), "bcftools_executable": str(plan.bcftools),
                "threads": plan.threads, "ploidy": plan.request.variant_ploidy,
                "minimum_qual": plan.request.parameter_qual, "minimum_dp": plan.request.parameter_dp,
                "bowtie2_executable": str(plan.bowtie2) if plan.bowtie2 else None,
                "bowtie2_inspect_executable": str(plan.bowtie2_inspect) if plan.bowtie2_inspect else None,
                "bowtie2_index_prefix": str(plan.bowtie2_index_prefix) if plan.bowtie2_index_prefix else None,
            }
            import json
            params_path = plan.outdir / "params.json"
            params_path.write_text(json.dumps(params), encoding="utf-8")
            workflow = Path(__file__).resolve().parents[2] / "pipeline" / "main.nf"
            command = [str(plan.nextflow), "run", str(workflow), "-profile", plan.profile,
                       "-params-file", str(params_path), "-work-dir", str(plan.outdir / "work"),
                       "-ansi-log", "false"]
        try:
            with subprocess.Popen(command, cwd=plan.outdir, env={
                "PATH": os.defpath, "NXF_OFFLINE": "true", "NXF_DISABLE_CHECK_LATEST": "true",
            }, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                start_new_session=os.name == "posix") as process:
                try:
                    code = process.wait(timeout=plan.timeout_seconds)
                except subprocess.TimeoutExpired:
                    try:
                        if os.name == "posix":
                            os.killpg(process.pid, signal.SIGKILL)
                        else:
                            process.kill()
                    except ProcessLookupError:
                        pass
                    process.wait()
                    raise PipelineTimeout("Workflow exceeded its execution timeout.") from None
            if code != 0:
                raise PipelineFailure("Workflow process failed.")
        except OSError:
            raise PipelineFailure("Workflow executable could not start.") from None
        vcf = confined_file(plan.outdir, "result.vcf")
        qc = {"synthetic": plan.request.execution_mode == "synthetic"}
        if plan.request.execution_mode == "nextflow":
            import json
            report = confined_file(plan.outdir, "fastp.json")
            if report.stat().st_size > 1_000_000:
                raise PipelineFailure("QC report exceeds its resource limit.")
            qc["fastp"] = json.loads(report.read_text())
        return PipelineResult(vcf, qc)
