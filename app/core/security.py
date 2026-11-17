"""Password and JWT primitives, independent of HTTP and database access."""

from datetime import datetime, timedelta, timezone
import re
from typing import TypedDict

import jwt
from argon2 import Type
from jwt.exceptions import InvalidTokenError
from pydantic import SecretStr
from pwdlib import PasswordHash
from pwdlib.exceptions import UnknownHashError
from pwdlib.hashers.argon2 import Argon2Hasher

from app.core.config import Settings


class SecurityConfigurationError(RuntimeError):
    """Authentication cannot proceed with the supplied configuration."""


class InvalidAccessTokenError(ValueError):
    """The access token cannot be trusted."""


class AccessTokenClaims(TypedDict):
    sub: str
    iat: int
    exp: int


# Argon2Hasher uses Argon2id and generates a fresh random salt for each hash.
_password_hash = PasswordHash((Argon2Hasher(type=Type.ID),))
_MAX_USER_ID = 2**31 - 1  # User.id_user is a PostgreSQL INTEGER.


def hash_password(password: str) -> str:
    """Create an encoded Argon2id hash, including its parameters and salt."""
    return _password_hash.hash(password)


def verify_password(password: str, stored_hash: str) -> bool:
    """Reject mismatches and malformed/unsupported hashes without exposing them."""
    if not isinstance(password, str) or not isinstance(stored_hash, str):
        return False
    if not stored_hash.startswith("$argon2id$"):
        return False
    try:
        return _password_hash.verify(password, stored_hash)
    except (UnknownHashError, ValueError):
        return False


def _jwt_key(settings: Settings) -> str:
    secret = settings.jwt_secret
    if not isinstance(secret, SecretStr):
        raise SecurityConfigurationError("JWT secret is missing or too short.")
    key = secret.get_secret_value()
    try:
        key_length = len(key.encode("utf-8"))
    except UnicodeError:
        raise SecurityConfigurationError("JWT secret must be valid UTF-8.") from None
    if not key.strip() or key_length < 32:
        raise SecurityConfigurationError("JWT secret is missing or too short.")
    if settings.jwt_algorithm != "HS256":
        raise SecurityConfigurationError("JWT algorithm must be HS256.")
    ttl = settings.access_token_expire_minutes
    if type(ttl) is not int or ttl <= 0:
        raise SecurityConfigurationError("Access token lifetime must be positive.")
    return key


def _valid_subject(subject: object) -> bool:
    return (
        isinstance(subject, str)
        and re.fullmatch(r"[1-9][0-9]{0,9}", subject) is not None
        and int(subject) <= _MAX_USER_ID
    )


def create_access_token(id_user: int, settings: Settings) -> str:
    """Issue a token for a positive User ID, with a lifetime measured in UTC."""
    key = _jwt_key(settings)
    if type(id_user) is not int or not 1 <= id_user <= _MAX_USER_ID:
        raise ValueError("User ID must be a positive PostgreSQL INTEGER.")
    issued_at = datetime.now(timezone.utc).replace(microsecond=0)
    try:
        expires_at = issued_at + timedelta(minutes=settings.access_token_expire_minutes)
    except OverflowError:
        raise SecurityConfigurationError("Access token lifetime is out of range.") from None
    claims: AccessTokenClaims = {
        "sub": str(id_user),
        "iat": int(issued_at.timestamp()),
        "exp": int(expires_at.timestamp()),
    }
    return jwt.encode(claims, key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str, settings: Settings) -> AccessTokenClaims:
    """Validate a signed token and return only the three supported claims."""
    key = _jwt_key(settings)
    if not isinstance(token, str) or not token:
        raise InvalidAccessTokenError("Invalid or expired access token.")
    try:
        claims = jwt.decode(
            token,
            key,
            algorithms=[settings.jwt_algorithm],
            options={"require": ["sub", "iat", "exp"]},
        )
        if (
            not _valid_subject(claims["sub"])
            or type(claims["iat"]) is not int
            or type(claims["exp"]) is not int
            or claims["iat"] < 0
            or claims["exp"] <= claims["iat"]
        ):
            raise InvalidAccessTokenError("Invalid or expired access token.")
    except (InvalidTokenError, ValueError, TypeError, OverflowError):
        raise InvalidAccessTokenError("Invalid or expired access token.") from None
    return {"sub": claims["sub"], "iat": claims["iat"], "exp": claims["exp"]}
