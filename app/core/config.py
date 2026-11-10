from typing import Literal
from pathlib import Path

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="GENOPATH_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
        hide_input_in_errors=True,
    )

    app_name: str = Field(default="GenoPath API", min_length=1)
    debug: bool = False
    database_url: SecretStr | None = Field(
        default=None, validation_alias="DATABASE_URL", repr=False
    )
    jwt_secret: SecretStr | None = Field(default=None, repr=False)
    jwt_algorithm: Literal["HS256"] = "HS256"
    access_token_expire_minutes: int = Field(default=240, gt=0)
    upload_root: Path = Path("data/samples")
    upload_max_bytes: int = Field(default=1_000_000_000, gt=0, le=1_000_000_000)
    upload_max_decompressed_bytes: int = Field(default=4 * 1024**3, gt=0)
    upload_chunk_bytes: int = Field(default=1024**2, gt=0)
    upload_max_line_bytes: int = Field(default=1024**2, gt=0)
    upload_validation_cpu_seconds: int = Field(default=60, gt=0)
    upload_validation_wall_seconds: float = Field(default=120, gt=0, allow_inf_nan=False)

    # Both gates default closed. No reference or biological strategy is selected implicitly.
    pipeline_enabled: bool = False
    pipeline_max_active_jobs: int | None = Field(default=None, ge=1, le=64)
    pipeline_allow_synthetic: bool = False
    pipeline_root: Path = Path("data/jobs")
    reference_root: Path = Path("data/reference")
    pipeline_timeout_seconds: float = Field(default=3600, gt=0, allow_inf_nan=False)
    pipeline_threads: int = Field(default=1, ge=1, le=64)
    pipeline_alignment_strategy: str | None = Field(default=None, pattern=r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$")
    pipeline_alignment_adapter: Path | None = None
    pipeline_bowtie2_executable: Path | None = None
    pipeline_bowtie2_inspect_executable: Path | None = None
    pipeline_bowtie2_index_prefix: Path | None = None
    pipeline_nextflow_executable: Path | None = None
    pipeline_fastp_executable: Path | None = None
    pipeline_samtools_executable: Path | None = None
    pipeline_bcftools_executable: Path | None = None
    pipeline_nextflow_profile: Literal["local"] = "local"
