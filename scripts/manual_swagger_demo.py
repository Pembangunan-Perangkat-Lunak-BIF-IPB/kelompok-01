"""Opt-in M7 Swagger demo. See scripts/SWAGGER_DEMO.md before using any command.

Importing this module does not load Settings, connect, create files, or serve HTTP.
Every command needs separate operator approval. No secret is accepted on the CLI.
"""

import argparse
from contextlib import contextmanager
from datetime import datetime
import fcntl
import getpass
import json
import logging
import os
from pathlib import Path
import re
import secrets
import stat
import sys
from threading import Event, RLock
from unittest.mock import patch
from uuid import uuid4
import warnings


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
from scripts import manual_upload_postgres_smoke as smoke


STATE_ROOT = Path("~/genopath-demo-state")
PREFIX = "genopath-swagger-"
NAME = "GenoPath Swagger demo"
MAX_LEDGER = 2 * 1024**2


def require(condition, check):
    smoke.require(condition, check)


def private(info, mode):
    require(info.st_uid == os.geteuid() and stat.S_IMODE(info.st_mode) == mode,
            "private_ownership_or_mode_mismatch")


def inode(info):
    return [info.st_dev, info.st_ino]


def configured_state_root(path=None):
    path = Path(STATE_ROOT if path is None else path).expanduser()
    require(path.is_absolute() and ".." not in path.parts and not path.is_relative_to(ROOT),
            "state_root_must_be_absolute_and_outside_repo")
    return path


@contextmanager
def state_directory(path, create=False):
    """Walk every ancestor without following symlinks; create only the final leaf."""
    descriptor = os.open(path.anchor, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        for component in path.parts[1:-1]:
            child = os.open(component, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=descriptor)
            os.close(descriptor)
            descriptor = child
        require(path.name, "state_root_cannot_be_filesystem_root")
        if create:
            try:
                os.mkdir(path.name, mode=0o700, dir_fd=descriptor)
            except FileExistsError:
                pass
            else:
                os.fsync(descriptor)  # Persist the new state directory's parent entry.
        child = os.open(path.name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=descriptor)
        os.close(descriptor)
        descriptor = child
        private(os.fstat(descriptor), 0o700)
        yield descriptor
    finally:
        os.close(descriptor)


def validate_row(row, state):
    if row.get("kind") == "user":
        require(set(row) == {"kind", "id_user", "username", "email", "nama", "role"}, "user_manifest_fields")
        require(type(row["id_user"]) is int and row["id_user"] > 0
                and row["username"] == state["created"]["username"]
                and row["email"] == state["created"]["email"]
                and row["nama"] == NAME and row["role"] == "user", "user_manifest_identity")
    else:
        require(set(row) == {"kind", "id_sample", "id_user", "key", "filename", "size", "database_time"}
                and row["kind"] == "sample", "sample_manifest_fields")
        require(state["user"] is not None and row["id_user"] == state["user"]["id_user"]
                and type(row["id_sample"]) is int and row["id_sample"] > 0
                and type(row["size"]) is int and 0 < row["size"] <= 1_000_000_000
                and isinstance(row["key"], str) and smoke.KEY_PATTERN.fullmatch(row["key"]),
                "sample_manifest_identity")
        from app.services.fastq import validate_filename
        require(row["key"].endswith(validate_filename(row["filename"])), "sample_suffix_mismatch")
        require(datetime.fromisoformat(row["database_time"]).tzinfo is None, "sample_time_mismatch")


def replay(events):
    """Incomplete/malformed or ambiguous ledgers always block destructive commands."""
    require(events and events[0].get("phase") == "created", "manifest_header_missing")
    created = events[0]
    require(set(created) == {"phase", "database", "revision", "run_id", "username", "email",
                            "root_identity", "storage_identity", "lock_identity"}, "manifest_header_fields")
    require(created["database"] == smoke.DATABASE and created["revision"] == smoke.REVISION
            and re.fullmatch(r"[0-9a-f]{32}", created["run_id"])
            and created["username"] == "swagger_m7_" + created["run_id"]
            and created["email"] == created["username"] + "@example.invalid", "manifest_target_mismatch")
    for field in ("root_identity", "storage_identity", "lock_identity"):
        require(isinstance(created[field], list) and len(created[field]) == 2
                and all(type(value) is int and value >= 0 for value in created[field]), "manifest_inode_fields")
    state = {"created": created, "user": None, "samples": [], "pending": {}, "transactions": set(),
             "server": None, "unsafe": False, "verified": None, "cleaned": False,
             "files_removed": False, "count": len(events)}
    for event in events[1:]:
        phase = event.get("phase")
        if phase == "commit_intent":
            require(set(event) == {"phase", "tx", "purpose", "rows"}, "commit_manifest_fields")
            tx, purpose, rows = event["tx"], event["purpose"], event["rows"]
            require(re.fullmatch(r"[0-9a-f]{32}", tx) and tx not in state["transactions"]
                    and not state["pending"] and not state["unsafe"] and not state["cleaned"], "unsafe_commit_state")
            for row in rows:
                validate_row(row, state)
            if purpose == "seed":
                require(state["user"] is None and len(rows) == 1 and rows[0]["kind"] == "user", "seed_state")
            elif purpose == "upload":
                require(state["server"] is not None and len(rows) == 1 and rows[0]["kind"] == "sample"
                        and all(row["id_sample"] != rows[0]["id_sample"] and row["key"] != rows[0]["key"]
                                for row in state["samples"]), "upload_state")
            else:
                require(purpose == "cleanup" and state["server"] is None and state["user"] is not None
                        and state["verified"] is not None
                        and rows == [state["user"], *state["samples"]], "cleanup_state")
            state["transactions"].add(tx)
            state["pending"][tx] = event
        elif phase == "commit_confirmed":
            require(set(event) == {"phase", "tx"} and event["tx"] in state["pending"], "unknown_commit_confirmation")
            intent = state["pending"].pop(event["tx"])
            if intent["purpose"] == "seed":
                state["user"] = intent["rows"][0]
            elif intent["purpose"] == "upload":
                state["samples"].extend(intent["rows"])
                state["verified"] = None
            else:
                state["cleaned"] = True
        elif phase == "server_started":
            require(set(event) == {"phase", "token", "pid"} and state["server"] is None
                    and state["user"] is not None and not state["cleaned"]
                    and not state["pending"] and not state["unsafe"]
                    and re.fullmatch(r"[0-9a-f]{32}", event["token"])
                    and type(event["pid"]) is int and event["pid"] > 0, "server_start_state")
            state["server"] = event["token"]
        elif phase == "server_stopped":
            require(set(event) == {"phase", "token"} and state["server"] == event["token"], "server_stop_state")
            state["server"] = None
        elif phase in ("server_uncertain", "request_interrupted"):
            require(set(event) == {"phase"}, "unsafe_manifest_fields")
            state["unsafe"] = True
        elif phase == "verified":
            require(set(event) == {"phase", "files"} and not state["pending"] and not state["unsafe"]
                    and not state["cleaned"], "verification_state")
            require(set(event["files"]) == {row["key"] for row in state["samples"]}, "verified_keys_mismatch")
            for info in event["files"].values():
                require(set(info) == {"device", "inode", "sha256", "size"}
                        and re.fullmatch(r"[0-9a-f]{64}", info["sha256"]), "verified_file_fields")
            state["verified"] = event["files"]
        elif phase == "files_removed":
            require(set(event) == {"phase"} and state["cleaned"] and not state["files_removed"], "file_cleanup_state")
            state["files_removed"] = True
        else:
            raise smoke.SmokeFailure("unknown_manifest_event")
    return state


class Manifest:
    """Private append-only ledger with fsync, inode checks, and interprocess locking."""
    def __init__(self, path, state_root=None):
        self.state_root = configured_state_root(state_root)
        self.state_root_identity = None
        self.path = Path(path)
        self.root = self.path.parent
        require(self.path.name == "manifest.jsonl" and self.root.parent == self.state_root
                and re.fullmatch(PREFIX + r"[0-9a-f]{32}", self.root.name), "manifest_location_refused")
        self.storage = self.root / "storage"
        self.lock = RLock()
        self.write_failed = Event()
        self.identity = None
        self.state()

    @classmethod
    def create(cls, state_root=None):
        state_root = configured_state_root(state_root)
        run_id = uuid4().hex
        root = state_root / (PREFIX + run_id)
        with state_directory(state_root, create=True) as parent:
            os.mkdir(root.name, mode=0o700, dir_fd=parent)  # Never reuse another run.
            os.fsync(parent)
            directory = os.open(root.name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=parent)
            try:
                os.mkdir("storage", mode=0o700, dir_fd=directory)
                descriptor = os.open("server.lock", os.O_CREAT | os.O_EXCL | os.O_WRONLY | os.O_NOFOLLOW,
                                     0o600, dir_fd=directory)
                os.close(descriptor)
                username = "swagger_m7_" + run_id
                event = {"phase": "created", "database": smoke.DATABASE, "revision": smoke.REVISION,
                         "run_id": run_id, "username": username, "email": username + "@example.invalid",
                         "root_identity": inode(os.fstat(directory)),
                         "storage_identity": inode(os.stat("storage", dir_fd=directory, follow_symlinks=False)),
                         "lock_identity": inode(os.stat("server.lock", dir_fd=directory, follow_symlinks=False))}
                descriptor = os.open("manifest.jsonl", os.O_CREAT | os.O_EXCL | os.O_WRONLY | os.O_NOFOLLOW,
                                     0o600, dir_fd=directory)
                try:
                    target = os.fdopen(descriptor, "w")
                except BaseException:
                    os.close(descriptor)
                    raise
                with target:
                    target.write(json.dumps(event) + "\n")
                    target.flush()
                    os.fsync(target.fileno())
                os.fsync(directory)
            finally:
                os.close(directory)
        return cls(root / "manifest.jsonl", state_root=state_root)

    @contextmanager
    def directory(self):
        with state_directory(self.state_root) as parent:
            identity = inode(os.fstat(parent))
            if self.state_root_identity is None:
                self.state_root_identity = identity
            require(identity == self.state_root_identity, "state_root_replaced")
            descriptor = os.open(self.root.name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=parent)
            try:
                private(os.fstat(descriptor), 0o700)
                yield descriptor
            finally:
                os.close(descriptor)

    @contextmanager
    def opened(self, write=False):
        with self.lock, self.directory() as directory:
            flags = (os.O_RDWR | os.O_APPEND) if write else os.O_RDONLY
            descriptor = os.open("manifest.jsonl", flags | os.O_NOFOLLOW, dir_fd=directory)
            try:
                info = os.fstat(descriptor)
                private(info, 0o600)
                require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1, "manifest_file_type")
                if self.identity is None:
                    self.identity = inode(info)
                require(self.identity == inode(info), "manifest_replaced")
                fcntl.flock(descriptor, fcntl.LOCK_EX if write else fcntl.LOCK_SH)
                raw = bytearray()
                while len(raw) <= MAX_LEDGER:
                    chunk = os.read(descriptor, min(65_536, MAX_LEDGER + 1 - len(raw)))
                    if not chunk:
                        break
                    raw.extend(chunk)
                require(len(raw) <= MAX_LEDGER and raw.endswith(b"\n"), "manifest_incomplete_or_too_large")
                events = [json.loads(line) for line in raw.splitlines()]
                state = replay(events)
                require(inode(os.fstat(directory)) == state["created"]["root_identity"]
                        and self.root.name == PREFIX + state["created"]["run_id"], "root_identity_mismatch")
                storage = os.open("storage", os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=directory)
                try:
                    private(os.fstat(storage), 0o700)
                    require(inode(os.fstat(storage)) == state["created"]["storage_identity"], "storage_replaced")
                finally:
                    os.close(storage)
                yield descriptor, events, state
            finally:
                os.close(descriptor)

    def state(self):
        with self.opened() as (_, _, state):
            return state

    def record(self, phase, *, expected=None, **data):
        try:
            self._append(phase, expected=expected, **data)
        except BaseException:
            # A complete-looking line is not proof that its fsync succeeded.
            self.write_failed.set()
            raise

    def _append(self, phase, *, expected=None, **data):
        with self.opened(write=True) as (descriptor, events, state):
            require(expected is None or expected == state["count"], "manifest_changed_during_verification")
            event = {"phase": phase, **data}
            replay([*events, event])  # Validate fields before persisting; no secret fields allowed.
            encoded = (json.dumps(event, sort_keys=True) + "\n").encode()
            require(os.lseek(descriptor, 0, os.SEEK_END) + len(encoded) <= MAX_LEDGER, "manifest_full")
            require(os.write(descriptor, encoded) == len(encoded), "manifest_short_write")
            os.fsync(descriptor)

    @contextmanager
    def exclusive(self):
        """Held for the whole server lifetime; seed/cleanup cannot race a live server."""
        state = self.state()
        with self.directory() as directory:
            descriptor = os.open("server.lock", os.O_RDWR | os.O_NOFOLLOW, dir_fd=directory)
            try:
                info = os.fstat(descriptor)
                private(info, 0o600)
                require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1
                        and inode(info) == state["created"]["lock_identity"], "server_lock_replaced")
                try:
                    fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
                except BlockingIOError:
                    raise smoke.SmokeFailure("demo_server_or_command_active") from None
                yield
            finally:
                os.close(descriptor)


def safe_state(ledger):
    state = ledger.state()
    require(not ledger.write_failed.is_set() and not state["pending"]
            and not state["unsafe"] and not state["cleaned"], "reconciliation_required")
    return state


@contextmanager
def locked_connections(engine):
    """Reject unintended engines and native connections BEFORE opening a socket."""
    from sqlalchemy.engine import Engine
    connect, raw, native = Engine.connect, Engine.raw_connection, smoke.psycopg.connect

    def engine_connect(candidate, *args, **kwargs):
        require(candidate is engine, "fallback_engine_refused")
        return connect(candidate, *args, **kwargs)

    def engine_raw(candidate, *args, **kwargs):
        require(candidate is engine, "fallback_engine_refused")
        return raw(candidate, *args, **kwargs)

    def native_connect(*args, **kwargs):
        require(not args and set(kwargs) == {"dbname", "host", "port", "user", "password", "connect_timeout",
                                            "application_name", "options", "autocommit"}
                and kwargs["dbname"] == smoke.DATABASE and kwargs["options"] == smoke.OPTIONS
                and kwargs["autocommit"] is False, "fallback_native_connection_refused")
        return native(**kwargs)

    with patch.object(Engine, "connect", engine_connect), patch.object(Engine, "raw_connection", engine_raw), \
            patch.object(smoke.psycopg, "connect", native_connect), \
            patch("app.database.get_engine", side_effect=smoke.SmokeFailure("fallback_engine_refused")), \
            patch("sqlalchemy.create_engine", side_effect=smoke.SmokeFailure("fallback_engine_creation_refused")):
        yield


def user_row(user):
    return {"kind": "user", "id_user": user.id_user, "username": user.username, "email": user.email,
            "nama": user.nama, "role": user.role}


def sample_row(sample):
    return {"kind": "sample", "id_sample": sample.id_sample, "id_user": sample.id_user,
            "key": sample.path_penyimpanan, "filename": sample.nama_berkas,
            "size": sample.ukuran_berkas, "database_time": sample.waktu_unggah.isoformat()}


def tracked_factory(parameters, ledger, purpose):
    from sqlalchemy import event
    from sqlalchemy.orm import sessionmaker
    from app.models import Sample, User

    engine, base_factory, check = smoke.guarded_factory(parameters)

    class DemoSession(base_factory.class_):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self.demo_rows = []

        def commit(self):
            check(self)
            self.flush()
            state = safe_state(ledger)
            rows = ([state["user"], *state["samples"]] if purpose == "cleanup" else self.demo_rows)
            tx = uuid4().hex
            ledger.record("commit_intent", tx=tx, purpose=purpose, rows=rows)
            super().commit()
            # A raised COMMIT or crash leaves its intent unresolved, even after rollback.
            ledger.record("commit_confirmed", tx=tx)

    def before_flush(session, *args):
        state = safe_state(ledger)
        require(not session.dirty and not session.deleted, "unexpected_orm_mutation")
        for value in session.new:
            require((purpose == "seed" and isinstance(value, User) and state["user"] is None)
                    or (purpose == "upload" and isinstance(value, Sample) and state["user"] is not None
                        and value.id_user == state["user"]["id_user"]), "unexpected_insert_or_owner")

    def after_flush(session, *args):
        state = safe_state(ledger)
        for value in session.new:
            row = user_row(value) if isinstance(value, User) else sample_row(value)
            validate_row(row, state)
            session.demo_rows.append(row)

    event.listen(DemoSession, "before_flush", before_flush)
    event.listen(DemoSession, "after_flush", after_flush)
    return engine, sessionmaker(bind=engine, class_=DemoSession, autoflush=False), check


def private_password():
    from pydantic import SecretStr
    require(sys.stdin.isatty() and sys.stderr.isatty(), "password_requires_private_tty")
    with warnings.catch_warnings():
        warnings.simplefilter("error", getpass.GetPassWarning)
        first = SecretStr(getpass.getpass("Demo password (hidden): "))
        second = SecretStr(getpass.getpass("Repeat password (hidden): "))
    require(bool(first.get_secret_value()) and first == second, "password_empty_or_mismatch")
    return first


def create_user(parameters, ledger):
    from app.core.security import hash_password
    from app.models import User
    with ledger.exclusive():
        state = safe_state(ledger)
        require(state["server"] is None and state["user"] is None, "demo_user_already_created_or_server_active")
        password = private_password()
        engine, factory, _ = tracked_factory(parameters, ledger, "seed")
        try:
            with locked_connections(engine), factory() as session:
                header = state["created"]
                session.add(User(username=header["username"], email=header["email"], nama=NAME, role="user",
                                 password_hash=hash_password(password.get_secret_value())))
                session.commit()
        finally:
            engine.dispose()
    return {"status": "user_created", "username": state["created"]["username"]}


@contextmanager
def demo_app(settings, ledger, factory):
    from pydantic import SecretStr
    from app.core.config import Settings
    from app.database import get_session_factory
    isolated = settings.model_copy(update={"database_url": None, "debug": False,
        "app_name": "GenoPath M7 Swagger demo", "upload_root": ledger.storage,
        "upload_max_bytes": 1_000_000_000, "jwt_secret": SecretStr(secrets.token_urlsafe(48)),
        "jwt_algorithm": "HS256", "access_token_expire_minutes": 240})
    # app.main creates a global app on import. Neutralize that initial Settings too.
    with patch.dict(os.environ, {}, clear=True), patch.dict(Settings.model_config, {"env_file": None}):
        from app.main import create_app
    app = create_app(isolated)
    app.dependency_overrides[get_session_factory] = lambda: factory
    yield app


class Requests:
    def __init__(self, app, ledger):
        self.app, self.ledger, self.active = app, ledger, 0
        self.uncertain = False

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        self.active += 1
        try:
            return await self.app(scope, receive, send)
        except BaseException as error:
            # Set BEFORE writing: a failed ledger write must never erase uncertainty.
            self.uncertain = True
            try:
                self.ledger.record("request_interrupted")
            except Exception:
                error.add_note("Demo interruption ledger could not be updated; retain artifacts.")
            raise
        finally:
            self.active -= 1


def serve(settings, parameters, ledger):
    import uvicorn
    with ledger.exclusive():
        state = safe_state(ledger)
        require(state["user"] is not None and state["server"] is None, "demo_user_missing_or_server_unfinished")
        verify(parameters, ledger)
        engine, factory, _ = tracked_factory(parameters, ledger, "upload")
        token = uuid4().hex  # Lifecycle identifier, never an authentication token.
        try:
            with locked_connections(engine), demo_app(settings, ledger, factory) as app:
                requests = Requests(app, ledger)
                ledger.record("server_started", token=token, pid=os.getpid())
                print(json.dumps({"status": "starting", "docs": "http://127.0.0.1:8766/docs",
                                  "username": state["created"]["username"]}), flush=True)
                try:
                    uvicorn.run(requests, host="127.0.0.1", port=8766, workers=1, reload=False,
                                access_log=False, log_config=None, log_level="critical")
                except KeyboardInterrupt:
                    # Uvicorn re-raises SIGINT after graceful shutdown. Pending intents
                    # and interrupted-request events still prevent destructive cleanup.
                    if requests.active or requests.uncertain or ledger.write_failed.is_set():
                        raise
                except BaseException as error:
                    try:
                        ledger.record("server_uncertain")
                    except Exception:
                        error.add_note("Demo shutdown ledger failed; retain artifacts.")
                    raise
                end = ledger.state()
                require(requests.active == 0 and not requests.uncertain and not ledger.write_failed.is_set()
                        and not end["pending"] and not end["unsafe"], "shutdown_unconfirmed")
                # On ANY uncertainty leave server_started unresolved. Other processes
                # then refuse cleanup even after this process/its lock disappears.
                ledger.record("server_stopped", token=token)
        finally:
            engine.dispose()
    return {"status": "server_stopped"}


def read_database(parameters, state, empty=False):
    connection = smoke.connect_read_only(parameters)
    try:
        with connection.cursor() as cursor:
            require(smoke.identity(cursor) == "on", "verification_not_read_only")
            owner = state["user"]
            cursor.execute('SELECT id_user, username, email, nama, role FROM public."user" '
                           'WHERE id_user=%s OR username=%s OR email=%s',
                           (owner["id_user"], owner["username"], owner["email"]))
            users = cursor.fetchall()
            cursor.execute("SELECT id_sample, id_user, path_penyimpanan, nama_berkas, ukuran_berkas, waktu_unggah "
                           "FROM public.sample WHERE id_user=%s OR id_sample=ANY(%s) OR path_penyimpanan=ANY(%s)",
                           (owner["id_user"], [row["id_sample"] for row in state["samples"]],
                            [row["key"] for row in state["samples"]]))
            samples = cursor.fetchall()
            if empty:
                require(not users and not samples, "cleanup_database_not_empty")
            else:
                require(users == [(owner["id_user"], owner["username"], owner["email"], NAME, "user")],
                        "database_user_identity_mismatch")
                actual = [{"kind": "sample", "id_sample": row[0], "id_user": row[1], "key": row[2],
                           "filename": row[3], "size": row[4], "database_time": row[5].isoformat()}
                          for row in samples]
                require(sorted(actual, key=lambda row: row["id_sample"])
                        == sorted(state["samples"], key=lambda row: row["id_sample"]), "database_samples_mismatch")
    finally:
        try:
            connection.rollback()
        finally:
            connection.close()


def verify(parameters, ledger, record=True):
    from app.core.config import Settings
    from app.services.upload_validation import validate_in_process
    state = safe_state(ledger)
    require(state["user"] is not None, "demo_user_missing")
    read_database(parameters, state)
    require({path.name for path in ledger.storage.iterdir()} == {row["key"] for row in state["samples"]},
            "untracked_files_reconciliation_required")
    files = {}
    for row in state["samples"]:
        # This demo verifier deliberately handles small fixtures only, not 1 GB files.
        info = smoke.inspect_file(ledger.storage, row["key"])
        require(info["size"] == row["size"], "file_size_mismatch")
        descriptor = os.open(ledger.storage / row["key"], os.O_RDONLY | os.O_NOFOLLOW)
        with os.fdopen(descriptor, "rb") as source:
            suffix = ".fastq.gz" if row["key"].endswith(".gz") else ".fastq"
            validate_in_process(source, suffix, Settings(_env_file=None), Event())
        require(smoke.inspect_file(ledger.storage, row["key"]) == info, "file_changed_during_verification")
        files[row["key"]] = info
    if record:
        ledger.record("verified", expected=state["count"], files=files)
    return files


def cleanup(parameters, ledger):
    from sqlalchemy import delete, or_, select, text
    from app.models import Sample, User
    with ledger.exclusive():
        state = safe_state(ledger)
        require(state["server"] is None and state["user"] is not None
                and state["verified"] is not None, "stop_and_verify_before_cleanup")
        files = verify(parameters, ledger, record=False)
        require(files == state["verified"], "verified_files_changed")
        engine, factory, check = tracked_factory(parameters, ledger, "cleanup")
        try:
            with locked_connections(engine), factory() as session:
                check(session)
                with session.connection().connection.driver_connection.cursor() as cursor:
                    smoke.inspect_schema(cursor)  # Refuse cascading foreign keys before deletion.
                owner, rows = state["user"], state["samples"]
                ids, keys = [row["id_sample"] for row in rows], [row["key"] for row in rows]
                user = session.scalar(select(User).where(User.id_user == owner["id_user"]).with_for_update())
                require(user is not None and user_row(user) == owner, "cleanup_user_changed")
                actual = session.scalars(select(Sample).where(Sample.id_user == owner["id_user"]).with_for_update()).all()
                require(sorted((sample_row(row) for row in actual), key=lambda row: row["id_sample"])
                        == sorted(rows, key=lambda row: row["id_sample"]), "cleanup_samples_changed")
                require(session.scalar(text("SELECT count(*) FROM public.job WHERE id_user=:owner OR id_sample=ANY(:ids)"),
                                       {"owner": owner["id_user"], "ids": ids}) == 0, "unexpected_job_reference")
                require(session.scalar(text("SELECT count(*) FROM public.genotype WHERE id_sample=ANY(:ids)"),
                                       {"ids": ids}) == 0, "unexpected_genotype_reference")
                require(not session.scalars(select(Sample.id_sample).where(Sample.path_penyimpanan.in_(keys),
                            or_(Sample.id_user != owner["id_user"], Sample.id_sample.not_in(ids)))).all(),
                        "unexpected_shared_storage_reference")
                for row in rows:
                    result = session.execute(delete(Sample).where(
                        Sample.id_sample == row["id_sample"], Sample.id_user == owner["id_user"],
                        Sample.path_penyimpanan == row["key"], Sample.nama_berkas == row["filename"],
                        Sample.ukuran_berkas == row["size"],
                        Sample.waktu_unggah == datetime.fromisoformat(row["database_time"])))
                    require(result.rowcount == 1, "sample_cleanup_ownership_mismatch")
                result = session.execute(delete(User).where(User.id_user == owner["id_user"],
                    User.username == owner["username"], User.email == owner["email"], User.nama == NAME, User.role == "user"))
                require(result.rowcount == 1, "user_cleanup_ownership_mismatch")
                session.commit()
        finally:
            engine.dispose()
        # No filesystem deletion after any raised/uncertain COMMIT, even if rollback worked.
        read_database(parameters, ledger.state(), empty=True)
        with ledger.directory() as directory:
            storage = os.open("storage", os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=directory)
            try:
                for key, info in files.items():
                    require(smoke.inspect_file(ledger.storage, key) == info, "cleanup_file_identity_mismatch")
                    require(inode(os.stat(key, dir_fd=storage, follow_symlinks=False))
                            == [info["device"], info["inode"]], "cleanup_file_replaced")
                    os.unlink(key, dir_fd=storage)
                os.fsync(storage)
            finally:
                os.close(storage)
        require(not list(ledger.storage.iterdir()), "cleanup_files_remain")
        ledger.record("files_removed")
    return {"status": "cleanup_confirmed", "users_remaining": 0, "samples_remaining": 0, "files_remaining": 0,
            "manifest_retained": str(ledger.path)}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("init", "create-user", "serve", "verify", "cleanup"))
    parser.add_argument("--manifest", type=Path)
    parser.add_argument("--state-root", type=Path, default=STATE_ROOT,
                        help="Private persistent directory outside the repo (default: ~/genopath-demo-state)")
    args = parser.parse_args(argv)
    logging.disable(logging.CRITICAL)
    try:
        require((args.command == "init") == (args.manifest is None), "manifest_argument_required_or_unexpected")
        settings, parameters = smoke.load_configuration()
        smoke.preflight(parameters)
        if args.command == "init":
            ledger = Manifest.create(state_root=args.state_root)
            report = {"status": "initialized", "manifest": str(ledger.path)}
        else:
            ledger = Manifest(args.manifest, state_root=args.state_root)
            if args.command == "create-user":
                report = create_user(parameters, ledger)
            elif args.command == "serve":
                report = serve(settings, parameters, ledger)
            elif args.command == "verify":
                files = verify(parameters, ledger)
                report = {"status": "verified", "samples": len(files), "files": len(files)}
            else:
                report = cleanup(parameters, ledger)
        print(json.dumps(report, sort_keys=True))
        return 0
    except KeyboardInterrupt:
        print(json.dumps({"status": "interrupted", "action": "review_manifest_before_cleanup"}))
        return 130
    except Exception:
        # Never print raw settings/SQL/OS exceptions or request contents.
        print(json.dumps({"status": "blocked", "action": "retain_artifacts_and_review_manifest"}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
