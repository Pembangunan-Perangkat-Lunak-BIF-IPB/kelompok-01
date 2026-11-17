import os
from pathlib import Path
import subprocess
import sys
from unittest.mock import Mock

import pytest
from sqlalchemy import select

from app.models import Job
from app.services.jobs import create_job
from app.services.pipeline import ExecutionPlan, LocalExecutor, PipelineFailure, PipelineTimeout, executable


def plan(case):
    job = create_job(case.factory, case.settings, 1, case.request)
    with case.factory() as db:
        return ExecutionPlan.model_validate(db.get(Job, job.id_job).parameter_pipeline)


def test_subprocess_has_no_shell_or_inherited_secrets(m8_case, monkeypatch):
    execution = plan(m8_case)
    original = subprocess.Popen
    observed = []

    def spawn(command, **options):
        observed.append((command, options))
        return original(command, **options)

    monkeypatch.setattr(subprocess, "Popen", spawn)
    result = LocalExecutor().execute(execution)
    command, options = observed[0]
    assert command[:3] == [sys.executable, "-I", "-B"]
    assert options.get("shell", False) is False
    assert set(options["env"]) == {"PATH", "NXF_OFFLINE", "NXF_DISABLE_CHECK_LATEST"}
    assert result.vcf.is_file() and result.qc["synthetic"] is True


def test_real_timeout_kills_and_reaps_synthetic_process(m8_case, monkeypatch):
    execution = plan(m8_case).model_copy(update={"timeout_seconds": 0.05})
    original = subprocess.Popen
    processes = []

    def slow(command, **options):
        process = original([sys.executable, "-I", "-B", "-c", "import time; time.sleep(10)"], **options)
        processes.append(process)
        return process

    monkeypatch.setattr(subprocess, "Popen", slow)
    with pytest.raises(PipelineTimeout):
        LocalExecutor().execute(execution)
    assert processes[0].poll() is not None


def test_nonzero_exit_is_a_sanitized_failure(m8_case, monkeypatch):
    execution = plan(m8_case)
    original = subprocess.Popen
    monkeypatch.setattr(subprocess, "Popen", lambda command, **options: original(
        [sys.executable, "-I", "-B", "-c", "raise SystemExit(3)"], **options))
    with pytest.raises(PipelineFailure, match="Workflow process failed"):
        LocalExecutor().execute(execution)


def test_output_directory_is_never_reused(m8_case):
    execution = plan(m8_case)
    LocalExecutor().execute(execution)
    with pytest.raises(FileExistsError):
        LocalExecutor().execute(execution)


def test_nextflow_command_uses_fixed_workflow_and_params_file(m8_case, monkeypatch):
    execution = plan(m8_case).model_copy(update={
        "request": m8_case.request.model_copy(update={"execution_mode": "nextflow"}),
        "nextflow": Path("/configured/nextflow"), "alignment_adapter": Path("/configured/adapter"),
        "alignment_strategy": "operator-approved", "fastp": Path("/configured/fastp"),
        "samtools": Path("/configured/samtools"), "bcftools": Path("/configured/bcftools"),
    })
    process = Mock()
    process.__enter__ = Mock(return_value=process)
    process.__exit__ = Mock(return_value=False)
    process.wait.return_value = 0

    def fake(command, **options):
        assert command[0] == "/configured/nextflow" and "-params-file" in command
        assert "-resume" not in command and options.get("shell", False) is False
        (execution.outdir / "result.vcf").write_text("synthetic output is not a biological validation")
        (execution.outdir / "fastp.json").write_text('{"summary":{}}')
        return process

    monkeypatch.setattr(subprocess, "Popen", fake)
    result = LocalExecutor().execute(execution)
    assert result.qc["synthetic"] is False
    import json
    parameters = json.loads((execution.outdir / "params.json").read_text())
    assert parameters["alignment_adapter"] == "/configured/adapter"
    assert parameters["ploidy"] == 2


@pytest.mark.parametrize("name", ["bad;name", "bad$name", "bad`name", "bad'name"])
def test_shell_fragments_are_not_valid_executable_paths(tmp_path, name):
    value = tmp_path / name
    value.write_text("unused")
    value.chmod(0o700)
    from app.services.pipeline import PipelineUnavailable
    with pytest.raises(PipelineUnavailable):
        executable(value)


@pytest.mark.parametrize("strategy", ["", "bad;command", "unspecified strategy"])
def test_alignment_strategy_is_an_identifier_not_a_shell_command(strategy):
    from pydantic import ValidationError
    from app.core.config import Settings
    with pytest.raises(ValidationError):
        Settings(_env_file=None, pipeline_alignment_strategy=strategy)
