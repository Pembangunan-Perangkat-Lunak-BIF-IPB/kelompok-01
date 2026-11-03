import os
from unittest.mock import Mock, MagicMock

import pytest

from scripts import m8_disposable_smoke as smoke


@pytest.fixture
def manifest(tmp_path, monkeypatch):
    for name in tuple(os.environ):
        if name.startswith("PG"):
            monkeypatch.delenv(name)
    forbidden = Mock(side_effect=AssertionError("No database connection is permitted in guard tests"))
    monkeypatch.setattr(smoke.psycopg, "connect", forbidden)
    return {
        "database": smoke.TARGET, "isolated_cluster": True, "database_previously_existed": False,
        "host": "127.0.0.1", "port": 65432, "data_directory": str(tmp_path / "owned-cluster"),
        "nonce": "synthetic-ownership-marker",
    }


@pytest.mark.parametrize("changes", [
    {"database": "genopath_db"}, {"database": "genopath_integration_test"},
    {"database": "postgres"}, {"database": "practicum"},
    {"isolated_cluster": False}, {"isolated_cluster": "true"},
    {"database_previously_existed": True}, {"host": "remote-host"},
])
def test_existing_or_unowned_database_refused_before_connection(manifest, changes):
    with pytest.raises(RuntimeError, match="manifest refused"):
        smoke.connect_checked({**manifest, **changes})
    smoke.psycopg.connect.assert_not_called()


def test_environment_cannot_redirect_disposable_connection(manifest, monkeypatch):
    monkeypatch.setenv("PGHOSTADDR", "untrusted-environment-override")
    with pytest.raises(RuntimeError, match="environment overrides"):
        smoke.connect_checked(manifest)
    smoke.psycopg.connect.assert_not_called()


@pytest.mark.parametrize("index,value", [
    (0, "genopath_db"), (1, "/different-cluster"), (2, "wrong-ownership-marker"),
])
def test_connected_identity_is_verified_before_returning_connection(manifest, monkeypatch, index, value):
    connection = MagicMock()
    result = [smoke.TARGET, manifest["data_directory"], "genopath-isolated:" + manifest["nonce"]]
    result[index] = value
    connection.cursor.return_value.__enter__.return_value.fetchone.return_value = result
    monkeypatch.setattr(smoke.psycopg, "connect", Mock(return_value=connection))
    with pytest.raises(RuntimeError, match="isolation check failed"):
        smoke.connect_checked(manifest)
    connection.close.assert_called_once()
