"""Registration HTTP/transaction tests with mocked sessions, never PostgreSQL."""

import json
import os
import secrets
from types import SimpleNamespace
from unittest.mock import Mock

from fastapi.testclient import TestClient
from pydantic import SecretStr
import pytest
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.security import decode_access_token, verify_password
from app.database import get_session_factory
from app.models import User
from app.schemas.auth import RegisterRequest


class RegistrationCase(SimpleNamespace):
    def __repr__(self):
        return "<RegistrationCase: sensitive test values redacted>"


@pytest.fixture(autouse=True)
def isolated_environment(monkeypatch):
    monkeypatch.setattr(Settings, "model_config", {**Settings.model_config, "env_file": None})
    for name in tuple(os.environ):
        if name == "DATABASE_URL" or name.startswith(("GENOPATH_", "PG")):
            monkeypatch.delenv(name)
    forbidden = Mock(side_effect=AssertionError("Registration tests must not access a database"))
    monkeypatch.setattr("app.database.get_engine", forbidden)
    monkeypatch.setattr("sqlalchemy.create_engine", forbidden)
    monkeypatch.setattr("sqlalchemy.engine.Engine.connect", forbidden)
    monkeypatch.setattr("sqlalchemy.MetaData.create_all", forbidden)
    yield
    forbidden.assert_not_called()


@pytest.fixture
def case(app_factory, caplog):
    settings = Settings(_env_file=None, jwt_secret=SecretStr(secrets.token_urlsafe(48)))
    db = Mock(spec=Session)
    db.scalar.return_value = None
    pending = []
    db.add.side_effect = pending.append
    db.flush.side_effect = lambda: setattr(pending[-1], "id_user", 41)
    application = app_factory(settings)
    application.dependency_overrides[get_session_factory] = lambda: Mock(return_value=db)
    payload = {
        "username": "demo_researcher", "nama": "Peneliti Sintetis",
        "email": "demo@example.invalid", "password": secrets.token_urlsafe(20),
    }
    with TestClient(application) as client:
        yield RegistrationCase(
            app=application, client=client, db=db, pending=pending,
            payload=payload, settings=settings,
        )
    assert payload["password"] not in caplog.text
    assert settings.jwt_secret.get_secret_value() not in caplog.text
    assert all(user.password_hash not in caplog.text for user in pending)


def submit(case, **updates):
    # ASCII escapes allow malformed Unicode to reach server-side validation.
    return case.client.post(
        "/auth/register", content=json.dumps({**case.payload, **updates}),
        headers={"Content-Type": "application/json"},
    )


def test_registration_hashes_password_and_returns_only_safe_fields(case):
    response = submit(case)

    assert response.status_code == 201
    assert response.json() == {
        "id_user": 41, "username": "demo_researcher", "nama": "Peneliti Sintetis",
        "email": "demo@example.invalid", "role": "user",
    }
    user, = case.pending
    assert isinstance(user, User)
    assert user.password_hash.startswith("$argon2id$")
    assert verify_password(case.payload["password"], user.password_hash)
    assert all(value not in response.text for value in (
        case.payload["password"], user.password_hash, case.settings.jwt_secret.get_secret_value(),
    ))
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["pragma"] == "no-cache"
    assert [call[0] for call in case.db.method_calls] == ["scalar", "add", "flush", "commit", "close"]


def test_trimmed_identity_and_lowercase_email_keep_username_case(case):
    response = submit(case, username="  Demo.Researcher-1  ", nama="  Nama Demo  ",
                      email="  DEMO@Example.Invalid  ")
    assert response.status_code == 201
    assert response.json()["username"] == "Demo.Researcher-1"
    assert response.json()["nama"] == "Nama Demo"
    assert response.json()["email"] == "demo@example.invalid"
    compiled = case.db.scalar.call_args.args[0].compile()
    assert 'lower("user".email)' in str(compiled)
    assert set(compiled.params.values()) == {"Demo.Researcher-1", "demo@example.invalid"}


@pytest.mark.parametrize("field", ["username", "nama", "email", "password"])
def test_missing_required_field_is_sanitized_and_never_uses_session(case, field):
    payload = dict(case.payload)
    payload.pop(field)
    response = case.client.post("/auth/register", json=payload)
    assert response.status_code == 422
    assert case.payload["password"] not in response.text
    assert case.pending == []
    case.db.scalar.assert_not_called()
    case.db.commit.assert_not_called()


@pytest.mark.parametrize("field,value", [
    ("username", ""), ("username", "   "), ("username", "ab"),
    ("username", "a" * 65), ("username", "name with spaces"),
    ("username", "name@example.invalid"), ("username", ".name"),
    ("username", None), ("username", 42),
    ("nama", ""), ("nama", "  \t "), ("nama", "a" * 121),
    ("nama", "Name\nOther"), ("nama", None), ("nama", 42),
    ("email", ""), ("email", "   "), ("email", "missing-at.invalid"),
    ("email", "a@@example.invalid"), ("email", "a@localhost"),
    ("email", "a b@example.invalid"), ("email", "a@-example.invalid"),
    ("email", "a@example..invalid"), ("email", "a@exam_ple.invalid"),
    ("email", ".a@example.invalid"), ("email", "a.@example.invalid"),
    ("email", "a..b@example.invalid"), ("email", "a" * 65 + "@example.invalid"),
    ("email", "a@" + "b" * 64 + ".invalid"),
    ("email", "a@" + ".".join(["b" * 60] * 5) + ".invalid"),
    ("email", None), ("email", 42),
    ("password", ""), ("password", "short"), ("password", "a" * 11),
    ("password", "a" * 129), ("password", " " * 12), ("password", "a" * 12 + "\ud800"),
    ("password", None), ("password", 42),
], ids=lambda value: type(value).__name__)
def test_invalid_fields_are_rejected_without_writes(case, field, value):
    response = submit(case, **{field: value})
    assert response.status_code == 422
    assert response.json()["detail"] == [{
        "loc": ["body"], "msg": "Invalid request.", "type": "request_validation_error",
    }]
    case.db.add.assert_not_called()
    case.db.commit.assert_not_called()
    assert case.payload["password"] not in response.text


@pytest.mark.parametrize("password", ["a" * 12, "a" * 128, " " + "a" * 10 + " ", "\u03bb" * 12])
def test_password_boundaries_and_significant_whitespace(case, password):
    response = submit(case, password=password)
    assert response.status_code == 201
    assert verify_password(password, case.pending[0].password_hash)


def test_email_at_maximum_length_is_valid(case):
    email = "aa@" + ".".join(["b" * 60] * 4) + ".invalid"
    assert len(email) == 254
    assert submit(case, email=email).status_code == 201


@pytest.mark.parametrize("field,value", [
    ("role", "admin"), ("role", "user"), ("id_user", 1),
    ("password_hash", "unsupported"), ("is_admin", True),
])
def test_client_cannot_assign_role_or_internal_fields(case, field, value):
    assert submit(case, **{field: value}).status_code == 422
    case.db.add.assert_not_called()
    case.db.commit.assert_not_called()


@pytest.mark.parametrize("conflict", ["username", "email"])
def test_existing_username_or_email_returns_same_conflict(case, conflict):
    def lookup(statement):
        compiled = statement.compile()
        assert '"user".username =' in str(compiled)
        assert 'lower("user".email)' in str(compiled)
        return 17 if case.payload[conflict] in compiled.params.values() else None

    case.db.scalar.side_effect = lookup
    response = submit(case)
    assert response.status_code == 409
    assert response.json() == {"detail": "Username or email already registered."}
    case.db.add.assert_not_called()
    case.db.commit.assert_not_called()
    case.db.rollback.assert_called_once()
    case.db.close.assert_called_once()


def integrity_error(constraint="uq_user_username", state="23505"):
    original = RuntimeError("private-registration-driver-marker")
    original.sqlstate = state
    original.diag = SimpleNamespace(constraint_name=constraint)
    return IntegrityError("private-registration-sql-marker", {}, original)


@pytest.mark.parametrize("phase", ["flush", "commit"])
@pytest.mark.parametrize("constraint", ["uq_user_username", "ix_user_email"])
def test_racing_unique_conflict_rolls_back_and_returns_safe_409(case, phase, constraint):
    getattr(case.db, phase).side_effect = integrity_error(constraint)
    response = submit(case)
    assert response.status_code == 409
    assert response.json() == {"detail": "Username or email already registered."}
    case.db.rollback.assert_called_once()
    case.db.close.assert_called_once()
    case.db.refresh.assert_not_called()
    if phase == "flush":
        case.db.commit.assert_not_called()
    assert "private-registration" not in response.text


@pytest.mark.parametrize("constraint,state", [
    ("user_pkey", "23505"), ("other_check", "23514"), (None, None),
])
def test_other_integrity_errors_are_service_errors(case, constraint, state):
    case.db.flush.side_effect = integrity_error(constraint, state)
    response = submit(case)
    assert response.status_code == 503
    assert response.json() == {"detail": "Service unavailable."}
    case.db.rollback.assert_called_once()
    case.db.commit.assert_not_called()


@pytest.mark.parametrize("phase", ["scalar", "add", "flush", "commit"])
def test_database_failures_roll_back_and_do_not_leak(case, phase):
    getattr(case.db, phase).side_effect = OperationalError(
        "private-registration-sql-marker", {}, RuntimeError("private-registration-driver-marker"),
    )
    response = submit(case)
    assert response.status_code == 503
    assert response.json() == {"detail": "Service unavailable."}
    case.db.rollback.assert_called_once()
    case.db.close.assert_called_once()
    assert case.payload["password"] not in response.text
    if phase != "commit":
        case.db.commit.assert_not_called()


def test_rollback_failure_is_sanitized_service_error(case):
    case.db.flush.side_effect = integrity_error()
    case.db.rollback.side_effect = OperationalError(None, {}, RuntimeError("private-rollback"))
    response = submit(case)
    assert response.status_code == 503
    assert response.json() == {"detail": "Service unavailable."}
    case.db.close.assert_called_once()


def test_response_is_snapshotted_before_commit_expires_orm(case):
    def commit():
        user, = case.pending
        user.id_user = None
        user.username = None
        user.email = None

    case.db.commit.side_effect = commit
    response = submit(case)
    assert response.status_code == 201
    assert response.json()["id_user"] == 41
    case.db.refresh.assert_not_called()
    assert case.db.scalar.call_count == 1


def test_registered_user_can_use_unchanged_login_and_jwt(case):
    assert submit(case).status_code == 201
    user, = case.pending
    case.db.scalar.side_effect = lambda statement: user if statement.compile().params == {
        "username_1": case.payload["username"],
    } else None
    response = case.client.post("/auth/login", json={
        "username": case.payload["username"], "password": case.payload["password"],
    })
    assert response.status_code == 200
    assert set(response.json()) == {"access_token", "token_type"}
    assert response.json()["token_type"] == "bearer"
    claims = decode_access_token(response.json()["access_token"], case.settings)
    assert claims["sub"] == str(user.id_user)
    assert claims["exp"] - claims["iat"] == 240 * 60
    assert case.payload["password"] not in response.text
    assert user.password_hash not in response.text
    assert case.db.commit.call_count == 1


def test_openapi_documents_registration_without_security_or_secret_defaults(case):
    schema = case.client.get("/openapi.json").json()
    operation = schema["paths"]["/auth/register"]["post"]
    assert "security" not in operation
    assert {"201", "409", "422", "503"} <= set(operation["responses"])
    request = schema["components"]["schemas"]["RegisterRequest"]
    assert set(request["required"]) == {"username", "nama", "email", "password"}
    assert request["additionalProperties"] is False
    assert request["properties"]["password"]["writeOnly"] is True
    assert request["properties"]["password"]["minLength"] == 12
    assert set(schema["components"]["schemas"]["RegisterResponse"]["properties"]) == {
        "id_user", "username", "nama", "email", "role",
    }
    case.db.scalar.assert_not_called()


def test_request_representation_redacts_password(case):
    request = RegisterRequest.model_validate(case.payload)
    assert case.payload["password"] not in repr(request)
