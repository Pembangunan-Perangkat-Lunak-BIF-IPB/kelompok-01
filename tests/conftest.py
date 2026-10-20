import pytest

from app.core.config import Settings


@pytest.fixture
def app_factory(monkeypatch):
    monkeypatch.setattr(Settings, "model_config", {**Settings.model_config, "env_file": None})
    monkeypatch.delenv("DATABASE_URL", raising=False)

    from app.main import create_app

    return create_app
