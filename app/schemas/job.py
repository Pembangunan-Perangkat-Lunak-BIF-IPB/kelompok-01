from datetime import datetime
from typing import Literal
from uuid import UUID
import unicodedata

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_serializer


class JobParameters(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid", hide_input_in_errors=True)

    analysis_name: str | None = Field(default=None, max_length=80)

    @model_serializer(mode="wrap")
    def legacy_compatible_metadata(self, handler):
        data = handler(self)
        if self.analysis_name is None:
            data.pop("analysis_name", None)
        return data

    @field_validator("analysis_name", mode="before")
    @classmethod
    def safe_analysis_name(cls, value):
        if value is None:
            return None
        if not isinstance(value, str) or any(not c.isprintable() for c in value):
            raise ValueError("Nama analisis tidak boleh memuat karakter kontrol.")
        return unicodedata.normalize("NFC", value.strip()) or None

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


class JobCreateRequest(JobParameters):
    id_sample: int = Field(gt=0, le=2**31 - 1)


class JobResponse(BaseModel):
    analysis_number: int
    analysis_name: str
    id_job: int
    id_sample: int
    id_reference_genome: int
    status: Literal["Queued", "Running", "Completed", "Failed"]
    waktu_mulai: datetime | None
    waktu_selesai: datetime | None
    pesan_error: str | None
    execution_mode: Literal["synthetic", "nextflow"] | None
    has_result: bool
