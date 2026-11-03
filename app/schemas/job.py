from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class JobCreateRequest(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid", hide_input_in_errors=True)

    id_sample: int = Field(gt=0, le=2**31 - 1)
    id_reference_genome: int = Field(gt=0, le=2**31 - 1)
    request_id: str = Field(description="Client-generated UUID, reused only for the same submission.")
    vcf_sample: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9][A-Za-z0-9_.-]*$")
    parameter_qual: float = Field(ge=0, allow_inf_nan=False)
    parameter_dp: int = Field(ge=0, le=2**31 - 1)
    require_pass: bool = True
    execution_mode: Literal["synthetic", "nextflow"]
    variant_ploidy: int = Field(ge=1, le=16, description="Explicit caller parameter, not a biological default.")

    @field_validator("request_id")
    @classmethod
    def canonical_request_id(cls, value: str) -> str:
        return str(UUID(value))


class JobResponse(BaseModel):
    id_job: int
    id_sample: int
    id_reference_genome: int
    status: Literal["Queued", "Running", "Completed", "Failed"]
    waktu_mulai: datetime | None
    waktu_selesai: datetime | None
    pesan_error: str | None
    execution_mode: Literal["synthetic", "nextflow"] | None
    has_result: bool
