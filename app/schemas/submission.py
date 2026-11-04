from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.job import JobParameters, JobResponse
from app.schemas.sample import SampleUploadResponse


class SubmissionRequest(JobParameters):
    # Query strings need numeric/bool conversion. Job JSON remains strict.
    model_config = ConfigDict(strict=False, extra="forbid", hide_input_in_errors=True)
    require_pass: bool = Field(...)
    alignment_strategy: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9][A-Za-z0-9_.-]*$")


class SubmissionResponse(BaseModel):
    request_id: str
    submission_status: Literal["accepted", "replayed", "sample_stored", "reconciliation_required"]
    sample: SampleUploadResponse | None = None
    job: JobResponse | None = None
    dispatch_scheduled: bool = False
    detail: str | None = None


class SubmissionValidationIssue(BaseModel):
    loc: list[str | int]
    msg: str
    type: str


class SubmissionValidationError(BaseModel):
    """Document the existing sanitized RequestValidationError response."""

    detail: list[SubmissionValidationIssue]
