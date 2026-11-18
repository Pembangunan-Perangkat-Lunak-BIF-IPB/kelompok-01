import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator


class RegisterRequest(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid", hide_input_in_errors=True)

    username: str = Field(
        min_length=3, max_length=64, pattern=r"^[A-Za-z0-9][A-Za-z0-9_.-]*$",
        description="Case-sensitive username; letters, digits, underscore, dot, or hyphen.",
    )
    nama: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=254, description="Unquoted ASCII email, stored lowercase.")
    password: SecretStr = Field(
        min_length=12, max_length=128,
        description="12-128 characters; whitespace-only passwords are rejected. Never trimmed.",
    )

    @field_validator("username", "nama", "email", mode="before")
    @classmethod
    def trim_identity(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("nama")
    @classmethod
    def validate_name(cls, value: str) -> str:
        if any(not character.isprintable() for character in value):
            raise ValueError("Name must not contain control characters.")
        return value

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        # Deliberately bounded ASCII mailbox validation without a new dependency.
        local, separator, domain = value.rpartition("@")
        if (
            not separator or not 1 <= len(local) <= 64
            or not re.fullmatch(r"[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+", local)
            or local.startswith(".") or local.endswith(".") or ".." in local
            or "." not in domain
            or any(not re.fullmatch(r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?", label)
                   for label in domain.split("."))
            or not re.fullmatch(r"[A-Za-z]{2,63}", domain.rsplit(".", 1)[-1])
        ):
            raise ValueError("A valid ASCII email with a dotted domain is required.")
        return value.lower()

    @field_validator("password")
    @classmethod
    def reject_blank_password(cls, value: SecretStr) -> SecretStr:
        password = value.get_secret_value()
        if not password.strip():
            raise ValueError("Password must not be blank.")
        try:
            password.encode("utf-8")
        except UnicodeError:
            raise ValueError("Password must be valid UTF-8.") from None
        return value


class RegisterResponse(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid", from_attributes=True)

    id_user: int = Field(gt=0)
    username: str
    nama: str
    email: str
    role: Literal["user"]


class LoginRequest(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid", hide_input_in_errors=True)

    username: str = Field(min_length=1)
    password: SecretStr = Field(min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"


class ErrorResponse(BaseModel):
    detail: str


class ProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_user: int
    username: str
    nama: str
