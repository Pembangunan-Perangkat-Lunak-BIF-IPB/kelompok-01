"""Persisted Job lifecycle with row-lock claims and replaceable execution.

In-process dispatch is explicit, not durable queueing. A restart can leave a Job
Queued/Running; never infer an abandoned worker or automatically resume it.
"""

from datetime import datetime, timezone
from uuid import uuid4

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import Settings
from app.models import Analysis, Job, ReferenceGenome, Sample, User
from app.schemas.job import JobCreateRequest, JobResponse
from app.services.pipeline import (
    ExecutionPlan, Executor, LocalExecutor, PipelineFailure, PipelineTimeout,
    PipelineUnavailable, check_gate, confined_file, executable, validate_biological_plan,
)
from app.services.bowtie2_adapter import index_files
from app.services.vcf_ingestion import ingest_result
from app.services.vcf_summary import InvalidVcfError


class JobNotFound(ValueError):
    pass


class JobConflict(ValueError):
    pass


class JobInvalid(ValueError):
    pass


SAFE_ERRORS = {
    "VCF output failed validation.", "Workflow exceeded its execution timeout.",
    "Workflow execution failed.", "Execution configuration or input is unavailable.",
    "Result persistence failed; review before retry.", "Internal workflow failure.",
}


def now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def snapshot(db, job):
    configuration = job.parameter_pipeline or {}
    mode = configuration.get("request", {}).get("execution_mode")
    return JobResponse(
        id_job=job.id_job, id_sample=job.id_sample, id_reference_genome=job.id_reference_genome,
        status=job.status, waktu_mulai=job.waktu_mulai.replace(tzinfo=timezone.utc) if job.waktu_mulai else None,
        waktu_selesai=job.waktu_selesai.replace(tzinfo=timezone.utc) if job.waktu_selesai else None,
        pesan_error=(job.pesan_error if job.pesan_error in SAFE_ERRORS else "Job failed; review server execution.")
        if job.pesan_error else None, execution_mode=mode if mode in ("synthetic", "nextflow") else None,
        has_result=job.status == "Completed" and db.scalar(
            select(Analysis.id_analysis).where(Analysis.id_job == job.id_job)) is not None,
    )


def owned_job(db, identifier, owner, *, lock=False):
    statement = select(Job).where(Job.id_job == identifier, Job.id_user == owner)
    if lock:
        statement = statement.with_for_update()
    job = db.scalar(statement)
    if job is None:
        raise JobNotFound("Job not found.")
    return job


def build_plan(db, settings, owner, request):
    check_gate(settings, request.execution_mode)
    sample = db.scalar(select(Sample).where(Sample.id_sample == request.id_sample, Sample.id_user == owner))
    reference = db.get(ReferenceGenome, request.id_reference_genome)
    if sample is None:
        raise JobNotFound("Sample not found.")
    if reference is None:
        raise JobInvalid("Reference genome is unavailable.")
    reads = confined_file(settings.upload_root, sample.path_penyimpanan, relative=True)
    fasta = confined_file(settings.reference_root, reference.path_fasta)
    run_id = uuid4().hex
    root = settings.pipeline_root.absolute()
    if root.resolve() != root:
        raise PipelineUnavailable("Unsafe output root.")
    biological = request.execution_mode == "nextflow"
    bowtie = biological and settings.pipeline_alignment_strategy == "bowtie2"
    prefix = settings.pipeline_bowtie2_index_prefix if bowtie else None
    if bowtie:
        try:
            if prefix is None:
                raise ValueError
            prefix = prefix if prefix.is_absolute() else settings.reference_root.absolute() / prefix
            for path in index_files(prefix):
                confined_file(settings.reference_root, path)
        except (OSError, ValueError):
            raise PipelineUnavailable("Explicit reference-confined Bowtie2 index is required.") from None
    plan = ExecutionPlan(
        request=request, run_id=run_id, reads=reads, reference=fasta, outdir=root / run_id,
        alignment_strategy=settings.pipeline_alignment_strategy if biological else "synthetic-no-alignment",
        alignment_adapter=executable(settings.pipeline_alignment_adapter) if biological else None,
        bowtie2=executable(settings.pipeline_bowtie2_executable) if bowtie else None,
        bowtie2_inspect=executable(settings.pipeline_bowtie2_inspect_executable) if bowtie else None,
        bowtie2_index_prefix=prefix,
        nextflow=executable(settings.pipeline_nextflow_executable) if biological else None,
        fastp=executable(settings.pipeline_fastp_executable) if biological else None,
        samtools=executable(settings.pipeline_samtools_executable) if biological else None,
        bcftools=executable(settings.pipeline_bcftools_executable) if biological else None,
        threads=settings.pipeline_threads, timeout_seconds=settings.pipeline_timeout_seconds,
        profile=settings.pipeline_nextflow_profile,
    )
    if biological:
        validate_biological_plan(plan)
    return plan


def create_job(factory, settings: Settings, owner: int, request: JobCreateRequest):
    with factory() as db, db.begin():
        # Serializes creation per user in PostgreSQL, including idempotent replay.
        if db.scalar(select(User.id_user).where(User.id_user == owner).with_for_update()) is None:
            raise JobNotFound("User not found.")
        existing = db.scalar(select(Job).where(
            Job.id_user == owner,
            Job.parameter_pipeline["request"]["request_id"].as_string() == request.request_id,
        ))
        if existing is not None:
            if existing.parameter_pipeline["request"] != request.model_dump(mode="json"):
                raise JobConflict("Submission UUID already belongs to different parameters.")
            return snapshot(db, existing)
        active = db.scalar(select(Job.id_job).where(Job.id_user == owner, Job.status.in_(["Queued", "Running"])))
        if active is not None:
            raise JobConflict("One active Job per user is allowed.")
        plan = build_plan(db, settings, owner, request)
        job = Job(id_user=owner, id_sample=request.id_sample, id_reference_genome=request.id_reference_genome,
                  status="Queued", parameter_pipeline=plan.model_dump(mode="json"))
        db.add(job)
        db.flush()
        return snapshot(db, job)


def get_job(factory, identifier, owner):
    with factory() as db:
        return snapshot(db, owned_job(db, identifier, owner))


def prepare_dispatch(factory, settings, identifier, owner):
    with factory() as db:
        job = owned_job(db, identifier, owner)
        if job.status != "Queued":
            raise JobConflict("Only a Queued Job can be started.")
        try:
            plan = ExecutionPlan.model_validate(job.parameter_pipeline)
        except ValidationError:
            raise JobInvalid("Job configuration is missing or invalid.") from None
        check_gate(settings, plan.request.execution_mode)
        return snapshot(db, job)


def retry_job(factory, settings, identifier, owner):
    with factory() as db:
        previous = owned_job(db, identifier, owner)
        if previous.status != "Failed":
            raise JobConflict("Only a Failed Job can be retried as a new Job.")
        try:
            request = ExecutionPlan.model_validate(previous.parameter_pipeline).request.model_copy(
                update={"request_id": str(uuid4())})
        except ValidationError:
            raise JobInvalid("Job configuration is missing or invalid.") from None
    return create_job(factory, settings, owner, request)


def fail_job(factory, identifier, message):
    with factory() as db, db.begin():
        job = db.scalar(select(Job).where(Job.id_job == identifier).with_for_update())
        if job is None or job.status not in ("Queued", "Running"):
            return False
        job.status, job.waktu_selesai, job.pesan_error = "Failed", now(), message
        return True


def run_job(factory, settings: Settings, identifier: int, executor: Executor | None = None) -> str:
    try:
        with factory() as db, db.begin():
            job = db.scalar(select(Job).where(Job.id_job == identifier).with_for_update())
            if job is None or job.status != "Queued":
                return "not_claimed"
            plan = ExecutionPlan.model_validate(job.parameter_pipeline)
            check_gate(settings, plan.request.execution_mode)
            sample = db.get(Sample, job.id_sample)
            reference = db.get(ReferenceGenome, job.id_reference_genome)
            if (sample is None or reference is None or sample.id_user != job.id_user
                    or job.id_sample != plan.request.id_sample
                    or job.id_reference_genome != plan.request.id_reference_genome
                    or confined_file(settings.upload_root, sample.path_penyimpanan, relative=True) != plan.reads
                    or confined_file(settings.reference_root, reference.path_fasta) != plan.reference
                    or plan.outdir != settings.pipeline_root.absolute() / plan.run_id):
                raise PipelineUnavailable("Stored Job inputs are inconsistent.")
            job.status, job.waktu_mulai, job.waktu_selesai, job.pesan_error = "Running", now(), None, None
        # No database transaction is held while an external process is running.
        result = (executor or LocalExecutor()).execute(plan)
        with factory() as db, db.begin():
            job = db.scalar(select(Job).where(Job.id_job == identifier).with_for_update())
            sample = db.get(Sample, job.id_sample) if job is not None else None
            if (job is None or job.status != "Running" or sample is None
                    or sample.id_user != job.id_user or job.parameter_pipeline.get("run_id") != plan.run_id):
                raise PipelineFailure("Job state changed before result completion.")
            ingest_result(db, job, plan, result)
            job.status, job.waktu_selesai = "Completed", now()
        return "completed"
    except Exception as error:
        if isinstance(error, InvalidVcfError):
            message = "VCF output failed validation."
        elif isinstance(error, PipelineTimeout):
            message = "Workflow exceeded its execution timeout."
        elif isinstance(error, (PipelineUnavailable, ValidationError)):
            message = "Execution configuration or input is unavailable."
        elif isinstance(error, PipelineFailure):
            message = "Workflow execution failed."
        elif isinstance(error, SQLAlchemyError):
            message = "Result persistence failed; review before retry."
        else:
            message = "Internal workflow failure."
        try:
            return "failed" if fail_job(factory, identifier, message) else "completion_unconfirmed"
        except SQLAlchemyError:
            # Caller/monitor must reconcile; never pretend a status write succeeded.
            return "status_write_failed"
