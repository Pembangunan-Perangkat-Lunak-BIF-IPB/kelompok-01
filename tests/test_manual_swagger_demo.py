"""Offline helper tests: no Settings from disk, sockets, servers, or real database."""

import asyncio
from contextlib import contextmanager, nullcontext
from datetime import datetime
import importlib.util
import json
import logging
import os
import stat
from types import SimpleNamespace
from unittest.mock import Mock
from uuid import uuid4
import warnings

import pytest
from pydantic import SecretStr
from pydantic_settings.sources import DotEnvSettingsSource
from sqlalchemy.engine import Engine, URL
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import Settings
from app.models import Sample, User
from scripts import manual_swagger_demo as demo


FASTQ = b"@unit\nAC\n+\nII\n"


@pytest.fixture(autouse=True)
def offline(monkeypatch, tmp_path):
    def forbidden(*args, **kwargs):
        raise AssertionError("Offline helper tests must not access services or configuration")

    monkeypatch.setattr(demo, "STATE_ROOT", tmp_path)
    monkeypatch.setattr(Settings, "model_config", {**Settings.model_config, "env_file": None})
    for name in tuple(os.environ):
        if name == "DATABASE_URL" or name.startswith(("GENOPATH_", "PG")):
            monkeypatch.delenv(name)

    def no_dotenv(source):
        assert source.env_file is None
        return {}

    monkeypatch.setattr(DotEnvSettingsSource, "_read_env_files", no_dotenv)
    monkeypatch.setattr(demo.smoke, "load_configuration", forbidden)
    monkeypatch.setattr(demo.smoke.psycopg, "connect", forbidden)
    monkeypatch.setattr("app.database.get_engine", forbidden)
    monkeypatch.setattr("sqlalchemy.create_engine", forbidden)
    monkeypatch.setattr(Engine, "connect", forbidden)
    monkeypatch.setattr(Engine, "raw_connection", forbidden)
    monkeypatch.setattr("uvicorn.run", forbidden)
    monkeypatch.setattr("subprocess.Popen", forbidden)
    disabled = logging.root.manager.disable
    yield
    logging.disable(disabled)


@pytest.fixture
def ledger():
    return demo.Manifest.create()


def owned_user(ledger):
    header = ledger.state()["created"]
    return {"kind": "user", "id_user": 71, "username": header["username"],
            "email": header["email"], "nama": demo.NAME, "role": "user"}


def confirm(ledger, purpose, rows):
    tx = uuid4().hex
    ledger.record("commit_intent", tx=tx, purpose=purpose, rows=rows)
    ledger.record("commit_confirmed", tx=tx)


def seed(ledger):
    row = owned_user(ledger)
    confirm(ledger, "seed", [row])
    return row


def started(ledger):
    token = uuid4().hex
    ledger.record("server_started", token=token, pid=os.getpid())
    return token


def uploaded(ledger):
    seed(ledger)
    token = started(ledger)
    key = uuid4().hex + ".fastq"
    file = ledger.storage / key
    file.write_bytes(FASTQ)
    file.chmod(0o600)
    row = {"kind": "sample", "id_sample": 81, "id_user": 71, "key": key,
           "filename": "unit.fastq", "size": len(FASTQ), "database_time": "2026-10-18T00:00:00"}
    confirm(ledger, "upload", [row])
    ledger.record("server_stopped", token=token)
    return row


def test_import_does_not_load_settings_connect_or_create_storage(monkeypatch):
    monkeypatch.setattr(Settings, "__init__", Mock(side_effect=AssertionError("no settings at import")))
    before = set(demo.STATE_ROOT.iterdir())
    spec = importlib.util.spec_from_file_location("offline_demo_import", demo.__file__)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)  # Non-main import must have no external side effects.
    assert set(demo.STATE_ROOT.iterdir()) == before


def test_manifest_private_unique_and_reopenable(ledger):
    another = demo.Manifest.create()
    assert another.root != ledger.root
    assert ledger.root.parent == demo.STATE_ROOT
    for path, mode in ((ledger.root, 0o700), (ledger.storage, 0o700),
                       (ledger.path, 0o600), (ledger.root / "server.lock", 0o600)):
        assert stat.S_IMODE(path.stat().st_mode) == mode
    assert demo.Manifest(ledger.path).state() == ledger.state()
    assert not list(ledger.storage.iterdir())


def test_configurable_persistent_root_is_private_and_reopens_without_global_setting(tmp_path):
    state_root = tmp_path / "persistent-demo-state"
    first = demo.Manifest.create(state_root=state_root)
    row = uploaded(first)
    info = demo.smoke.inspect_file(first.storage, row["key"])
    first.record("verified", files={row["key"]: info})
    tx = uuid4().hex
    first.record("server_started", token=tx, pid=os.getpid())
    reopened = demo.Manifest(first.path, state_root=state_root)
    assert reopened.root.parent == state_root
    assert stat.S_IMODE(state_root.stat().st_mode) == 0o700
    assert reopened.state() == first.state()
    assert reopened.state()["samples"] == [row]
    assert reopened.state()["verified"] == {row["key"]: info}
    assert demo.smoke.inspect_file(reopened.storage, row["key"]) == info
    # Losing the OS process/lock does not erase an unfinished lifecycle after reopen.
    with pytest.raises(demo.smoke.SmokeFailure, match="stop_and_verify"):
        demo.cleanup({}, reopened)
    with reopened.exclusive():
        with pytest.raises(demo.smoke.SmokeFailure, match="active"):
            with first.exclusive():
                pass


@pytest.mark.parametrize("kind", ["relative", "traversal", "repo", "wrong_mode", "wrong_owner", "symlink", "ancestor"])
def test_state_root_rejects_unsafe_paths_without_changing_foreign_data(tmp_path, monkeypatch, kind):
    protected = tmp_path / "protected"
    protected.mkdir(mode=0o700)
    marker = protected / "keep.txt"
    marker.write_bytes(b"unit unrelated data")
    candidate = protected
    if kind == "relative":
        candidate = "relative-demo-state"
    elif kind == "traversal":
        candidate = tmp_path / "parent" / ".." / "state"
    elif kind == "repo":
        candidate = demo.ROOT / "demo-state"
    elif kind == "wrong_mode":
        protected.chmod(0o755)
    elif kind == "wrong_owner":
        monkeypatch.setattr(os, "geteuid", lambda: protected.stat().st_uid + 1)
    elif kind == "symlink":
        candidate = tmp_path / "link"
        candidate.symlink_to(protected, target_is_directory=True)
    elif kind == "ancestor":
        link = tmp_path / "link"
        link.symlink_to(protected, target_is_directory=True)
        candidate = link / "state"
    before = set(protected.iterdir())
    mode = stat.S_IMODE(protected.stat().st_mode)
    with pytest.raises((OSError, demo.smoke.SmokeFailure)):
        demo.Manifest.create(state_root=candidate)
    assert set(protected.iterdir()) == before
    assert marker.read_bytes() == b"unit unrelated data"
    assert stat.S_IMODE(protected.stat().st_mode) == mode


def test_state_root_replacement_is_rejected_on_existing_handle(tmp_path):
    base = tmp_path / "persistent-state"
    ledger = demo.Manifest.create(state_root=base)
    moved = tmp_path / "moved-state"
    base.rename(moved)
    base.mkdir(mode=0o700)
    with pytest.raises(demo.smoke.SmokeFailure, match="state_root_replaced"):
        ledger.state()
    assert (moved / ledger.root.name / "manifest.jsonl").exists()


def test_manifest_cannot_be_reopened_under_wrong_configured_root(ledger, tmp_path):
    with pytest.raises(demo.smoke.SmokeFailure, match="location_refused"):
        demo.Manifest(ledger.path, state_root=tmp_path / "other-state")


def test_state_parent_and_run_entry_are_fsynced_before_init_returns(tmp_path, monkeypatch):
    state_root = tmp_path / "persistent-state"
    identities = []
    real_sync = os.fsync

    def sync(descriptor):
        identities.append(demo.inode(os.fstat(descriptor)))
        real_sync(descriptor)

    monkeypatch.setattr(os, "fsync", sync)
    ledger = demo.Manifest.create(state_root=state_root)
    assert demo.inode(tmp_path.stat()) in identities
    assert demo.inode(state_root.stat()) in identities
    assert demo.inode(ledger.root.stat()) in identities
    assert demo.inode(ledger.path.stat()) in identities


@pytest.mark.parametrize("tail", [b'{"phase":', b'{"phase":"server_started"}', b"invalid\n"])
def test_partial_or_corrupt_manifest_blocks_without_repair(ledger, tail):
    with ledger.path.open("ab") as file:
        file.write(tail)
    before = ledger.path.read_bytes()
    with pytest.raises((demo.smoke.SmokeFailure, json.JSONDecodeError)):
        demo.Manifest(ledger.path)
    assert ledger.path.read_bytes() == before


@pytest.mark.parametrize("target", ["root", "storage", "manifest", "lock"])
def test_replaced_or_symlinked_owned_paths_are_refused(ledger, target, tmp_path):
    if target == "root":
        old = ledger.root.with_name(ledger.root.name + "-old")
        ledger.root.rename(old)
        ledger.root.symlink_to(old, target_is_directory=True)
        action = ledger.state
    elif target == "storage":
        ledger.storage.rmdir()
        other = tmp_path / "foreign-storage"
        other.mkdir()
        ledger.storage.symlink_to(other, target_is_directory=True)
        action = ledger.state
    elif target == "manifest":
        old = ledger.path.with_suffix(".old")
        ledger.path.rename(old)
        ledger.path.symlink_to(old)
        action = ledger.state
    else:
        lock = ledger.root / "server.lock"
        lock.rename(lock.with_suffix(".old"))
        lock.write_bytes(b"")
        lock.chmod(0o600)
        action = lambda: ledger.exclusive().__enter__()
    with pytest.raises((OSError, demo.smoke.SmokeFailure)):
        action()


def test_active_server_lock_rejects_other_command(ledger):
    other = demo.Manifest(ledger.path)
    with ledger.exclusive():
        with pytest.raises(demo.smoke.SmokeFailure, match="active"):
            with other.exclusive():
                pytest.fail("Other command acquired server lock")
    with other.exclusive():
        pass


@pytest.mark.parametrize("phase", ["request_interrupted", "server_uncertain"])
def test_unsafe_event_and_unfinished_server_block_cleanup(ledger, phase):
    seed(ledger)
    started(ledger)
    ledger.record(phase)
    with pytest.raises(demo.smoke.SmokeFailure):
        demo.cleanup({}, demo.Manifest(ledger.path))


def test_pending_commit_survives_reopen_and_blocks_writes_and_cleanup(ledger):
    tx = uuid4().hex
    ledger.record("commit_intent", tx=tx, purpose="seed", rows=[owned_user(ledger)])
    reopened = demo.Manifest(ledger.path)
    assert tx in reopened.state()["pending"]
    with pytest.raises(demo.smoke.SmokeFailure, match="reconciliation"):
        demo.cleanup({}, reopened)
    with pytest.raises(demo.smoke.SmokeFailure):
        reopened.record("commit_intent", tx=uuid4().hex, purpose="seed", rows=[owned_user(ledger)])


@pytest.mark.parametrize("failure", ["short_write", "write", "fsync"])
def test_manifest_write_failure_taints_even_a_complete_looking_event(ledger, monkeypatch, failure):
    seed(ledger)
    started(ledger)
    if failure == "short_write":
        real_write = os.write
        monkeypatch.setattr(os, "write", lambda descriptor, data: real_write(descriptor, data[:5]))
    else:
        monkeypatch.setattr(os, failure, Mock(side_effect=OSError("unit-io-failure")))
    with pytest.raises((OSError, demo.smoke.SmokeFailure)):
        ledger.record("request_interrupted")
    assert ledger.write_failed.is_set()
    with pytest.raises((OSError, json.JSONDecodeError, demo.smoke.SmokeFailure)):
        demo.safe_state(ledger)


def test_manifest_unknown_or_sensitive_fields_are_not_appended(ledger):
    before = ledger.path.read_bytes()
    with pytest.raises(demo.smoke.SmokeFailure):
        ledger.record("request_interrupted", password="synthetic-never-persist")
    assert ledger.path.read_bytes() == before


def test_short_reads_cannot_hide_trailing_commit_intent(ledger, monkeypatch):
    tx = uuid4().hex
    ledger.record("commit_intent", tx=tx, purpose="seed", rows=[owned_user(ledger)])
    real_read = os.read
    monkeypatch.setattr(os, "read", lambda descriptor, size: real_read(descriptor, min(size, 7)))
    assert tx in demo.Manifest(ledger.path).state()["pending"]


def parameters():
    return {"dbname": demo.smoke.DATABASE, "host": "unit-host.invalid", "port": 5432,
            "user": "unit-role", "password": None, "connect_timeout": 5,
            "application_name": "unit-test", "options": demo.smoke.OPTIONS}


@pytest.mark.parametrize("query", [{}, {"dbname": "other"}, {"options": "other"}, {"service": "other"}])
def test_configuration_uses_fresh_testing_target_and_refuses_query_options(monkeypatch, query):
    # No credentials and no actual Settings loading. Construct an in-memory URL only.
    source = URL.create("postgresql+psycopg", username="unit-role", host="unit-host.invalid",
                        database="genopath_db", query=query)
    configured = SimpleNamespace(database_url=SecretStr(source.render_as_string()))
    monkeypatch.setattr("app.core.config.Settings", Mock(return_value=configured))
    # The real parser is loaded in an isolated module; offline fixture still blocks native connections.
    spec = importlib.util.spec_from_file_location("offline_smoke_parser", demo.smoke.__file__)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    if query:
        with pytest.raises(module.SmokeFailure, match="query_options"):
            module.load_configuration()
    else:
        _, config = module.load_configuration()
        assert config["dbname"] == demo.smoke.DATABASE
        assert "database" not in config and "service" not in config


def test_pg_environment_override_refused_before_settings(monkeypatch):
    settings = Mock(side_effect=AssertionError("Should reject environment first"))
    monkeypatch.setattr("app.core.config.Settings", settings)
    monkeypatch.setenv("PGDATABASE", "genopath_db")
    spec = importlib.util.spec_from_file_location("offline_smoke_environment", demo.smoke.__file__)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    with pytest.raises(module.SmokeFailure, match="environment_override"):
        module.load_configuration()
    settings.assert_not_called()


@pytest.mark.parametrize("mutation", ["database", "options", "extra"])
def test_connection_target_and_options_rejected_before_native_connect(monkeypatch, mutation):
    native = Mock(side_effect=AssertionError("must be rejected before connecting"))
    monkeypatch.setattr(demo.smoke.psycopg, "connect", native)
    config = parameters()
    if mutation == "database":
        config["dbname"] = "genopath_db"
    elif mutation == "options":
        config["options"] = "-c search_path=other"
    else:
        config["service"] = "untrusted"
    with pytest.raises(demo.smoke.SmokeFailure):
        demo.smoke.connect_read_only(config)
    native.assert_not_called()


def test_locked_connections_block_default_engine_raw_and_native_fallback(monkeypatch):
    approved, foreign = object(), object()
    connect, raw, native = Mock(return_value="mock-connection"), Mock(return_value="mock-raw"), Mock()
    monkeypatch.setattr(Engine, "connect", connect)
    monkeypatch.setattr(Engine, "raw_connection", raw)
    monkeypatch.setattr(demo.smoke.psycopg, "connect", native)
    import sqlalchemy
    import app.database
    with demo.locked_connections(approved):
        assert Engine.connect(approved) == "mock-connection"
        assert Engine.raw_connection(approved) == "mock-raw"
        for action in (lambda: Engine.connect(foreign), lambda: Engine.raw_connection(foreign),
                       lambda: app.database.get_engine(None), lambda: sqlalchemy.create_engine("refused"),
                       lambda: demo.smoke.psycopg.connect("dbname=genopath_db"),
                       lambda: demo.smoke.psycopg.connect(**{**parameters(), "dbname": "genopath_db", "autocommit": False})):
            with pytest.raises(demo.smoke.SmokeFailure):
                action()
        native.assert_not_called()
        demo.smoke.connect_read_only(parameters())
        assert native.call_args.kwargs["dbname"] == demo.smoke.DATABASE
    assert connect.call_count == raw.call_count == native.call_count == 1


@pytest.mark.parametrize("identity_ok", [False, True])
def test_engine_creator_checks_identity_read_only_before_read_write(monkeypatch, identity_ok):
    engine = Mock()
    create = Mock(return_value=engine)
    monkeypatch.setattr("sqlalchemy.create_engine", create)
    connection = Mock()
    monkeypatch.setattr(demo.smoke, "connect_read_only", Mock(return_value=connection))
    identities = []

    def identity(cursor):
        identities.append(connection.read_only)
        if not identity_ok:
            raise demo.smoke.SmokeFailure("database_identity_mismatch")
        return "on"

    connection.read_only = True
    connection.cursor.return_value.__enter__ = Mock(return_value=Mock())
    connection.cursor.return_value.__exit__ = Mock(return_value=False)
    monkeypatch.setattr(demo.smoke, "identity", identity)
    demo.smoke.guarded_factory(parameters())
    creator = create.call_args.kwargs["creator"]
    if identity_ok:
        assert creator() is connection
        assert connection.read_only is False
        connection.rollback.assert_called_once()
    else:
        with pytest.raises(demo.smoke.SmokeFailure):
            creator()
        assert connection.read_only is True
        connection.close.assert_called_once()
    assert identities == [True]


@pytest.mark.parametrize("wrong", ["database", "revision"])
def test_session_write_guard_rejects_wrong_identity(monkeypatch, wrong):
    monkeypatch.setattr("sqlalchemy.create_engine", Mock(return_value=Mock()))
    _, _, check = demo.smoke.guarded_factory(parameters())
    session = Mock()
    session.scalar.return_value = "genopath_db" if wrong == "database" else demo.smoke.DATABASE
    session.execute.return_value.all.return_value = [("other_revision",)]
    with pytest.raises(demo.smoke.SmokeFailure):
        check(session)


def test_app_auth_and_upload_use_only_overridden_factory(ledger):
    from app.api.dependencies import get_current_user, get_upload_owner_id
    from app.database import get_db, get_session_factory
    factory = Mock()
    with demo.demo_app(Settings(_env_file=None), ledger, factory) as app:
        assert app.state.settings.database_url is None
        assert app.state.settings.debug is False
        assert app.state.settings.upload_root == ledger.storage
        assert app.state.settings.upload_max_bytes == 1_000_000_000
        assert app.dependency_overrides[get_session_factory]() is factory
        # Inspect endpoint routers without requests or version-specific include wrappers.
        from app.api.routes import auth, samples
        routes = {route.path: route for route in (*auth.router.routes, *samples.router.routes)}

        def calls(dependency):
            return [dependency.call, *(call for child in dependency.dependencies for call in calls(child))]

        assert get_db in calls(routes["/auth/login"].dependant)
        upload = calls(routes["/samples/upload"].dependant)
        assert get_current_user in upload and get_upload_owner_id in upload
        assert upload.count(get_session_factory) >= 2
        schema = app.openapi()
        assert schema["components"]["securitySchemes"]["HTTPBearer"]["scheme"] == "bearer"
        assert "multipart/form-data" in schema["paths"]["/samples/upload"]["post"]["requestBody"]["content"]


def mock_tracked_factory(monkeypatch, ledger, purpose, fail_commit=False):
    engine, check = Mock(), Mock()
    monkeypatch.setattr(demo.smoke, "guarded_factory", Mock(return_value=(engine, sessionmaker(class_=Session), check)))
    _, factory, _ = demo.tracked_factory({}, ledger, purpose)
    monkeypatch.setattr(Session, "flush", lambda *args: None)

    def commit(session):
        assert ledger.state()["pending"]  # Durable intent precedes real COMMIT.
        if fail_commit:
            raise RuntimeError("synthetic-commit-failure")

    monkeypatch.setattr(Session, "commit", commit)
    return factory.class_(bind=None), check


@pytest.mark.parametrize("fail_commit", [False, True])
def test_tracked_commit_confirmed_or_left_pending(ledger, monkeypatch, fail_commit):
    session, check = mock_tracked_factory(monkeypatch, ledger, "seed", fail_commit)
    session.demo_rows = [owned_user(ledger)]
    if fail_commit:
        with pytest.raises(RuntimeError, match="synthetic-commit"):
            session.commit()
        assert ledger.state()["pending"] and ledger.state()["user"] is None
    else:
        session.commit()
        assert not ledger.state()["pending"] and ledger.state()["user"] == owned_user(ledger)
    check.assert_called_once_with(session)


def test_failed_intent_prevents_commit(ledger, monkeypatch):
    session, _ = mock_tracked_factory(monkeypatch, ledger, "seed")
    session.demo_rows = [owned_user(ledger)]
    commit = Mock()
    monkeypatch.setattr(Session, "commit", commit)
    monkeypatch.setattr(os, "fsync", Mock(side_effect=OSError("unit-fsync")))
    with pytest.raises(OSError):
        session.commit()
    commit.assert_not_called()
    assert ledger.write_failed.is_set()


def test_confirmation_failure_preserves_pending_intent(ledger, monkeypatch):
    session, _ = mock_tracked_factory(monkeypatch, ledger, "seed")
    session.demo_rows = [owned_user(ledger)]
    original = ledger.record

    def record(phase, **data):
        if phase == "commit_confirmed":
            raise OSError("unit-confirmation-failure")
        original(phase, **data)

    monkeypatch.setattr(ledger, "record", record)
    with pytest.raises(OSError):
        session.commit()
    assert demo.Manifest(ledger.path).state()["pending"]


def test_session_events_capture_owned_rows_and_reject_foreign_owner(ledger, monkeypatch):
    seed(ledger)
    started(ledger)
    session, _ = mock_tracked_factory(monkeypatch, ledger, "upload")
    sample = Sample(id_sample=81, id_user=71, nama_berkas="unit.fastq",
                    path_penyimpanan=uuid4().hex + ".fastq", ukuran_berkas=len(FASTQ),
                    waktu_unggah=datetime(2026, 10, 18))
    session.add(sample)
    session.dispatch.before_flush(session, None, None)
    session.dispatch.after_flush(session, None)
    assert session.demo_rows == [demo.sample_row(sample)]
    sample.id_user = 999
    with pytest.raises(demo.smoke.SmokeFailure):
        session.dispatch.before_flush(session, None, None)


def test_auth_session_and_sample_session_are_distinct_on_same_guarded_engine(ledger, monkeypatch):
    from app.api.dependencies import get_current_user, get_upload_owner_id
    from app.database import get_db
    seed(ledger)
    engine = Mock()
    monkeypatch.setattr(demo.smoke, "guarded_factory", Mock(return_value=(engine, sessionmaker(class_=Session), Mock())))
    _, factory, _ = demo.tracked_factory({}, ledger, "upload")
    auth_dependency = get_db(factory)
    auth_session = next(auth_dependency)
    write_session = factory()
    assert auth_session is not write_session
    assert auth_session.bind is write_session.bind is engine
    auth_session.get = Mock(return_value=User(id_user=71))
    closed = Mock(wraps=auth_session.close)
    auth_session.close = closed
    user = get_current_user(71, auth_session)
    assert get_upload_owner_id(user, auth_session) == 71
    closed.assert_called_once()
    auth_dependency.close()
    write_session.close()


@pytest.mark.parametrize("failure", [asyncio.CancelledError, RuntimeError])
@pytest.mark.parametrize("write_fails", [False, True])
def test_interruption_always_taints_request_even_if_manifest_write_fails(ledger, monkeypatch, failure, write_fails):
    seed(ledger)
    started(ledger)
    primary = failure()

    async def app(scope, receive, send):
        raise primary

    if write_fails:
        monkeypatch.setattr(ledger, "_append", Mock(side_effect=OSError("unit-ledger-failure")))
    requests = demo.Requests(app, ledger)
    with pytest.raises(failure) as caught:
        asyncio.run(requests({"type": "http"}, None, None))
    assert caught.value is primary
    assert requests.uncertain and requests.active == 0
    assert ledger.write_failed.is_set() if write_fails else ledger.state()["unsafe"]


def serve_mocks(monkeypatch, ledger):
    seed(ledger)
    monkeypatch.setattr(demo, "verify", Mock(return_value={}))
    engine = Mock()
    monkeypatch.setattr(demo, "tracked_factory", Mock(return_value=(engine, Mock(), Mock())))
    monkeypatch.setattr(demo, "locked_connections", lambda *args: nullcontext())

    @contextmanager
    def app(*args):
        async def application(scope, receive, send):
            return None
        yield application

    monkeypatch.setattr(demo, "demo_app", app)
    return engine


@pytest.mark.parametrize("graceful_sigint", [False, True])
def test_serve_uses_fixed_settings_and_only_marks_confirmed_shutdown(ledger, monkeypatch, graceful_sigint):
    engine = serve_mocks(monkeypatch, ledger)

    def run(app, **options):
        assert options == {"host": "127.0.0.1", "port": 8766, "workers": 1, "reload": False,
                           "access_log": False, "log_config": None, "log_level": "critical"}
        assert ledger.state()["server"] is not None
        with pytest.raises(demo.smoke.SmokeFailure):
            with demo.Manifest(ledger.path).exclusive():
                pass
        if graceful_sigint:
            raise KeyboardInterrupt()

    monkeypatch.setattr("uvicorn.run", run)
    assert demo.serve(None, {}, ledger)["status"] == "server_stopped"
    assert ledger.state()["server"] is None
    engine.dispose.assert_called_once()


@pytest.mark.parametrize("mode", ["startup", "active", "request", "write", "pending", "sigint_write"])
def test_serve_uncertainty_keeps_lifecycle_unfinished_across_processes(ledger, monkeypatch, mode):
    serve_mocks(monkeypatch, ledger)

    def run(requests, **kwargs):
        if mode == "startup":
            raise RuntimeError("unit-startup-failure")
        if mode == "active":
            requests.active = 1
        elif mode == "request":
            requests.uncertain = True
        elif mode == "write":
            ledger.write_failed.set()
        elif mode == "sigint_write":
            ledger.write_failed.set()
            raise KeyboardInterrupt()
        elif mode == "pending":
            row = {"kind": "sample", "id_sample": 81, "id_user": 71, "key": uuid4().hex + ".fastq",
                   "filename": "unit.fastq", "size": 10, "database_time": "2026-10-18T00:00:00"}
            ledger.record("commit_intent", tx=uuid4().hex, purpose="upload", rows=[row])

    monkeypatch.setattr("uvicorn.run", run)
    with pytest.raises((RuntimeError, demo.smoke.SmokeFailure, KeyboardInterrupt)):
        demo.serve(None, {}, ledger)
    reopened = demo.Manifest(ledger.path)
    assert reopened.state()["server"] is not None
    with pytest.raises(demo.smoke.SmokeFailure):
        demo.cleanup({}, reopened)


def test_shutdown_does_not_mask_primary_when_ledger_write_also_fails(ledger, monkeypatch):
    serve_mocks(monkeypatch, ledger)
    original = ledger._append
    primary = RuntimeError("synthetic-primary")

    def run(*args, **kwargs):
        raise primary

    def append(phase, **kwargs):
        if phase == "server_uncertain":
            raise OSError("synthetic-secondary")
        original(phase, **kwargs)

    monkeypatch.setattr("uvicorn.run", run)
    monkeypatch.setattr(ledger, "_append", append)
    with pytest.raises(RuntimeError) as caught:
        demo.serve(None, {}, ledger)
    assert caught.value is primary
    assert demo.Manifest(ledger.path).state()["server"] is not None


def test_failed_interruption_record_cannot_be_followed_by_safe_shutdown_or_cleanup(ledger, monkeypatch):
    serve_mocks(monkeypatch, ledger)
    original = ledger._append

    def append(phase, **kwargs):
        if phase == "request_interrupted":
            raise OSError("synthetic-full-disk")
        original(phase, **kwargs)

    async def interrupted(scope, receive, send):
        raise asyncio.CancelledError()

    def run(requests, **kwargs):
        requests.app = interrupted
        with pytest.raises(asyncio.CancelledError):
            asyncio.run(requests({"type": "http"}, None, None))
        assert requests.active == 0 and requests.uncertain

    monkeypatch.setattr(ledger, "_append", append)
    monkeypatch.setattr("uvicorn.run", run)
    with pytest.raises(demo.smoke.SmokeFailure, match="shutdown_unconfirmed"):
        demo.serve(None, {}, ledger)
    reopened = demo.Manifest(ledger.path)
    assert reopened.state()["server"] is not None
    with pytest.raises(demo.smoke.SmokeFailure, match="stop_and_verify"):
        demo.cleanup({}, reopened)


@pytest.mark.parametrize("problem", ["untracked", "wrong_size", "validator"])
def test_verify_rejects_files_without_deleting(ledger, monkeypatch, problem):
    row = uploaded(ledger)
    monkeypatch.setattr(demo, "read_database", Mock())
    validator = Mock()
    monkeypatch.setattr("app.services.upload_validation.validate_in_process", validator)
    if problem == "untracked":
        (ledger.storage / "foreign.txt").write_bytes(b"unit foreign file")
    elif problem == "wrong_size":
        (ledger.storage / row["key"]).write_bytes(FASTQ + b"x")
    else:
        validator.side_effect = RuntimeError("synthetic-invalid-file")
    before = set(ledger.storage.iterdir())
    with pytest.raises((demo.smoke.SmokeFailure, RuntimeError)):
        demo.verify({}, ledger)
    assert set(ledger.storage.iterdir()) == before
    assert ledger.state()["verified"] is None


def test_verify_uses_read_only_database_and_records_owned_file_fingerprint(ledger, monkeypatch):
    row = uploaded(ledger)
    read = Mock()
    monkeypatch.setattr(demo, "read_database", read)
    validator = Mock()
    monkeypatch.setattr("app.services.upload_validation.validate_in_process", validator)
    files = demo.verify({}, ledger)
    assert set(files) == {row["key"]} and files == ledger.state()["verified"]
    assert validator.call_args.args[1] == ".fastq"
    read.assert_called_once()


@pytest.mark.parametrize("wrong", ["user", "sample", "none"])
def test_read_database_checks_rows_and_rolls_back_closes(ledger, monkeypatch, wrong):
    row = uploaded(ledger)
    state, connection, cursor = ledger.state(), Mock(), Mock()
    connection.cursor.return_value.__enter__ = Mock(return_value=cursor)
    connection.cursor.return_value.__exit__ = Mock(return_value=False)
    owner = state["user"]
    users = [(owner["id_user"], owner["username"], owner["email"], owner["nama"], owner["role"])]
    samples = [(row["id_sample"], row["id_user"], row["key"], row["filename"], row["size"],
                datetime.fromisoformat(row["database_time"]))]
    cursor.fetchall.side_effect = [([] if wrong == "user" else users), ([] if wrong == "sample" else samples)]
    monkeypatch.setattr(demo.smoke, "connect_read_only", Mock(return_value=connection))
    monkeypatch.setattr(demo.smoke, "identity", Mock(return_value="on"))
    if wrong == "none":
        demo.read_database({}, state)
    else:
        with pytest.raises(demo.smoke.SmokeFailure):
            demo.read_database({}, state)
    assert all(call.args[0].startswith("SELECT") for call in cursor.execute.call_args_list)
    connection.rollback.assert_called_once()
    connection.close.assert_called_once()


def cleanup_mocks(monkeypatch, ledger, commit_fails=False):
    row = uploaded(ledger)
    info = demo.smoke.inspect_file(ledger.storage, row["key"])
    ledger.record("verified", files={row["key"]: info})
    monkeypatch.setattr(demo, "verify", Mock(return_value={row["key"]: info}))
    read = Mock()
    monkeypatch.setattr(demo, "read_database", read)
    session = Mock()
    session.__enter__ = Mock(return_value=session)
    session.__exit__ = Mock(return_value=False)
    user = SimpleNamespace(**{key: value for key, value in ledger.state()["user"].items() if key != "kind"})
    sample = SimpleNamespace(id_sample=row["id_sample"], id_user=row["id_user"],
        path_penyimpanan=row["key"], nama_berkas=row["filename"], ukuran_berkas=row["size"],
        waktu_unggah=datetime.fromisoformat(row["database_time"]))
    session.scalar.side_effect = [user, 0, 0]
    session.scalars.return_value.all.side_effect = [[sample], []]
    session.execute.return_value.rowcount = 1
    cursor = Mock()
    session.connection.return_value.connection.driver_connection.cursor.return_value.__enter__ = Mock(return_value=cursor)
    session.connection.return_value.connection.driver_connection.cursor.return_value.__exit__ = Mock(return_value=False)
    monkeypatch.setattr(demo.smoke, "inspect_schema", Mock())
    monkeypatch.setattr(demo, "locked_connections", lambda *args: nullcontext())
    engine = Mock()
    factory = Mock(return_value=session)
    monkeypatch.setattr(demo, "tracked_factory", Mock(return_value=(engine, factory, Mock())))

    def commit():
        confirm(ledger, "cleanup", [ledger.state()["user"], *ledger.state()["samples"]])
        if commit_fails:
            raise RuntimeError("unit-commit-failed-after-possible-commit")

    session.commit.side_effect = commit
    return row, session, read


def test_cleanup_only_owned_rows_then_confirm_read_and_unlink(ledger, monkeypatch):
    row, session, read = cleanup_mocks(monkeypatch, ledger)
    events = []
    original_commit, original_unlink = session.commit.side_effect, os.unlink

    def commit():
        events.append("commit")
        original_commit()

    def checked_read(*args, **kwargs):
        assert kwargs["empty"] is True
        assert ledger.state()["cleaned"]
        events.append("read_empty")

    def unlink(key, **kwargs):
        assert key == row["key"] and "dir_fd" in kwargs
        events.append("unlink")
        original_unlink(key, **kwargs)

    session.commit.side_effect = commit
    read.side_effect = checked_read
    monkeypatch.setattr(os, "unlink", unlink)
    assert demo.cleanup({}, ledger)["users_remaining"] == 0
    assert events == ["commit", "read_empty", "unlink"]
    assert not list(ledger.storage.iterdir()) and ledger.path.exists()
    assert ledger.state()["files_removed"]
    deletes = [str(call.args[0]) for call in session.execute.call_args_list]
    assert len(deletes) == 2 and all(sql.startswith("DELETE FROM") and " WHERE " in sql for sql in deletes)
    assert "sample.id_user" in deletes[0] and '"user".username' in deletes[1]


@pytest.mark.parametrize("phase", ["commit", "ownership", "rowcount", "postcommit_read", "inode", "job", "genotype", "shared"])
def test_cleanup_failure_retains_files_and_never_reports_completed(ledger, monkeypatch, phase):
    row, session, read = cleanup_mocks(monkeypatch, ledger, commit_fails=phase == "commit")
    if phase == "ownership":
        session.scalar.side_effect = [None]
    elif phase == "rowcount":
        session.execute.return_value.rowcount = 0
    elif phase == "postcommit_read":
        read.side_effect = RuntimeError("unit-unconfirmed-cleanup")
    elif phase == "inode":
        real_inspect = demo.smoke.inspect_file
        monkeypatch.setattr(demo.smoke, "inspect_file", lambda *args: {**real_inspect(*args), "inode": -1})
    elif phase == "job":
        session.scalar.side_effect = [next(session.scalar.side_effect), 1]
    elif phase == "genotype":
        session.scalar.side_effect = [next(session.scalar.side_effect), 0, 1]
    elif phase == "shared":
        sample = next(session.scalars.return_value.all.side_effect)
        session.scalars.return_value.all.side_effect = [sample, [999]]
    with pytest.raises((RuntimeError, demo.smoke.SmokeFailure)):
        demo.cleanup({}, ledger)
    assert (ledger.storage / row["key"]).exists()
    assert not ledger.state()["files_removed"]
    if phase in ("ownership", "rowcount", "job", "genotype", "shared"):
        session.commit.assert_not_called()


def test_private_password_refuses_non_tty_and_echo_fallback(monkeypatch):
    monkeypatch.setattr(sys_stdin := demo.sys.stdin, "isatty", Mock(return_value=False))
    prompt = Mock()
    monkeypatch.setattr(demo.getpass, "getpass", prompt)
    with pytest.raises(demo.smoke.SmokeFailure):
        demo.private_password()
    prompt.assert_not_called()
    monkeypatch.setattr(sys_stdin, "isatty", Mock(return_value=True))
    monkeypatch.setattr(demo.sys.stderr, "isatty", Mock(return_value=True))

    def echo_warning(*args):
        warnings.warn("unit echo fallback refused", demo.getpass.GetPassWarning)

    monkeypatch.setattr(demo.getpass, "getpass", echo_warning)
    with pytest.raises(demo.getpass.GetPassWarning):
        demo.private_password()


@pytest.mark.parametrize("values", [("", ""), ("unit-a", "unit-b"), ("unit-match", "unit-match")])
def test_private_password_confirmation_without_echo_or_output(monkeypatch, capsys, values):
    monkeypatch.setattr(demo.sys.stdin, "isatty", Mock(return_value=True))
    monkeypatch.setattr(demo.sys.stderr, "isatty", Mock(return_value=True))
    prompt = Mock(side_effect=values)
    monkeypatch.setattr(demo.getpass, "getpass", prompt)
    if values[0] and values[0] == values[1]:
        assert demo.private_password() == SecretStr(values[0])
    else:
        with pytest.raises(demo.smoke.SmokeFailure):
            demo.private_password()
    assert prompt.call_count == 2
    assert not capsys.readouterr().out


def test_create_user_uses_unique_identity_role_and_never_logs_password_hash(ledger, monkeypatch, capsys):
    captured, session = [], Mock()
    session.__enter__ = Mock(return_value=session)
    session.__exit__ = Mock(return_value=False)
    session.add.side_effect = captured.append

    def commit():
        user, = captured
        user.id_user = 71
        confirm(ledger, "seed", [demo.user_row(user)])

    session.commit.side_effect = commit
    engine = Mock()
    monkeypatch.setattr(demo, "private_password", Mock(return_value=SecretStr("unit-private-input")))
    monkeypatch.setattr("app.core.security.hash_password", Mock(return_value="unit-hash-never-persisted"))
    monkeypatch.setattr(demo, "tracked_factory", Mock(return_value=(engine, Mock(return_value=session), Mock())))
    monkeypatch.setattr(demo, "locked_connections", lambda *args: nullcontext())
    report = demo.create_user({}, ledger)
    user, = captured
    assert user.role == "user" and user.username == ledger.state()["created"]["username"]
    assert report["status"] == "user_created" and not ledger.state()["pending"]
    data = ledger.path.read_text() + capsys.readouterr().out
    assert "unit-private-input" not in data and "unit-hash-never-persisted" not in data
    engine.dispose.assert_called_once()


def test_main_failure_is_sanitized_without_loading_actual_configuration(monkeypatch, capsys):
    monkeypatch.setattr(demo.smoke, "load_configuration", Mock(side_effect=RuntimeError("synthetic-private-marker")))
    assert demo.main(["init"]) == 1
    output = capsys.readouterr().out
    assert "synthetic-private-marker" not in output
    assert json.loads(output)["status"] == "blocked"
