import json
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

import pytest
from sqlalchemy import event, func, select
from sqlalchemy.exc import IntegrityError, OperationalError

from app.models import Analysis, Genotype, Job, Sample, Variant
from app.services import jobs
from app.services.pipeline import ExecutionPlan, LocalExecutor, PipelineResult, PipelineTimeout, PipelineUnavailable
from app.services.vcf_summary import summarize_vcf


HEADER = "##fileformat=VCFv4.2\n#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tfixture_sample\n"


def row(ref="A", alt="C", qual="60", filters="PASS", gt="0/1", dp="20"):
    return f"synthetic_chr\t1\t.\t{ref}\t{alt}\t{qual}\t{filters}\tDP=999;FLAG\tGT:DP\t{gt}:{dp}\n"


def create(case, **changes):
    return jobs.create_job(case.factory, case.settings, 1, case.request.model_copy(update=changes))


def count(case, model):
    with case.factory() as db:
        return db.scalar(select(func.count()).select_from(model))


class FixtureExecutor:
    def __init__(self, content):
        self.content, self.calls = content, 0

    def execute(self, plan):
        self.calls += 1
        plan.outdir.mkdir(parents=True)
        vcf = plan.outdir / "result.vcf"
        vcf.write_text(self.content)
        return PipelineResult(vcf, {"synthetic": True})


def test_real_synthetic_subprocess_completes_and_persists_relations(m8_case):
    c = m8_case
    queued = create(c)
    assert queued.status == "Queued" and queued.waktu_mulai is None
    assert jobs.run_job(c.factory, c.settings, queued.id_job) == "completed"
    result = jobs.get_job(c.factory, queued.id_job, 1)
    assert result.status == "Completed" and result.has_result
    assert result.waktu_selesai >= result.waktu_mulai
    with c.factory() as db:
        analysis = db.scalar(select(Analysis))
        assert (analysis.total_varian, analysis.snp_count, analysis.indel_count, analysis.other_count) == (3, 1, 1, 1)
        variants = db.scalars(select(Variant)).all()
        assert {v.variant_type for v in variants} == {"snp", "indel", "other"}
        genotypes = db.scalars(select(Genotype)).all()
        assert len(genotypes) == 3 and all(g.id_sample == 1 and g.dp == 25 for g in genotypes)
        assert json.loads(analysis.metrik_qc)["qc"]["synthetic"] is True
        assert summarize_vcf(c.settings.pipeline_root / analysis.path_vcf).total_variants == 3


def test_idempotent_submission_and_worker_replay_do_not_duplicate(m8_case):
    c = m8_case
    first = create(c)
    assert create(c).id_job == first.id_job
    executor = FixtureExecutor(HEADER + row())
    assert jobs.run_job(c.factory, c.settings, first.id_job, executor) == "completed"
    assert jobs.run_job(c.factory, c.settings, first.id_job, executor) == "not_claimed"
    assert create(c).id_job == first.id_job
    assert executor.calls == 1 and count(c, Analysis) == count(c, Variant) == count(c, Genotype) == 1


def test_reused_submission_uuid_cannot_change_parameters(m8_case):
    create(m8_case)
    with pytest.raises(jobs.JobConflict):
        create(m8_case, parameter_qual=80.0)


def test_one_active_job_per_user_but_other_user_can_queue(m8_case):
    c = m8_case
    create(c)
    with pytest.raises(jobs.JobConflict):
        create(c, request_id=str(uuid4()))
    other = jobs.create_job(c.factory, c.settings, 2, c.request.model_copy(update={
        "id_sample": 2, "request_id": str(uuid4()),
    }))
    assert other.status == "Queued"


@pytest.mark.parametrize("changes,error", [
    ({"id_sample": 2}, jobs.JobNotFound), ({"id_sample": 999}, jobs.JobNotFound),
    ({"id_reference_genome": 999}, jobs.JobInvalid),
])
def test_ownership_and_reference_checks_precede_job_creation(m8_case, changes, error):
    with pytest.raises(error):
        create(m8_case, **changes)
    assert count(m8_case, Job) == 0


@pytest.mark.parametrize("settings", [
    {"pipeline_enabled": False}, {"pipeline_allow_synthetic": False},
])
def test_server_gates_default_to_no_execution(m8_case, settings):
    c = m8_case
    c.settings = c.settings.model_copy(update=settings)
    with pytest.raises(PipelineUnavailable):
        create(c)
    assert count(c, Job) == 0


def test_nextflow_requires_operator_configuration_and_no_default_aligner(m8_case):
    with pytest.raises(PipelineUnavailable):
        create(m8_case, execution_mode="nextflow")
    assert count(m8_case, Job) == 0


@pytest.mark.parametrize("path", ["../outside.fastq", "/outside.fastq", "missing.fastq"])
def test_sample_paths_cannot_escape_storage(m8_case, path):
    with m8_case.factory.begin() as db:
        db.get(Sample, 1).path_penyimpanan = path
    with pytest.raises(PipelineUnavailable):
        create(m8_case)


def test_sample_symlink_is_rejected(m8_case):
    c = m8_case
    file = c.settings.upload_root / "one.fastq"
    file.unlink()
    file.symlink_to(c.settings.reference_root / "tiny.fa")
    with pytest.raises(PipelineUnavailable):
        create(c)


def test_ingestion_selection_and_raw_counts_are_explicit(m8_case):
    c = m8_case
    content = HEADER + "".join([
        row(alt="C,G", gt="1|2"), row(alt="AT"), row(alt="C,AT"),
        row(filters="q10"), row(qual="."), row(dp="."), row(qual="20"), row(dp="5"),
        row(alt=".", gt="0/0"),
    ])
    job = create(c)
    assert jobs.run_job(c.factory, c.settings, job.id_job, FixtureExecutor(content)) == "completed"
    with c.factory() as db:
        analysis = db.scalar(select(Analysis))
        assert (analysis.total_varian, analysis.snp_count, analysis.indel_count, analysis.other_count) == (3, 1, 1, 1)
        assert json.loads(analysis.metrik_qc)["raw_record_counts"]["total_variants"] == 8
        variant = db.scalar(select(Variant).where(Variant.variant_type == "snp"))
        assert variant.alt_allele == "C,G" and variant.info["DP"] == "999"
        assert variant.genotypes[0].genotype_call == "1|2" and variant.genotypes[0].dp == 20
        assert summarize_vcf(c.settings.pipeline_root / analysis.path_vcf).total_variants == 3


def test_filtered_records_can_be_explicitly_included(m8_case):
    c = m8_case
    job = create(c, require_pass=False)
    assert jobs.run_job(c.factory, c.settings, job.id_job, FixtureExecutor(HEADER + row(filters="q10"))) == "completed"
    assert count(c, Variant) == 1


@pytest.mark.parametrize("body", ["", row(qual="."), row(dp="."), row(alt=".", gt="0/0")])
def test_zero_selected_variants_complete_without_inventing_records(m8_case, body):
    c = m8_case
    job = create(c)
    assert jobs.run_job(c.factory, c.settings, job.id_job, FixtureExecutor(HEADER + body)) == "completed"
    assert count(c, Analysis) == 1 and count(c, Variant) == count(c, Genotype) == 0


@pytest.mark.parametrize("bad", [row(dp="invalid"), row(gt="0/2"), row(qual="NaN")])
def test_late_semantic_failure_rolls_back_already_flushed_rows(m8_case, bad):
    c = m8_case
    job = create(c)
    outcome = jobs.run_job(c.factory, c.settings, job.id_job, FixtureExecutor(HEADER + row() * 205 + bad))
    assert outcome == "failed"
    assert count(c, Analysis) == count(c, Variant) == count(c, Genotype) == 0
    result = jobs.get_job(c.factory, job.id_job, 1)
    assert result.status == "Failed" and result.pesan_error == "VCF output failed validation."


def test_insert_failure_rolls_back_the_entire_result(m8_case):
    def fail(*args):
        raise IntegrityError("private-sql-marker", {}, RuntimeError("private-driver-marker"))

    c = m8_case
    job = create(c)
    event.listen(Variant, "before_insert", fail)
    try:
        assert jobs.run_job(c.factory, c.settings, job.id_job, FixtureExecutor(HEADER + row())) == "failed"
    finally:
        event.remove(Variant, "before_insert", fail)
    assert count(c, Analysis) == count(c, Variant) == count(c, Genotype) == 0
    assert "private" not in jobs.get_job(c.factory, job.id_job, 1).model_dump_json()


def test_completion_commit_failure_rolls_back_results(m8_case):
    c = m8_case
    job = create(c)
    fired = []

    def fail_once(session):
        if not fired and any(isinstance(x, Job) and x.status == "Completed" for x in session.dirty):
            fired.append(True)
            raise OperationalError("private-sql", {}, RuntimeError("private-driver"))

    event.listen(c.factory.class_, "before_commit", fail_once)
    try:
        assert jobs.run_job(c.factory, c.settings, job.id_job, FixtureExecutor(HEADER + row())) == "failed"
    finally:
        event.remove(c.factory.class_, "before_commit", fail_once)
    assert fired and count(c, Analysis) == count(c, Variant) == count(c, Genotype) == 0


@pytest.mark.parametrize("error", [PipelineTimeout("private-marker"), RuntimeError("private-marker")])
def test_worker_failure_and_retry_use_a_new_job_and_run_directory(m8_case, error):
    c = m8_case
    job = create(c)
    executor = SimpleNamespace(execute=lambda plan: (_ for _ in ()).throw(error))
    assert jobs.run_job(c.factory, c.settings, job.id_job, executor) == "failed"
    failed = jobs.get_job(c.factory, job.id_job, 1)
    assert failed.status == "Failed" and "private" not in failed.model_dump_json()
    retry = jobs.retry_job(c.factory, c.settings, job.id_job, 1)
    assert retry.id_job != job.id_job and retry.status == "Queued"
    with c.factory() as db:
        assert db.get(Job, retry.id_job).parameter_pipeline["run_id"] != db.get(Job, job.id_job).parameter_pipeline["run_id"]
    assert jobs.run_job(c.factory, c.settings, retry.id_job) == "completed"


def test_owner_cannot_read_or_retry_another_users_job(m8_case):
    job = create(m8_case)
    with pytest.raises(jobs.JobNotFound):
        jobs.get_job(m8_case.factory, job.id_job, 2)
    with pytest.raises(jobs.JobNotFound):
        jobs.retry_job(m8_case.factory, m8_case.settings, job.id_job, 2)


def test_changed_input_owner_is_rejected_before_executor(m8_case):
    c = m8_case
    job = create(c)
    with c.factory.begin() as db:
        db.get(Sample, 1).id_user = 2
    executor = FixtureExecutor(HEADER + row())
    assert jobs.run_job(c.factory, c.settings, job.id_job, executor) == "failed"
    assert executor.calls == 0


def test_running_job_cannot_be_started_again_or_retried(m8_case):
    c = m8_case
    job = create(c)
    with c.factory.begin() as db:
        db.get(Job, job.id_job).status = "Running"
    with pytest.raises(jobs.JobConflict):
        jobs.prepare_dispatch(c.factory, c.settings, job.id_job, 1)
    with pytest.raises(jobs.JobConflict):
        jobs.retry_job(c.factory, c.settings, job.id_job, 1)
    assert jobs.run_job(c.factory, c.settings, job.id_job) == "not_claimed"


def test_legacy_error_and_configuration_do_not_leak_to_status(m8_case):
    c = m8_case
    job = create(c)
    with c.factory.begin() as db:
        stored = db.get(Job, job.id_job)
        stored.status, stored.pesan_error = "Failed", "private legacy database error"
    response = jobs.get_job(c.factory, job.id_job, 1).model_dump_json()
    assert "private" not in response and str(c.tmp) not in response and "parameter_pipeline" not in response


def test_executor_cannot_import_a_vcf_outside_its_owned_run(m8_case):
    c = m8_case
    job = create(c)
    outside = c.tmp / "foreign.vcf"
    outside.write_text(HEADER + row())
    executor = SimpleNamespace(execute=lambda plan: PipelineResult(outside, {}))
    assert jobs.run_job(c.factory, c.settings, job.id_job, executor) == "failed"
    assert count(c, Analysis) == count(c, Variant) == count(c, Genotype) == 0


def test_database_unavailability_does_not_pretend_failed_status_was_saved(m8_case):
    def unavailable():
        raise OperationalError("private-sql", {}, RuntimeError("private-driver"))

    assert jobs.run_job(unavailable, m8_case.settings, 1) == "status_write_failed"
