from typing import Literal

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
