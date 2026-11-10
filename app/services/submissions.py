"""Compose existing upload/Job services without changing M7 or selecting defaults."""

import hashlib
import json

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from app.models import Job, ReferenceGenome
from app.schemas.job import JobCreateRequest
from app.schemas.sample import SampleUploadResponse
from app.schemas.submission import SubmissionResponse
from app.services import jobs
from app.services.fastq import InvalidFastqError, UploadLimitError
from app.services.pipeline import PipelineUnavailable, check_gate, confined_file
from app.services.samples import persist_upload
from app.services.upload_validation import ValidationBudgetError, joined_thread


def validate_parameters(settings, parameters):
    check_gate(settings, parameters.execution_mode)
    expected = settings.pipeline_alignment_strategy if parameters.execution_mode == "nextflow" else "synthetic-no-alignment"
    if parameters.alignment_strategy != expected:
        raise jobs.JobInvalid("Requested alignment strategy is not configured.")
    if parameters.execution_mode == "nextflow" and (
        parameters.variant_ploidy not in (1, 2) or settings.pipeline_threads > 4
    ):
        raise jobs.JobInvalid("Unsupported biological parameters.")


def preflight(factory, settings, owner, parameters):
    validate_parameters(settings, parameters)
    with factory() as db:
        reference = db.get(ReferenceGenome, parameters.id_reference_genome)
        if reference is None:
            raise jobs.JobInvalid("Reference is unavailable.")
        confined_file(settings.reference_root, reference.path_fasta)
        jobs.global_capacity(db, settings)
        if db.scalar(select(Job.id_job).where(Job.id_user == owner, Job.status.in_(("Queued", "Running")))):
            raise jobs.JobConflict("One active Job per user is allowed.")


def fingerprint(incoming):
    digest = hashlib.sha256()
    while chunk := incoming.file.read(1024**2):
        digest.update(chunk)
    incoming.file.seek(0)
    return {"filename": incoming.filename, "bytes": incoming.size_bytes, "sha256": digest.hexdigest()}


def blocked(parameters, sample=None, job=None, *, uncertain=False):
    return SubmissionResponse(
        request_id=parameters.request_id, sample=sample, job=job,
        submission_status="reconciliation_required" if uncertain else "sample_stored",
        detail=("Submission outcome requires reconciliation; do not use a new UUID to repeat this upload."
                if uncertain else "Sample is stored. Retry with the same UUID, parameters and file; no second Sample will be created."),
    )


async def accept_upload(incoming, record, parameters, settings, owner, factory):
    configuration = parameters.model_dump(mode="json")
    content = await joined_thread(lambda: fingerprint(incoming))
    if record.data and record.data["fingerprint"] != content:
        raise jobs.JobConflict("Submission UUID belongs to a different file.")
    replay = record.data is not None
    if not record.data:
        await joined_thread(lambda: record.write({"phase": "upload_started", "configuration": configuration,
                                                  "fingerprint": content}))
        try:
            sample = await persist_upload(incoming.file, incoming.filename, settings, owner, factory)
        except (InvalidFastqError, UploadLimitError, ValidationBudgetError):
            await joined_thread(lambda: record.write({**record.data, "phase": "rejected"}))
            raise
        except SQLAlchemyError:
            return 503, blocked(parameters, uncertain=True)
        # Any other upload exception/cancellation leaves upload_started intact.
        # A replay must not guess whether Sample COMMIT reached PostgreSQL.
        try:
            await joined_thread(lambda: record.write({**record.data, "phase": "sample_stored",
                                                      "sample": sample.model_dump(mode="json")}))
        except (OSError, ValueError):
            return 503, blocked(parameters, sample, uncertain=True)
    else:
        sample = SampleUploadResponse.model_validate_json(json.dumps(record.data["sample"]))
    request = JobCreateRequest(id_sample=sample.id_sample,
                               **parameters.model_dump(exclude={"alignment_strategy"}))
    try:
        job = await joined_thread(lambda: jobs.create_job(factory, settings, owner, request))
    except (jobs.JobConflict, jobs.JobInvalid):
        return 409, blocked(parameters, sample)
    except PipelineUnavailable:
        return 503, blocked(parameters, sample)
    except SQLAlchemyError:
        # The existing Job UUID lookup makes a later same-receipt retry safe,
        # including an ambiguous Job COMMIT. Never create a second Sample.
        return 503, blocked(parameters, sample, uncertain=True)
    try:
        await joined_thread(lambda: record.write({**record.data, "phase": "job_stored", "id_job": job.id_job}))
    except (OSError, ValueError):
        return 503, blocked(parameters, sample, job, uncertain=True)
    dispatch = job.status == "Queued"
    if dispatch:
        try:
            await joined_thread(lambda: jobs.prepare_dispatch(factory, settings, job.id_job, owner))
        except (jobs.JobConflict, PipelineUnavailable, SQLAlchemyError):
            return 503, blocked(parameters, sample, job)
    return 202, SubmissionResponse(request_id=parameters.request_id,
                                   submission_status="replayed" if replay else "accepted",
                                   sample=sample, job=job, dispatch_scheduled=dispatch)
