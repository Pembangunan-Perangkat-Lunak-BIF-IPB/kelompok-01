from threading import Lock
from contextlib import contextmanager
from collections.abc import Callable
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, Response
from sqlalchemy.orm import Session

from app.api.dependencies import get_upload_owner_id, get_settings
from app.core.config import Settings
from app.database import get_session_factory
from app.schemas.auth import ErrorResponse
from app.schemas.sample import SampleUploadResponse
from app.schemas.submission import SubmissionRequest, SubmissionResponse, SubmissionValidationError
from app.services import jobs, submissions
from app.services.pipeline import PipelineUnavailable, check_gate
from app.services.submission_record import SubmissionBusy, SubmissionRecord
from app.services.fastq import InvalidFastqError, InvalidFilenameError, UploadLimitError
from app.services.multipart_upload import (
    MultipartError, UploadFieldsError, UploadMediaTypeError, receive_upload,
)
from app.services.storage import StorageError
from app.services.samples import persist_upload
from app.services.upload_validation import ValidationBudgetError, joined_thread


router = APIRouter(prefix="/samples", tags=["samples"])
# Shared by app instances in this process. Multiple Uvicorn workers have own slots.
upload_slot = Lock()


@contextmanager
def upload_errors():
    """The same sanitized multipart/storage policy for both upload endpoints."""
    try:
        yield
    except UploadMediaTypeError:
        raise HTTPException(415, "Expected multipart/form-data.") from None
    except MultipartError:
        raise HTTPException(400, "Malformed or incomplete upload request.") from None
    except UploadLimitError:
        raise HTTPException(413, "Upload resource limit exceeded.") from None
    except (UploadFieldsError, InvalidFilenameError, InvalidFastqError, ValidationBudgetError):
        raise HTTPException(422, "Invalid upload or validation budget exceeded.") from None
    except (StorageError, OSError):
        raise HTTPException(503, "Upload service unavailable.") from None


@router.post(
    "/upload",
    response_model=SampleUploadResponse,
    status_code=201,
    summary="Upload a FASTQ file and create its Sample metadata",
    description="Store one validated FASTQ file owned by the authenticated user.",
    responses={code: {"model": ErrorResponse} for code in (400, 401, 413, 415, 422, 503)},
    openapi_extra={"requestBody": {
        "required": True,
        "content": {"multipart/form-data": {"schema": {
            "type": "object", "required": ["file"], "additionalProperties": False,
            "properties": {"file": {"type": "string", "format": "binary"}},
        }}},
    }},
)
async def upload_sample(
    request: Request,
    id_user: Annotated[int, Depends(get_upload_owner_id)],
    settings: Annotated[Settings, Depends(get_settings)],
    session_factory: Annotated[Callable[[], Session], Depends(get_session_factory)],
) -> SampleUploadResponse:
    # No File/Form/Body parameter: FastAPI resolves auth BEFORE we touch receive.
    if not upload_slot.acquire(blocking=False):
        raise HTTPException(503, "Upload capacity unavailable.", headers={"Retry-After": "1"})
    try:
        with upload_errors():
            async with receive_upload(request, settings) as incoming:
                return await persist_upload(
                    incoming.file, incoming.filename, settings, id_user, session_factory,
                )
    finally:
        upload_slot.release()


@router.post(
    "/upload-and-run", status_code=202, response_model=SubmissionResponse,
    summary="Upload one FASTQ and automatically dispatch an explicitly configured Job",
    description=("Analysis parameters are required query parameters; multipart contains exactly one file. "
                 "202 acknowledges a submission, never completion. Reuse the UUID only with identical "
                 "parameters, filename and bytes. Interrupted upload commits require reconciliation. "
                 "Queued replays can redispatch; workers claim once. Dispatch is in-process, not restart-durable."),
    responses={**{code: {"model": ErrorResponse} for code in (400, 401, 413, 415)},
               422: {"model": SubmissionValidationError | ErrorResponse,
                     "description": "Request validation errors, invalid FASTQ, or invalid Job configuration/reference",
                     "content": {"application/json": {"examples": {
                         "request_validation": {"value": {"detail": [{"loc": ["body"],
                             "msg": "Invalid request.", "type": "request_validation_error"}]}},
                         "invalid_fastq": {"value": {"detail": "Invalid upload or validation budget exceeded."}},
                         "invalid_job": {"value": {"detail": "Invalid Job configuration or reference."}},
                     }}}},
               409: {"model": SubmissionResponse | ErrorResponse,
                     "description": "Conflict, or a retained Sample awaiting Job creation"},
               503: {"model": SubmissionResponse | ErrorResponse,
                     "description": "Unavailable, retained Sample, or reconciliation required; never blindly change UUID"}},
    openapi_extra={"requestBody": {"required": True, "content": {"multipart/form-data": {"schema": {
        "type": "object", "required": ["file"], "additionalProperties": False,
        "properties": {"file": {"type": "string", "format": "binary"}},
    }}}}},
)
async def upload_and_run(
    request: Request, response: Response, background_tasks: BackgroundTasks,
    parameters: Annotated[SubmissionRequest, Query()],
    id_user: Annotated[int, Depends(get_upload_owner_id)],
    settings: Annotated[Settings, Depends(get_settings)],
    session_factory: Annotated[Callable[[], Session], Depends(get_session_factory)],
) -> SubmissionResponse:
    if not upload_slot.acquire(blocking=False):
        raise HTTPException(503, "Upload capacity unavailable.", headers={"Retry-After": "1"})
    held = []
    try:
        response.headers["Cache-Control"] = "private, no-store"
        with upload_errors():
            check_gate(settings, parameters.execution_mode)

            def acquire():
                held.append(SubmissionRecord(settings.pipeline_root, id_user, parameters.request_id))
                return held[0]

            record = await joined_thread(acquire)
            if record.data and record.data.get("configuration") != parameters.model_dump(mode="json"):
                raise jobs.JobConflict("Submission UUID belongs to different parameters.")
            submissions.validate_parameters(settings, parameters)
            if record.data:
                if record.data.get("phase") == "rejected":
                    raise jobs.JobConflict("Rejected upload; use a new UUID for a corrected submission.")
                if record.data.get("phase") not in ("sample_stored", "job_stored"):
                    response.status_code = 503
                    return submissions.blocked(parameters, uncertain=True)
            else:
                await joined_thread(lambda: submissions.preflight(session_factory, settings, id_user, parameters))
            async with receive_upload(request, settings) as incoming:
                code, result = await submissions.accept_upload(
                    incoming, record, parameters, settings, id_user, session_factory)
            response.status_code = code
            if result.dispatch_scheduled:
                background_tasks.add_task(jobs.run_job, session_factory, settings, result.job.id_job)
            return result
    except (SubmissionBusy, jobs.JobConflict) as error:
        raise HTTPException(409, str(error)) from None
    except jobs.JobInvalid:
        raise HTTPException(422, "Invalid Job configuration or reference.") from None
    except PipelineUnavailable:
        raise HTTPException(503, "Job execution is disabled or its inputs/tools are unavailable.") from None
    except ValueError:
        raise HTTPException(503, "Submission receipt requires operator reconciliation.") from None
    finally:
        try:
            for record in held:
                await joined_thread(record.close)
        finally:
            upload_slot.release()
