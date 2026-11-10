"""Public analysis inputs; no filesystem paths or executable configuration."""

from pydantic import BaseModel


class ReferenceOption(BaseModel):
    id_reference_genome: int
    nama_genom: str
    versi: str | None
    sumber: str | None


class JobOptions(BaseModel):
    pipeline_enabled: bool
    alignment_strategy: str | None
    upload_max_bytes: int
    variant_ploidies: list[int]
    references: list[ReferenceOption]
