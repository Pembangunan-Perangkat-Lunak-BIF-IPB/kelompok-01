import subprocess
import sys
from pathlib import Path
from typing import Annotated
from unittest.mock import Mock

import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.database import get_db, get_engine, get_session_factory


def test_import_and_app_creation_do_not_access_database(tmp_path):
    repository = Path(__file__).resolve().parents[1]
    script = """
import sys
from unittest.mock import patch

sys.path.insert(0, sys.argv[1])

from app.core.config import Settings

Settings.model_config = {**Settings.model_config, "env_file": None}

with (
    patch("sqlalchemy.create_engine", side_effect=AssertionError("Engine created")),
    patch("sqlalchemy.engine.Engine.connect", side_effect=AssertionError("Database connected")),
    patch("sqlalchemy.MetaData.create_all", side_effect=AssertionError("DDL executed")),
):
    from app import models
    from app.main import create_app

    application = create_app(Settings(_env_file=None))
    assert application.state.settings.database_url is None
    assert set(models.Base.metadata.tables) == {
        "user", "sample", "reference_genome", "job", "analysis", "variant", "genotype"
    }
"""
    result = subprocess.run(
        [sys.executable, "-B", "-c", script, str(repository)],
        cwd=tmp_path,
        env={},
        capture_output=True,
        text=True,
        timeout=30,
    )

    assert result.returncode == 0, result.stderr


@pytest.mark.parametrize("request_fails", [False, True])
def test_database_session_closes_after_request(request_fails):
    session = Mock(spec=Session)
    dependency = get_db(Mock(return_value=session))

    assert next(dependency) is session

    if request_fails:
        with pytest.raises(RuntimeError, match="Request failed"):
            dependency.throw(RuntimeError("Request failed"))
    else:
        with pytest.raises(StopIteration):
            next(dependency)

    session.close.assert_called_once_with()
    session.commit.assert_not_called()


def test_database_dependency_can_be_overridden(app_factory, monkeypatch):
    application = app_factory(Settings(_env_file=None, database_url=None))
    session = Mock(spec=Session)

    def fail_if_engine_created(*args, **kwargs):
        raise AssertionError("Database engine must not be created")

    monkeypatch.setattr("app.database.get_engine", fail_if_engine_created)
    application.dependency_overrides[get_db] = lambda: session

    @application.get("/database-probe")
    def database_probe(db: Annotated[Session, Depends(get_db)]):
        return {"isolated": db is session}

    with TestClient(application) as client:
        response = client.get("/database-probe")

    assert response.status_code == 200
    assert response.json() == {"isolated": True}


def test_database_configuration_is_only_required_for_database_dependency(app_factory):
    application = app_factory(Settings(_env_file=None, database_url=None))
    request = Mock()
    request.app = application

    with pytest.raises(RuntimeError, match="DATABASE_URL is required"):
        get_session_factory(request)


def test_settings_preserve_database_environment_name(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "")
    settings = Settings(_env_file=None)

    assert settings.database_url is not None
    assert settings.database_url.get_secret_value() == ""
    assert "database_url" not in repr(settings)


@pytest.mark.parametrize("url", ["postgresql://", "postgresql+psycopg2://"])
def test_database_driver_must_be_explicit(url, monkeypatch):
    create_engine = Mock(side_effect=AssertionError("Unexpected engine creation"))
    monkeypatch.setattr("app.database.create_engine", create_engine)

    with pytest.raises(RuntimeError, match=r"postgresql\+psycopg://"):
        get_engine(SecretStr(url))

    create_engine.assert_not_called()
