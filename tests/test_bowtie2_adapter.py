from pathlib import Path
from unittest.mock import Mock

import pytest

from app.services import bowtie2_adapter as adapter
from app.services.pipeline import ExecutionPlan, PipelineUnavailable, validate_biological_plan


def bundle(tmp_path, extension="bt2"):
    prefix = tmp_path / "reference"
    for suffix in adapter.SUFFIXES:
        Path(f"{prefix}.{suffix}.{extension}").write_bytes(b"index fixture")
    return prefix


@pytest.mark.parametrize("extension", ["bt2", "bt2l"])
def test_complete_index_formats(tmp_path, extension):
    assert len(adapter.index_files(bundle(tmp_path, extension))) == 6


@pytest.mark.parametrize("fault", ["missing", "empty", "mixed", "both", "directory"])
def test_incomplete_ambiguous_or_invalid_index_is_refused(tmp_path, fault):
    prefix = bundle(tmp_path)
    first = Path(f"{prefix}.1.bt2")
    if fault == "missing":
        first.unlink()
    elif fault == "empty":
        first.write_bytes(b"")
    elif fault == "mixed":
        Path(f"{prefix}.2.bt2l").write_bytes(b"unexpected")
    elif fault == "both":
        bundle(tmp_path, "bt2l")
    else:
        first.unlink()
        first.mkdir()
    with pytest.raises(ValueError):
        adapter.index_files(prefix)


@pytest.mark.parametrize("name", ["bad;prefix", "bad$prefix", "bad prefix", "-option"])
def test_unsafe_prefix_is_refused(tmp_path, name):
    with pytest.raises(ValueError):
        adapter.index_files(tmp_path / name)


def test_reference_digest_ignores_wrapping_case_and_description_but_not_identity(tmp_path):
    reference = tmp_path / "ref.fa"
    reconstructed = tmp_path / "index.fa"
    reference.write_text(">chr1 description\nacgt\nNN\n>chr2\nAG\n")
    reconstructed.write_text(">chr1\nACGTNN\n>chr2\nAG\n")
    assert adapter.fasta_digest(reference) == adapter.fasta_digest(reconstructed)
    reconstructed.write_text(">chr1\nACGTNA\n>chr2\nAG\n")
    assert adapter.fasta_digest(reference) != adapter.fasta_digest(reconstructed)
    reconstructed.write_text(">different\nACGTNN\n>chr2\nAG\n")
    assert adapter.fasta_digest(reference) != adapter.fasta_digest(reconstructed)


@pytest.mark.parametrize("content", ["", "ACGT\n", ">x\n", ">x\nACGZ\n", ">x\nA\n>x\nC\n", ">x\n>y\nA\n"])
def test_malformed_reference_is_refused(tmp_path, content):
    path = tmp_path / "bad.fa"
    path.write_text(content)
    with pytest.raises(ValueError):
        adapter.fasta_digest(path)


def test_mismatching_index_is_rejected_before_alignment(tmp_path, monkeypatch):
    prefix = bundle(tmp_path)
    reference = tmp_path / "ref.fa"
    reference.write_text(">chr1\nAAAA\n")
    reads = tmp_path / "reads.fastq"
    reads.write_text("@x\nAAAA\n+\nIIII\n")
    calls = []

    def inspect(command, *, stdout, **kwargs):
        calls.append(command)
        stdout.write(b">chr1\nCCCC\n")

    monkeypatch.setattr(adapter.subprocess, "run", inspect)
    with pytest.raises(ValueError, match="does not match"):
        adapter.align(reads=reads, reference=reference, output=tmp_path / "out.sam", sample="sample",
                      threads=2, prefix=prefix, bowtie2=Path("bowtie2"), inspector=Path("inspect"))
    assert calls == [["inspect", str(prefix)]]
    assert not (tmp_path / "out.sam").exists()


def test_alignment_uses_fixed_argv_read_group_and_exclusive_output(tmp_path, monkeypatch):
    prefix = bundle(tmp_path)
    reference = tmp_path / "ref.fa"
    reference.write_text(">chr1\nACGT\n")
    reads = tmp_path / "reads.fastq"
    reads.write_text("@x\nACGT\n+\nIIII\n")
    calls = []

    def run(command, *, stdout, **kwargs):
        assert kwargs.get("shell", False) is False and kwargs["timeout"] > 0
        calls.append(command)
        stdout.write(b">chr1\nACGT\n" if command[0] == "inspect" else b"@RG\tID:sample\tSM:sample\n")

    monkeypatch.setattr(adapter.subprocess, "run", run)
    args = dict(reads=reads, reference=reference, output=tmp_path / "out.sam", sample="sample",
                threads=2, prefix=prefix, bowtie2=Path("bowtie2"), inspector=Path("inspect"))
    adapter.align(**args)
    assert calls[1][-4:] == ["--rg-id", "sample", "--rg", "SM:sample"]
    assert calls[1][calls[1].index("-U") + 1] == str(reads)
    with pytest.raises(ValueError, match="already exists"):
        adapter.align(**args)
    assert len(calls) == 2


@pytest.mark.parametrize("sample,threads", [("bad;sample", 2), ("x", 0), ("x", 5)])
def test_invalid_sample_or_thread_budget_precedes_process(tmp_path, sample, threads, monkeypatch):
    spawn = Mock()
    monkeypatch.setattr(adapter.subprocess, "run", spawn)
    with pytest.raises(ValueError):
        adapter.align(reads=tmp_path / "reads", reference=tmp_path / "ref", output=tmp_path / "sam",
                      sample=sample, threads=threads, prefix=tmp_path / "index",
                      bowtie2=Path("bowtie2"), inspector=Path("inspect"))
    spawn.assert_not_called()


def test_stored_version_one_plan_without_new_fields_still_loads(m8_case):
    from app.services.jobs import build_plan

    with m8_case.factory() as db:
        original = build_plan(db, m8_case.settings, 1, m8_case.request).model_dump(mode="json")
    for key in ("bowtie2", "bowtie2_inspect", "bowtie2_index_prefix"):
        original.pop(key)
    restored = ExecutionPlan.model_validate(original)
    assert restored.version == 1 and restored.bowtie2_index_prefix is None
    assert restored.request == m8_case.request


@pytest.mark.parametrize("ploidy,threads", [(3, 2), (16, 2), (2, 5)])
def test_biological_caller_limits_do_not_change_synthetic_schema(m8_case, ploidy, threads):
    from app.services.jobs import build_plan

    request = m8_case.request.model_copy(update={"variant_ploidy": ploidy})
    with m8_case.factory() as db:
        execution = build_plan(db, m8_case.settings, 1, request)
    assert execution.request.variant_ploidy == ploidy
    execution = execution.model_copy(update={"threads": threads})
    with pytest.raises(PipelineUnavailable):
        validate_biological_plan(execution)


def test_job_plan_snapshots_explicit_bowtie_inputs_and_confines_index(m8_case):
    from app.services.jobs import build_plan

    case = m8_case
    prefix = bundle(case.settings.reference_root)
    case.settings = case.settings.model_copy(update={
        "pipeline_alignment_strategy": "bowtie2", "pipeline_alignment_adapter": Path("/bin/true"),
        "pipeline_nextflow_executable": Path("/bin/true"), "pipeline_fastp_executable": Path("/bin/true"),
        "pipeline_samtools_executable": Path("/bin/true"), "pipeline_bcftools_executable": Path("/bin/true"),
        "pipeline_bowtie2_executable": Path("/bin/true"), "pipeline_bowtie2_inspect_executable": Path("/bin/true"),
        "pipeline_bowtie2_index_prefix": prefix,
    })
    request = case.request.model_copy(update={"execution_mode": "nextflow"})
    with case.factory() as db:
        execution = build_plan(db, case.settings, 1, request)
        assert execution.bowtie2_index_prefix == prefix
        assert execution.bowtie2 == Path("/bin/true").resolve()
        outside = bundle(case.tmp)
        with pytest.raises(PipelineUnavailable):
            build_plan(db, case.settings.model_copy(update={"pipeline_bowtie2_index_prefix": outside}), 1, request)
        with pytest.raises(PipelineUnavailable):
            build_plan(db, case.settings.model_copy(update={"pipeline_bowtie2_index_prefix": None}), 1, request)
    # Old persisted Bowtie2 plans remain parseable, but cannot silently choose an index.
    legacy = execution.model_dump(mode="json")
    for key in ("bowtie2", "bowtie2_inspect", "bowtie2_index_prefix"):
        legacy.pop(key)
    with pytest.raises(PipelineUnavailable, match="Explicit Bowtie2"):
        validate_biological_plan(ExecutionPlan.model_validate(legacy))
