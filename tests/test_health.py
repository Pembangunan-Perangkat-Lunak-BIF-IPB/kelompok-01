from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


def test_health_returns_ok() -> None:
    application = create_app(Settings(_env_file=None, debug=False))

    with TestClient(application) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/json"
    assert response.json() == {"status": "ok"}


def test_health_is_documented_in_openapi() -> None:
    application = create_app(Settings(_env_file=None, debug=False))

    with TestClient(application) as client:
        response = client.get("/openapi.json")

    assert response.status_code == 200
    operation = response.json()["paths"]["/health"]["get"]
    assert operation["responses"]["200"]["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/HealthResponse"
    }


def test_app_instances_have_independent_settings() -> None:
    first = create_app(Settings(_env_file=None, app_name="First API", debug=False))
    second = create_app(Settings(_env_file=None, app_name="Second API", debug=False))

    assert first is not second
    assert first.title == "First API"
    assert second.title == "Second API"
    assert first.state.settings is not second.state.settings


def test_settings_read_environment(monkeypatch) -> None:
    monkeypatch.setenv("GENOPATH_APP_NAME", "GenoPath Local")
    monkeypatch.setenv("GENOPATH_DEBUG", "false")

    settings = Settings(_env_file=None)

    assert settings.app_name == "GenoPath Local"
    assert settings.debug is False
