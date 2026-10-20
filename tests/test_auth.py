from datetime import datetime, timedelta, timezone
import secrets
from types import SimpleNamespace
from typing import Annotated
from unittest.mock import Mock

from fastapi import Depends
from fastapi.testclient import TestClient
import jwt
from pydantic import SecretStr
import pytest
from sqlalchemy.exc import OperationalError, TimeoutError as DatabaseTimeoutError
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.api.routes import auth
from app.core import security
from app.core.config import Settings
from app.core.security import create_access_token, decode_access_token, hash_password
from app.database import get_db, get_session_factory
from app.models import User


class AuthCase(SimpleNamespace):
    def __repr__(self):
        return "<AuthCase: sensitive test values redacted>"


@pytest.fixture(autouse=True)
def isolated_environment(monkeypatch):
    monkeypatch.setattr(Settings, "model_config", {**Settings.model_config, "env_file": None})
    for name in (
        "DATABASE_URL", "GENOPATH_JWT_SECRET", "GENOPATH_JWT_ALGORITHM",
        "GENOPATH_ACCESS_TOKEN_EXPIRE_MINUTES",
    ):
        monkeypatch.delenv(name, raising=False)
    forbidden = Mock(side_effect=AssertionError("Auth tests must not access PostgreSQL"))
    monkeypatch.setattr("app.database.get_engine", forbidden)
    monkeypatch.setattr("sqlalchemy.engine.Engine.connect", forbidden)
    monkeypatch.setattr("sqlalchemy.MetaData.create_all", forbidden)
    yield
    forbidden.assert_not_called()


@pytest.fixture(scope="module")
def password_pair():
    password = secrets.token_urlsafe(20)
    return password, hash_password(password)


@pytest.fixture
def clock(monkeypatch):
    class FrozenDatetime(datetime):
        current = datetime(2030, 1, 2, tzinfo=timezone.utc)

        @classmethod
        def now(cls, tz=None):
            return cls.current.astimezone(tz) if tz else cls.current.replace(tzinfo=None)

    monkeypatch.setattr(security, "datetime", FrozenDatetime)
    monkeypatch.setattr(jwt.api_jwt, "datetime", FrozenDatetime)
    return FrozenDatetime


@pytest.fixture
def case(app_factory, password_pair, clock, caplog):
    password, password_hash = password_pair
    settings = Settings(_env_file=None, jwt_secret=SecretStr(secrets.token_urlsafe(48)))
    user = User(
        id_user=7, username="Researcher", nama="Test User", email="researcher@example.invalid",
        password_hash=password_hash, role="researcher",
    )
    session = Mock(spec=Session)

    def lookup(statement):
        # Inspect a real SQLAlchemy statement without executing it or using a DB.
        compiled = statement.compile()
        assert '"user".username =' in str(compiled)
        return user if compiled.params == {"username_1": user.username} else None

    session.scalar.side_effect = lookup
    session.get.return_value = user
    factory = Mock(return_value=session)
    application = app_factory(settings)
    application.dependency_overrides[get_session_factory] = lambda: factory

    @application.get("/_test/protected")
    def protected(current_user: Annotated[User, Depends(get_current_user)]):
        return {"id_user": current_user.id_user, "role": current_user.role}

    with TestClient(application) as client:
        yield AuthCase(
            app=application, client=client, settings=settings, user=user, db=session,
            factory=factory, password=password, clock=clock,
        )
    for method in (session.add, session.delete, session.commit, session.flush):
        method.assert_not_called()
    assert all(value not in caplog.text for value in (
        password, password_hash, settings.jwt_secret.get_secret_value(),
    ))


def body(case, **updates):
    return {"username": case.user.username, "password": case.password, **updates}


def authorization(case, **updates):
    now = int(case.clock.current.timestamp())
    claims = {"sub": str(case.user.id_user), "iat": now, "exp": now + 14_400, **updates}
    token = jwt.encode(claims, case.settings.jwt_secret.get_secret_value(), algorithm="HS256")
    return {"Authorization": f"Bearer {token}"}


def assert_unauthorized(response):
    assert response.status_code == 401
    assert response.json() == {"detail": "Could not authenticate."}
    assert response.headers["www-authenticate"] == "Bearer"


def test_login_returns_only_valid_token_for_correct_user(case, caplog):
    response = case.client.post("/auth/login", json=body(case))

    assert response.status_code == 200
    result = response.json()
    assert set(result) == {"access_token", "token_type"}
    assert result["token_type"] == "bearer"
    claims = decode_access_token(result["access_token"], case.settings)
    assert claims["sub"] == str(case.user.id_user)
    assert claims["exp"] - claims["iat"] == 14_400
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["pragma"] == "no-cache"
    assert all(value not in response.text for value in (case.password, case.user.password_hash))
    assert result["access_token"] not in caplog.text
    case.db.close.assert_called_once_with()


@pytest.mark.parametrize("username", ["missing", "researcher", " Researcher", "Researcher ",
                                      "researcher@example.invalid"])
def test_username_is_exact_and_email_is_not_used(case, username):
    assert_unauthorized(case.client.post("/auth/login", json=body(case, username=username)))
    case.db.close.assert_called_once_with()


def test_unknown_user_still_verifies_dummy_hash(case, monkeypatch):
    verify = Mock(wraps=auth.verify_password)
    monkeypatch.setattr(auth, "verify_password", verify)

    assert_unauthorized(case.client.post("/auth/login", json=body(case, username="missing")))
    verify.assert_called_once()
    assert verify.call_args.args[1].startswith("$argon2id$")


def test_wrong_password_and_unknown_user_have_identical_errors(case):
    wrong_password = case.client.post("/auth/login", json=body(case, password=secrets.token_urlsafe(20)))
    unknown_user = case.client.post("/auth/login", json=body(case, username="missing"))

    assert_unauthorized(wrong_password)
    assert_unauthorized(unknown_user)
    assert wrong_password.json() == unknown_user.json()
    assert case.db.close.call_count == 2


@pytest.mark.parametrize("stored_hash", ["broken", "$2b$unsupported", "$argon2id$broken"])
def test_corrupt_password_hash_is_authentication_failure(case, stored_hash):
    case.user.password_hash = stored_hash
    assert_unauthorized(case.client.post("/auth/login", json=body(case)))


@pytest.mark.parametrize("payload", [
    {}, {"username": "Researcher"}, {"password": "synthetic-input"},
    {"username": 7, "password": "synthetic-input"},
    {"username": "Researcher", "password": 7},
    {"username": None, "password": "synthetic-input"},
    {"username": "Researcher", "password": None},
    {"username": "", "password": "synthetic-input"},
    {"username": "Researcher", "password": ""},
    {"username": ["Researcher"], "password": {"private": "synthetic-input"}},
    [], "synthetic-input",
])
def test_invalid_json_schema_returns_sanitized_422(case, payload):
    response = case.client.post("/auth/login", json=payload)

    assert response.status_code == 422
    assert response.json()["detail"] == [{
        "loc": ["body"], "msg": "Invalid request.", "type": "request_validation_error",
    }]
    case.db.scalar.assert_not_called()


def test_extra_fields_and_wrong_types_do_not_echo_credentials(case):
    response = case.client.post("/auth/login", json=body(case, username=123, extra=case.password))
    assert response.status_code == 422
    assert all(value not in response.text for value in (case.password, case.user.password_hash))


@pytest.mark.parametrize("content,content_type", [
    ("", "application/json"), ('{"password":"synthetic-input",', "application/json"),
    ("username=Researcher&password=synthetic-input", "application/x-www-form-urlencoded"),
])
def test_empty_malformed_or_non_json_body_is_rejected(case, content, content_type):
    response = case.client.post("/auth/login", content=content, headers={"Content-Type": content_type})
    assert response.status_code == 422
    assert "synthetic-input" not in response.text
    case.db.scalar.assert_not_called()


def test_valid_bearer_returns_current_database_user(case):
    response = case.client.get("/_test/protected", headers=authorization(case))
    assert response.status_code == 200
    assert response.json() == {"id_user": 7, "role": "researcher"}
    case.db.get.assert_called_once_with(User, 7)
    case.db.close.assert_called_once_with()


@pytest.mark.parametrize("header", [None, "", "Bearer", "Bearer ", "Basic invalid", "Bearer a.b.c",
                                   "Bearer invalid extra"])
def test_missing_or_malformed_bearer_rejected_before_database(case, header):
    headers = {} if header is None else {"Authorization": header}
    assert_unauthorized(case.client.get("/_test/protected", headers=headers))
    case.factory.assert_not_called()


@pytest.mark.parametrize("updates", [{"sub": "0"}, {"sub": "bad"}, {"sub": 7}, {"iat": "invalid"}])
def test_invalid_token_claim_is_401_without_database(case, updates):
    assert_unauthorized(case.client.get("/_test/protected", headers=authorization(case, **updates)))
    case.factory.assert_not_called()


def test_expired_token_is_401_without_database(case):
    headers = authorization(case)
    case.clock.current += timedelta(hours=4)
    assert_unauthorized(case.client.get("/_test/protected", headers=headers))
    case.factory.assert_not_called()


def test_wrong_signature_is_401(case):
    other = case.settings.model_copy(update={"jwt_secret": SecretStr(secrets.token_urlsafe(48))})
    token = create_access_token(7, other)
    assert_unauthorized(case.client.get("/_test/protected", headers={"Authorization": f"Bearer {token}"}))
    case.factory.assert_not_called()


def test_missing_required_claim_is_401(case):
    token = jwt.encode({"sub": "7"}, case.settings.jwt_secret.get_secret_value(), algorithm="HS256")
    assert_unauthorized(case.client.get("/_test/protected", headers={"Authorization": f"Bearer {token}"}))


def test_deleted_user_is_401_and_session_is_closed(case):
    case.db.get.return_value = None
    assert_unauthorized(case.client.get("/_test/protected", headers=authorization(case)))
    case.db.close.assert_called_once_with()


def test_role_is_read_from_database_and_token_role_is_ignored(case):
    headers = authorization(case, role="administrator")
    assert case.client.get("/_test/protected", headers=headers).json()["role"] == "researcher"
    case.user.role = "updated-role"
    assert case.client.get("/_test/protected", headers=headers).json()["role"] == "updated-role"
    assert case.db.get.call_count == 2


@pytest.mark.parametrize("operation", ["login", "protected"])
@pytest.mark.parametrize("error_type", ["driver", "timeout"])
def test_database_failures_are_sanitized_503_and_close_session(case, caplog, operation, error_type):
    error = (
        OperationalError("private-query-marker", {}, RuntimeError("private-driver-marker"))
        if error_type == "driver" else DatabaseTimeoutError("private-driver-marker")
    )
    if operation == "login":
        case.db.scalar.side_effect = error
        response = case.client.post("/auth/login", json=body(case))
    else:
        case.db.get.side_effect = error
        response = case.client.get("/_test/protected", headers=authorization(case))

    assert response.status_code == 503
    assert response.json() == {"detail": "Service unavailable."}
    assert all(marker not in response.text + caplog.text for marker in (
        "private-query-marker", "private-driver-marker",
    ))
    case.db.close.assert_called_once_with()


def test_database_session_creation_failure_is_503(case):
    case.factory.side_effect = OperationalError(None, None, RuntimeError("private-driver-marker"))
    response = case.client.post("/auth/login", json=body(case))
    assert response.status_code == 503
    assert response.json() == {"detail": "Service unavailable."}


def test_missing_database_configuration_is_503(case):
    case.app.dependency_overrides.clear()
    response = case.client.post("/auth/login", json=body(case))
    assert response.status_code == 503
    assert response.json() == {"detail": "Service unavailable."}


def test_missing_token_is_401_even_when_database_is_unconfigured(case):
    case.app.dependency_overrides.clear()
    assert_unauthorized(case.client.get("/_test/protected"))


@pytest.mark.parametrize("operation", ["login", "protected"])
@pytest.mark.parametrize("config", [
    {"jwt_secret": None}, {"jwt_secret": SecretStr("short")},
    {"jwt_algorithm": "HS512"}, {"access_token_expire_minutes": 0},
])
def test_auth_configuration_failure_is_sanitized_503(case, operation, config):
    headers = authorization(case)
    case.app.state.settings = case.settings.model_copy(update=config)
    response = (
        case.client.post("/auth/login", json=body(case)) if operation == "login"
        else case.client.get("/_test/protected", headers=headers)
    )
    assert response.status_code == 503
    assert response.json() == {"detail": "Service unavailable."}
    if operation == "protected":
        case.factory.assert_not_called()


def test_programming_error_is_not_misclassified_as_auth_or_service_failure(case):
    case.db.scalar.side_effect = RuntimeError("programming-error-marker")
    with pytest.raises(RuntimeError, match="programming-error-marker"):
        case.client.post("/auth/login", json=body(case))
    case.db.close.assert_called_once_with()


def test_get_db_override_is_supported(case):
    case.app.dependency_overrides[get_db] = lambda: case.db
    response = case.client.post("/auth/login", json=body(case))
    assert response.status_code == 200
    case.factory.assert_not_called()


def test_get_current_user_override_is_supported(case):
    case.app.dependency_overrides[get_current_user] = lambda: case.user
    response = case.client.get("/_test/protected")
    assert response.status_code == 200
    case.factory.assert_not_called()


def test_login_uses_settings_of_each_app_instance(case, app_factory):
    other_settings = case.settings.model_copy(update={"jwt_secret": SecretStr(secrets.token_urlsafe(48))})
    other_app = app_factory(other_settings)
    other_app.dependency_overrides[get_db] = lambda: case.db
    with TestClient(other_app) as client:
        result = client.post("/auth/login", json=body(case)).json()
    assert decode_access_token(result["access_token"], other_settings)["sub"] == "7"
    with pytest.raises(security.InvalidAccessTokenError):
        decode_access_token(result["access_token"], case.settings)


def test_health_is_public_without_secret_or_database(case):
    case.app.state.settings = Settings(_env_file=None)
    case.app.dependency_overrides.clear()
    response = case.client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    case.factory.assert_not_called()


def test_openapi_exposes_http_bearer_and_json_login(case, app_factory):
    # Production OpenAPI includes the scheme even before business routes exist.
    production_app = app_factory(Settings(_env_file=None))
    schema = production_app.openapi()
    assert set(schema["paths"]) == {"/health", "/auth/login", "/samples/upload"}
    assert schema["components"]["securitySchemes"]["HTTPBearer"] == {
        "type": "http", "scheme": "bearer", "bearerFormat": "JWT",
        "description": "Access token returned by POST /auth/login (JSON login).",
    }
    login = schema["paths"]["/auth/login"]["post"]
    assert set(login["requestBody"]["content"]) == {"application/json"}
    assert not login.get("security")
    assert not schema["paths"]["/health"]["get"].get("security")
    assert not schema.get("security")
    assert {"200", "401", "422", "503"} <= set(login["responses"])
    assert case.app.openapi()["paths"]["/_test/protected"]["get"]["security"] == [{"HTTPBearer": []}]
