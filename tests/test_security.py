from datetime import datetime, timedelta, timezone
from pathlib import Path
import secrets
from unittest.mock import Mock
import tomllib

import jwt
import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr, ValidationError

from app.core.config import Settings
from app.core import security
from app.core.security import (
    InvalidAccessTokenError,
    SecurityConfigurationError,
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


@pytest.fixture(autouse=True)
def isolated_security_environment(monkeypatch):
    monkeypatch.setattr(Settings, "model_config", {**Settings.model_config, "env_file": None})
    for name in (
        "DATABASE_URL",
        "GENOPATH_JWT_SECRET",
        "GENOPATH_JWT_ALGORITHM",
        "GENOPATH_ACCESS_TOKEN_EXPIRE_MINUTES",
    ):
        monkeypatch.delenv(name, raising=False)
    forbidden = Mock(side_effect=AssertionError("Security tests must not access PostgreSQL"))
    monkeypatch.setattr("sqlalchemy.create_engine", forbidden)
    monkeypatch.setattr("sqlalchemy.engine.Engine.connect", forbidden)
    monkeypatch.setattr("sqlalchemy.MetaData.create_all", forbidden)
    yield
    forbidden.assert_not_called()


@pytest.fixture
def settings():
    # Ephemeral test key only; no application secrets or credentials are read.
    return Settings(_env_file=None, jwt_secret=SecretStr(secrets.token_urlsafe(48)))


@pytest.fixture
def clock(monkeypatch):
    class FrozenDatetime(datetime):
        current = datetime(2030, 1, 2, 3, 4, 5, 678900, tzinfo=timezone.utc)

        @classmethod
        def now(cls, tz=None):
            if tz is None:
                return cls.current.replace(tzinfo=None)
            return cls.current.astimezone(tz)

    monkeypatch.setattr(security, "datetime", FrozenDatetime)
    monkeypatch.setattr(jwt.api_jwt, "datetime", FrozenDatetime)
    return FrozenDatetime


@pytest.fixture
def claims(clock):
    issued_at = int(clock.current.timestamp())
    return {"sub": "7", "iat": issued_at, "exp": issued_at + 240 * 60}


def sign(claims, settings, algorithm="HS256"):
    return jwt.encode(claims, settings.jwt_secret.get_secret_value(), algorithm=algorithm)


def test_password_hash_uses_argon2id_and_random_salts():
    password = secrets.token_urlsafe(20)
    first = hash_password(password)
    second = hash_password(password)

    assert first.startswith("$argon2id$")
    assert first != second
    assert password not in first
    assert verify_password(password, first)
    assert verify_password(password, second)
    assert not verify_password(secrets.token_urlsafe(20), first)


@pytest.mark.parametrize("stored_hash", [
    "", "plaintext", "$2b$unsupported", "$argon2i$unsupported", "$argon2d$unsupported",
    "$argon2id$", "$argon2id$v=19$m=invalid$bad",
    "$argon2id$v=19$m=65536,t=3,p=4$bad$bad", None, 123,
])
def test_malformed_or_unsupported_password_hash_is_rejected(stored_hash):
    assert verify_password(secrets.token_urlsafe(20), stored_hash) is False


def test_non_string_password_is_rejected():
    assert verify_password(None, "$argon2id$invalid") is False


def test_access_token_contract_and_default_ttl(settings, clock, claims):
    token = create_access_token(7, settings)

    assert jwt.get_unverified_header(token)["alg"] == "HS256"
    assert decode_access_token(token, settings) == claims
    assert set(jwt.decode(token, settings.jwt_secret.get_secret_value(), algorithms=["HS256"])) == {
        "sub", "iat", "exp"
    }
    assert claims["exp"] - claims["iat"] == 14_400


def test_configured_ttl_is_used(settings, clock):
    settings = settings.model_copy(update={"access_token_expire_minutes": 15})
    claims = decode_access_token(create_access_token(7, settings), settings)

    assert claims["exp"] - claims["iat"] == 900


def test_token_is_valid_before_expiration_and_rejected_at_expiration(settings, clock):
    token = create_access_token(7, settings)
    issued_at = clock.current.replace(microsecond=0)
    clock.current = issued_at + timedelta(hours=4, microseconds=-1)
    assert decode_access_token(token, settings)["sub"] == "7"

    clock.current = issued_at + timedelta(hours=4)
    with pytest.raises(InvalidAccessTokenError, match="Invalid or expired access token"):
        decode_access_token(token, settings)


def test_wrong_signature_is_rejected(settings, clock):
    token = create_access_token(7, settings)
    other_settings = settings.model_copy(update={"jwt_secret": SecretStr(secrets.token_urlsafe(48))})

    with pytest.raises(InvalidAccessTokenError):
        decode_access_token(token, other_settings)


@pytest.mark.parametrize("algorithm", ["HS384", "HS512", "none"])
def test_unapproved_algorithm_is_rejected(settings, claims, algorithm):
    key = None if algorithm == "none" else settings.jwt_secret.get_secret_value()
    token = jwt.encode(claims, key, algorithm=algorithm)

    with pytest.raises(InvalidAccessTokenError):
        decode_access_token(token, settings)


@pytest.mark.parametrize("missing_claim", ["sub", "iat", "exp"])
def test_required_claim_cannot_be_missing(settings, claims, missing_claim):
    del claims[missing_claim]

    with pytest.raises(InvalidAccessTokenError):
        decode_access_token(sign(claims, settings), settings)


@pytest.mark.parametrize("subject", [
    None, 7, True, "", "0", "-1", "+1", "01", "1.0", "1e2", " 7", "7\n",
    "user", "١", "2147483648", "9" * 100,
])
def test_invalid_subject_is_rejected(settings, claims, subject):
    claims["sub"] = subject

    with pytest.raises(InvalidAccessTokenError):
        decode_access_token(sign(claims, settings), settings)


@pytest.mark.parametrize("id_user", [0, -1, True, "7", None, 2**31])
def test_invalid_user_id_cannot_be_issued(settings, clock, id_user):
    with pytest.raises(ValueError, match="User ID must be"):
        create_access_token(id_user, settings)


def test_largest_postgresql_user_id_is_supported(settings, clock):
    token = create_access_token(2**31 - 1, settings)
    assert decode_access_token(token, settings)["sub"] == str(2**31 - 1)


@pytest.mark.parametrize("claim,value", [
    ("iat", None), ("iat", True), ("iat", "1893553445"), ("iat", 1.5), ("iat", -1),
    ("exp", None), ("exp", True), ("exp", "9999999999"), ("exp", 9999999999.5),
])
def test_invalid_numeric_dates_are_rejected(settings, claims, claim, value):
    claims[claim] = value

    with pytest.raises(InvalidAccessTokenError):
        decode_access_token(sign(claims, settings), settings)


def test_future_issued_at_is_rejected(settings, claims):
    claims["iat"] += 60

    with pytest.raises(InvalidAccessTokenError):
        decode_access_token(sign(claims, settings), settings)


def test_expiration_must_follow_issuance(settings, claims, clock):
    claims["iat"] += 60
    claims["exp"] = claims["iat"]
    clock.current += timedelta(seconds=30)

    with pytest.raises(InvalidAccessTokenError):
        decode_access_token(sign(claims, settings), settings)


@pytest.mark.parametrize("token", ["", "invalid", "a.b.c", None, 123])
def test_malformed_token_has_generic_error(settings, token):
    with pytest.raises(InvalidAccessTokenError) as error:
        decode_access_token(token, settings)

    assert str(error.value) == "Invalid or expired access token."


@pytest.mark.parametrize("secret", [None, "", "short", " " * 64])
@pytest.mark.parametrize("operation", ["create", "decode"])
def test_missing_or_weak_secret_fails_only_when_used(secret, operation):
    settings = Settings(_env_file=None, jwt_secret=secret)

    with pytest.raises(SecurityConfigurationError) as error:
        if operation == "create":
            create_access_token(7, settings)
        else:
            decode_access_token("invalid", settings)

    assert str(error.value) == "JWT secret is missing or too short."
    assert "jwt_secret" not in repr(settings)


@pytest.mark.parametrize("field,value", [
    ("jwt_algorithm", "HS512"), ("jwt_algorithm", "none"),
    ("access_token_expire_minutes", 0), ("access_token_expire_minutes", -1),
    ("access_token_expire_minutes", "invalid"),
])
def test_invalid_jwt_settings_are_rejected(field, value):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, **{field: value})


@pytest.mark.parametrize("field,value", [
    ("jwt_algorithm", "HS512"), ("access_token_expire_minutes", 0),
    ("access_token_expire_minutes", True),
])
@pytest.mark.parametrize("operation", ["create", "decode"])
def test_bypassed_settings_validation_still_fails_closed(settings, field, value, operation):
    settings = settings.model_copy(update={field: value})

    with pytest.raises(SecurityConfigurationError):
        if operation == "create":
            create_access_token(7, settings)
        else:
            decode_access_token("invalid", settings)


def test_unrepresentable_lifetime_has_generic_configuration_error(settings, clock):
    settings = settings.model_copy(update={"access_token_expire_minutes": 10**30})

    with pytest.raises(SecurityConfigurationError, match="lifetime is out of range"):
        create_access_token(7, settings)


def test_invalid_secret_encoding_has_generic_configuration_error(settings):
    settings = settings.model_copy(update={"jwt_secret": SecretStr("\ud800" * 32)})

    with pytest.raises(SecurityConfigurationError) as error:
        create_access_token(7, settings)

    assert str(error.value) == "JWT secret must be valid UTF-8."


def test_jwt_settings_use_prefixed_environment(monkeypatch):
    secret = secrets.token_urlsafe(48)
    monkeypatch.setenv("GENOPATH_JWT_SECRET", secret)
    monkeypatch.setenv("GENOPATH_JWT_ALGORITHM", "HS256")
    monkeypatch.setenv("GENOPATH_ACCESS_TOKEN_EXPIRE_MINUTES", "240")

    settings = Settings(_env_file=None)

    assert isinstance(settings.jwt_secret, SecretStr)
    assert settings.jwt_secret.get_secret_value() == secret
    assert settings.jwt_algorithm == "HS256"
    assert settings.access_token_expire_minutes == 240
    assert secret not in repr(settings)


def test_health_remains_public_without_jwt_secret(app_factory):
    settings = Settings(_env_file=None, database_url=None)
    assert settings.jwt_secret is None
    application = app_factory(settings)

    with TestClient(application) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_security_dependency_manifests_match():
    root = Path(__file__).resolve().parents[1]
    dependencies = tomllib.loads((root / "pyproject.toml").read_text())["project"]["dependencies"]

    assert dependencies == (root / "requirements.txt").read_text().splitlines()
    assert "pwdlib[argon2]>=0.3,<1.0" in dependencies
    assert "PyJWT>=2.10.1,<3.0" in dependencies
    assert "python-multipart==0.0.32" in dependencies
