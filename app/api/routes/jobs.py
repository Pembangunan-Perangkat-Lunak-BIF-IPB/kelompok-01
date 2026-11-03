from collections.abc import Callable
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Path as PathParameter
from sqlalchemy.orm import Session

from app.api.dependencies import get_settings, get_upload_owner_id
from app.core.config import Settings
from app.database import get_session_factory
from app.schemas.auth import ErrorResponse
from app.schemas.job import JobCreateRequest, JobResponse
from app.services import jobs
from app.services.pipeline import PipelineUnavailable

router = APIRouter(prefix="/jobs", tags=["jobs"])
Owner = Annotated[int, Depends(get_upload_owner_id)]
Factory = Annotated[Callable[[], Session], Depends(get_session_factory)]
Configuration = Annotated[Settings, Depends(get_settings)]
JobId = Annotated[int, PathParameter(gt=0, le=2**31 - 1)]


def invoke(function, *args):
    try:
        return function(*args)
    except jobs.JobNotFound:
        raise HTTPException(404, "Requested Job or input was not found.") from None
    except jobs.JobConflict as error:
        raise HTTPException(409, str(error)) from None
    except jobs.JobInvalid:
        raise HTTPException(422, "Invalid Job configuration or reference.") from None
    except PipelineUnavailable:
        raise HTTPException(503, "Job execution is disabled or its configured inputs/tools are unavailable.") from None


ERRORS = {code: {"model": ErrorResponse} for code in (401, 404, 409, 503)}


@router.post("", status_code=201, response_model=JobResponse, responses=ERRORS,
             summary="Create an owned Queued Job after a successful Sample upload",
             description="No execution is launched here. Supply reference, QUAL, FORMAT/DP, ploidy, and exact VCF sample mapping. Server gates default closed.")
def create(payload: JobCreateRequest, owner: Owner, factory: Factory, settings: Configuration):
    return invoke(jobs.create_job, factory, settings, owner, payload)


@router.get("/{id_job}", response_model=JobResponse, responses=ERRORS,
            summary="Poll an owned Job status (not the M9 Result API)")
def status(id_job: JobId, owner: Owner, factory: Factory):
    return invoke(jobs.get_job, factory, id_job, owner)


@router.post("/{id_job}/start", status_code=202, response_model=JobResponse, responses=ERRORS,
             summary="Dispatch a Queued Job to the in-process background runner",
             description="202 acknowledges dispatch; poll status. Dispatch is not durable across server restarts. Workers atomically claim Queued Jobs once.")
def start(id_job: JobId, background_tasks: BackgroundTasks, owner: Owner,
          factory: Factory, settings: Configuration):
    response = invoke(jobs.prepare_dispatch, factory, settings, id_job, owner)
    background_tasks.add_task(jobs.run_job, factory, settings, id_job)
    return response


@router.post("/{id_job}/retry", status_code=201, response_model=JobResponse, responses=ERRORS,
             summary="Create a new Queued Job from an owned Failed Job",
             description="Explicit retry gets a new Job and run directory; no automatic resume or overwrite.")
def retry(id_job: JobId, owner: Owner, factory: Factory, settings: Configuration):
    return invoke(jobs.retry_job, factory, settings, id_job, owner)
