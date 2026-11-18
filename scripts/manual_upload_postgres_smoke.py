"""Manual PostgreSQL upload smoke runner. Never collected by the default pytest suite.

--preflight performs SELECTs in a server-enforced READ ONLY transaction only.
--run writes test-owned rows/files and requires separate human approval before use.
No mode is selected by default. Credentials and raw exceptions are never printed.
Use the project's .venv Python with -I -B. The runner never contacts Uvicorn.
Successful --run removes its exact rows/files but retains its private manifest.
Failed/uncertain runs require manual reconciliation; rerunning creates a new run.
"""

import argparse
from datetime import datetime, timezone
import gzip
import hashlib
import json
import logging
import os
from pathlib import Path
import re
import stat
import sys
import tempfile
from uuid import uuid4

import psycopg
from sqlalchemy.engine import make_url


ROOT = Path(__file__).resolve().parents[1]
DATABASE = "genopath_integration_test"
REVISION = "0002_m7_schema"
KEY_PATTERN = re.compile(r"[0-9a-f]{32}\.fastq(?:\.gz)?")
FASTQ = b"@smoke_1\nACGT\n+\n!!!!\n@smoke_2\nTGCA\n+\nIIII\n"
OPTIONS = (
    "-c default_transaction_read_only=on -c search_path=public "
    "-c statement_timeout=5000 -c lock_timeout=2000 "
    "-c idle_in_transaction_session_timeout=10000"
)


class SmokeFailure(RuntimeError):
    """Only fixed, non-sensitive check names are used as exception messages."""


def require(condition, check):
    if not condition:
        raise SmokeFailure(check)


def load_configuration():
    # Normal application configuration loading, internal to this process only.
    # Importing this module itself does not instantiate Settings or connect.
    sys.path.insert(0, str(ROOT))
    from app.core.config import Settings

    require(not any(name.startswith("PG") for name in os.environ), "pg_environment_override_refused")
    settings = Settings(_env_file=ROOT / ".env")
    require(settings.database_url is not None, "database_configuration_missing")
    url = make_url(settings.database_url.get_secret_value())
    require(url.drivername == "postgresql+psycopg", "database_driver_refused")
    # Reject ALL query options, including dbname, service, options, and hostaddr.
    # Never pass the source URL to a driver/engine, even for an initial check.
    require(not url.query, "database_query_options_refused")
    require(bool(url.host) and bool(url.username), "explicit_host_and_user_required")
    parameters = {
        "dbname": DATABASE, "host": url.host, "port": url.port or 5432,
        "user": url.username, "password": url.password,
        "connect_timeout": 5, "application_name": "genopath_manual_upload_smoke",
        "options": OPTIONS,
    }
    return settings, parameters


def connect_read_only(parameters):
    require(set(parameters) == {"dbname", "host", "port", "user", "password", "connect_timeout",
                                "application_name", "options"}, "connection_options_refused")
    require(parameters.get("dbname") == DATABASE and parameters.get("options") == OPTIONS,
            "connection_target_refused")
    connection = psycopg.connect(**parameters, autocommit=False)
    try:
        connection.read_only = True
        return connection
    except BaseException:
        connection.close()
        raise


def identity(cursor):
    cursor.execute("SELECT current_database(), current_setting('transaction_read_only'), pg_is_in_recovery()")
    database, read_only, recovery = cursor.fetchone()
    require(database == DATABASE, "database_identity_mismatch")
    require(not recovery, "database_is_not_primary")
    cursor.execute("SELECT version_num FROM public.alembic_version")
    require(cursor.fetchall() == [(REVISION,)], "alembic_revision_mismatch")
    return read_only


def inspect_schema(cursor):
    expected = {
        "user": {"id_user": "int4", "username": "varchar", "nama": "varchar", "email": "varchar",
                 "password_hash": "varchar", "role": "varchar"},
        "sample": {"id_sample": "int4", "id_user": "int4", "nama_berkas": "varchar",
                   "path_penyimpanan": "varchar", "ukuran_berkas": "int8", "waktu_unggah": "timestamp"},
    }
    cursor.execute("SELECT has_database_privilege(current_user, current_database(), 'CONNECT'), "
                   "has_schema_privilege(current_user, 'public', 'USAGE')")
    require(all(cursor.fetchone()), "database_or_schema_privilege_missing")
    for table, columns in expected.items():
        relation = 'public."user"' if table == "user" else "public.sample"
        cursor.execute(
            "SELECT c.relkind, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace "
            "WHERE n.nspname='public' AND c.relname=%s", (table,),
        )
        require(cursor.fetchall() == [("r", False)], f"{table}_table_missing_or_unsupported")
        cursor.execute(
            "SELECT a.attname, t.typname, a.attnotnull, a.atthasdef, a.attidentity "
            "FROM pg_attribute a JOIN pg_type t ON t.oid=a.atttypid "
            "WHERE a.attrelid=%s::regclass AND a.attnum>0 AND NOT a.attisdropped", (relation,),
        )
        actual = {row[0]: row[1:] for row in cursor.fetchall()}
        for name, kind in columns.items():
            require(name in actual and actual[name][0] == kind and actual[name][1],
                    f"{table}_required_column_mismatch")
        require(not any(name not in columns and info[1] and not info[2] and not info[3]
                        for name, info in actual.items()), f"{table}_extra_required_column")
        cursor.execute(
            "SELECT a.attname FROM pg_constraint c JOIN pg_attribute a "
            "ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1] "
            "WHERE c.conrelid=%s::regclass AND c.contype='p' AND cardinality(c.conkey)=1", (relation,),
        )
        require(cursor.fetchall() == [("id_user" if table == "user" else "id_sample",)],
                f"{table}_primary_key_mismatch")
        for privilege in ("SELECT", "INSERT", "DELETE"):
            cursor.execute("SELECT has_table_privilege(current_user, %s, %s)", (relation, privilege))
            require(cursor.fetchone()[0], f"{table}_{privilege.lower()}_privilege_missing")
        cursor.execute("SELECT pg_get_serial_sequence(%s, %s)",
                       (relation, "id_user" if table == "user" else "id_sample"))
        sequence = cursor.fetchone()[0]
        require(sequence is not None, f"{table}_sequence_missing")
        cursor.execute("SELECT has_sequence_privilege(current_user, %s, 'USAGE')", (sequence,))
        require(cursor.fetchone()[0], f"{table}_sequence_usage_missing")
    cursor.execute(
        "SELECT EXISTS (SELECT 1 FROM pg_constraint c "
        "WHERE c.contype='f' AND c.conrelid='public.sample'::regclass "
        "AND c.confrelid='public.\"user\"'::regclass AND c.convalidated "
        "AND c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=c.conrelid "
        "AND attname='id_user')]::smallint[] "
        "AND c.confkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=c.confrelid "
        "AND attname='id_user')]::smallint[])",
    )
    require(cursor.fetchone()[0], "sample_owner_foreign_key_mismatch")
    for name in ("username", "email"):
        cursor.execute(
            "SELECT EXISTS (SELECT 1 FROM pg_index i JOIN pg_attribute a "
            "ON a.attrelid=i.indrelid AND a.attnum=i.indkey[0] "
            "WHERE i.indrelid='public.\"user\"'::regclass AND i.indisunique AND i.indisvalid "
            "AND i.indnkeyatts=1 AND i.indpred IS NULL AND a.attname=%s)", (name,),
        )
        require(cursor.fetchone()[0], f"user_{name}_unique_constraint_missing")
    # No cascade / SET NULL may silently modify data belonging to another run.
    cursor.execute(
        "SELECT count(*) FROM pg_constraint WHERE contype='f' "
        "AND confrelid IN ('public.\"user\"'::regclass, 'public.sample'::regclass) "
        "AND confdeltype NOT IN ('a','r')",
    )
    require(cursor.fetchone()[0] == 0, "unsafe_incoming_delete_action")
    for relation in ("public.job", "public.genotype"):
        cursor.execute("SELECT has_table_privilege(current_user, %s, 'SELECT')", (relation,))
        require(cursor.fetchone()[0], "cleanup_reference_read_privilege_missing")


def preflight(parameters):
    connection = connect_read_only(parameters)
    try:
        with connection.cursor() as cursor:
            require(identity(cursor) == "on", "read_only_transaction_not_enforced")
            inspect_schema(cursor)
    finally:
        try:
            connection.rollback()  # Never COMMIT, DML, DDL, nextval, or migration.
        finally:
            connection.close()
    return {"mode": "preflight", "database": DATABASE, "revision": REVISION,
            "read_only": True, "schema": "ok", "privileges": "ok", "ready": True}


def guarded_factory(parameters):
    """RUN ONLY: each physical connection is checked before allowing read/write."""
    from sqlalchemy import create_engine, event, text
    from sqlalchemy.orm import Session, sessionmaker
    from sqlalchemy.pool import NullPool

    def creator():
        connection = connect_read_only(parameters)
        try:
            with connection.cursor() as cursor:
                require(identity(cursor) == "on", "connection_guard_not_read_only")
            connection.rollback()
            connection.read_only = False  # Only --run reaches this transition.
            return connection
        except BaseException:
            connection.close()
            raise

    engine = create_engine("postgresql+psycopg://", creator=creator, poolclass=NullPool,
                           echo=False, hide_parameters=True)

    class GuardedSession(Session):
        pass

    def check(session):
        require(session.scalar(text("SELECT current_database()")) == DATABASE, "write_database_guard_failed")
        require(session.execute(text("SELECT version_num FROM public.alembic_version")).all()
                == [(REVISION,)], "write_revision_guard_failed")

    event.listen(GuardedSession, "before_flush", lambda session, *args: check(session))
    event.listen(GuardedSession, "before_commit", check)
    return engine, sessionmaker(bind=engine, class_=GuardedSession, autoflush=False), check


class RunManifest:
    """RUN ONLY: append-only, private ownership ledger; never stores credentials."""
    def __init__(self):
        self.run_id = uuid4().hex
        self.root = Path(tempfile.mkdtemp(prefix="genopath-upload-smoke-"))
        self.storage = self.root / "storage"
        self.storage.mkdir(mode=0o700)
        self.username = "it_upload_" + self.run_id
        self.email = self.username + "@example.invalid"
        self.user_id = None
        self.samples = []
        descriptor = os.open(self.root / "manifest.jsonl", os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        self.file = os.fdopen(descriptor, "w", encoding="utf-8")
        self.record("created", database=DATABASE, run_id=self.run_id, username=self.username)

    def record(self, phase, **data):
        self.file.write(json.dumps({"phase": phase, **data}, sort_keys=True) + "\n")
        self.file.flush()
        os.fsync(self.file.fileno())


def inspect_file(storage, key):
    require(isinstance(key, str) and KEY_PATTERN.fullmatch(key), "unexpected_storage_key")
    directory = os.open(storage, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        descriptor = os.open(key, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=directory)
        with os.fdopen(descriptor, "rb") as source:
            info = os.fstat(source.fileno())
            require(stat.S_ISREG(info.st_mode) and info.st_uid == os.geteuid(), "stored_file_not_owned")
            require(stat.S_IMODE(info.st_mode) == 0o600, "stored_file_permissions_mismatch")
            require(info.st_size <= 100_000, "smoke_file_unexpectedly_large")
            digest = hashlib.sha256(source.read(100_001)).hexdigest()
        return {"device": info.st_dev, "inode": info.st_ino, "sha256": digest, "size": info.st_size}
    finally:
        os.close(directory)


def verify_rows(factory, manifest):
    from sqlalchemy import select
    from app.models import Sample

    with factory() as session:
        rows = session.scalars(select(Sample).where(Sample.id_user == manifest.user_id)).all()
        require({row.id_sample for row in rows} == {item["id_sample"] for item in manifest.samples},
                "unexpected_sample_rows_for_run")
        for row in rows:
            owned = next(item for item in manifest.samples if item["id_sample"] == row.id_sample)
            require(row.path_penyimpanan == owned["key"] and row.nama_berkas == owned["filename"]
                    and row.ukuran_berkas == owned["size"]
                    and row.waktu_unggah.isoformat() == owned["database_time"], "sample_metadata_changed")
    require({path.name for path in manifest.storage.iterdir()} == {item["key"] for item in manifest.samples},
            "unexpected_files_in_run_storage")
    for item in manifest.samples:
        require(inspect_file(manifest.storage, item["key"]) == item["file"], "stored_file_identity_changed")


def cleanup_owned(factory, check, manifest):
    """RUN ONLY: delete exact owned rows, confirm commit, then unlink exact inodes."""
    from sqlalchemy import delete, or_, select, text
    from app.models import Sample, User

    verify_rows(factory, manifest)
    with factory() as session:
        check(session)
        # Recheck non-cascading schema before deletion; never delete child Job/Genotype rows.
        with session.connection().connection.driver_connection.cursor() as cursor:
            inspect_schema(cursor)
        ids = [item["id_sample"] for item in manifest.samples]
        keys = [item["key"] for item in manifest.samples]
        require(session.scalar(text("SELECT count(*) FROM public.job WHERE id_user=:owner OR id_sample=ANY(:ids)"),
                               {"owner": manifest.user_id, "ids": ids}) == 0, "unexpected_job_reference")
        require(session.scalar(text("SELECT count(*) FROM public.genotype WHERE id_sample=ANY(:ids)"),
                               {"ids": ids}) == 0, "unexpected_genotype_reference")
        foreign = session.scalars(select(Sample.id_sample).where(
            Sample.path_penyimpanan.in_(keys), or_(Sample.id_user != manifest.user_id, Sample.id_sample.not_in(ids)),
        )).all()
        require(not foreign, "unexpected_shared_storage_reference")
        for item in manifest.samples:
            result = session.execute(delete(Sample).where(
                Sample.id_sample == item["id_sample"], Sample.id_user == manifest.user_id,
                Sample.path_penyimpanan == item["key"], Sample.nama_berkas == item["filename"],
                Sample.ukuran_berkas == item["size"],
                Sample.waktu_unggah == datetime.fromisoformat(item["database_time"]),
            ))
            require(result.rowcount == 1, "sample_cleanup_ownership_mismatch")
        result = session.execute(delete(User).where(
            User.id_user == manifest.user_id, User.username == manifest.username,
            User.email == manifest.email, User.role == "user", User.nama == "GenoPath smoke test",
        ))
        require(result.rowcount == 1, "user_cleanup_ownership_mismatch")
        manifest.record("cleanup_commit_attempted", id_user=manifest.user_id, sample_ids=ids)
        session.commit()  # If this raises, NO filesystem deletion is attempted.
    manifest.record("cleanup_commit_confirmed")
    directory = os.open(manifest.storage, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        for item in manifest.samples:
            require(inspect_file(manifest.storage, item["key"]) == item["file"], "cleanup_file_identity_mismatch")
            info = os.stat(item["key"], dir_fd=directory, follow_symlinks=False)
            require((info.st_dev, info.st_ino) == (item["file"]["device"], item["file"]["inode"]),
                    "cleanup_file_replaced")
            os.unlink(item["key"], dir_fd=directory)
        os.fsync(directory)
    finally:
        os.close(directory)
    require(not list(manifest.storage.iterdir()), "cleanup_storage_not_empty")
    manifest.record("cleanup_completed")


def run_smoke(settings, parameters):
    """Explicit --run only. Any failure retains rows/files/manifest for review."""
    import secrets
    from unittest.mock import patch
    from fastapi.testclient import TestClient
    from pydantic import SecretStr
    from sqlalchemy import select
    from app.core.config import Settings
    from app.core.security import hash_password
    from app.database import get_session_factory
    from app.models import Sample, User
    from app.services.fastq import validate_upload

    preflight(parameters)  # No directory, account, or write before all checks pass.
    manifest = RunManifest()
    engine = None
    try:
        engine, factory, check = guarded_factory(parameters)
        password = secrets.token_urlsafe(32)
        with factory() as session:
            user = User(username=manifest.username, email=manifest.email, nama="GenoPath smoke test",
                        role="user", password_hash=hash_password(password))
            session.add(user)
            session.flush()
            manifest.user_id = user.id_user
            manifest.record("seed_commit_attempted", id_user=user.id_user, email=manifest.email, role="user")
            session.commit()
        manifest.record("seed_commit_confirmed")
        isolated = settings.model_copy(update={
            "database_url": None, "debug": False, "jwt_secret": SecretStr(secrets.token_urlsafe(48)),
            "upload_root": manifest.storage,
        })
        # app.main has a module-level app. Keep its initial Settings harmless too.
        with patch.dict(os.environ, {}, clear=True), patch.dict(Settings.model_config, {"env_file": None}):
            from app.main import create_app
        app = create_app(isolated)
        app.dependency_overrides[get_session_factory] = lambda: factory
        with patch("app.database.get_engine", side_effect=SmokeFailure("unguarded_engine_refused")):
            with TestClient(app, raise_server_exceptions=False) as client:
                login = client.post("/auth/login", json={"username": manifest.username, "password": password})
                require(login.status_code == 200, "login_failed")
                require(login.json().get("token_type") == "bearer", "login_contract_mismatch")
                authorization = {"Authorization": "Bearer " + login.json()["access_token"]}
                for suffix, data in ((".fastq", FASTQ), (".fastq.gz", gzip.compress(FASTQ, mtime=0))):
                    filename = "smoke_" + manifest.run_id + suffix
                    manifest.record("upload_attempted", filename=filename)
                    started = datetime.now(timezone.utc)
                    response = client.post("/samples/upload", headers=authorization,
                                           files={"file": (filename, data, "application/octet-stream")})
                    finished = datetime.now(timezone.utc)
                    require(response.status_code == 201, "upload_not_confirmed_reconcile_before_cleanup")
                    body = response.json()
                    require(set(body) == {"id_sample", "nama_berkas", "ukuran_berkas", "waktu_unggah"},
                            "upload_response_contract_mismatch")
                    with factory() as session:
                        row = session.scalar(select(Sample).where(Sample.id_sample == body["id_sample"],
                                                                  Sample.id_user == manifest.user_id))
                        require(row is not None, "committed_sample_not_found")
                        timestamp = datetime.fromisoformat(body["waktu_unggah"].replace("Z", "+00:00"))
                        require(started <= timestamp <= finished and timestamp.utcoffset().total_seconds() == 0,
                                "response_timestamp_mismatch")
                        require(row.nama_berkas == body["nama_berkas"] == filename
                                and row.ukuran_berkas == body["ukuran_berkas"] == len(data)
                                and row.waktu_unggah == timestamp.replace(tzinfo=None), "committed_metadata_mismatch")
                        file_info = inspect_file(manifest.storage, row.path_penyimpanan)
                        require(file_info["sha256"] == hashlib.sha256(data).hexdigest(), "stored_bytes_mismatch")
                        key = row.path_penyimpanan
                        entry = {"id_sample": row.id_sample, "key": key, "filename": filename,
                                 "size": len(data), "database_time": row.waktu_unggah.isoformat(), "file": file_info}
                    # The small, already identity-checked fixture is validated through the same pure parser.
                    descriptor = os.open(manifest.storage / key, os.O_RDONLY | os.O_NOFOLLOW)
                    with os.fdopen(descriptor, "rb") as source:
                        validate_upload(source, suffix, max_bytes=100_000, max_line_bytes=1024)
                    manifest.samples.append(entry)
                    manifest.record("sample_verified", **entry)
                verify_rows(factory, manifest)
                for headers in ({}, {"Authorization": "Bearer invalid"}):
                    require(client.post("/samples/upload", headers=headers, files={"file": ("bad.fastq", FASTQ)}).
                            status_code == 401, "negative_jwt_failed")
                for filename, data in (("bad.fastq", b"invalid"), ("bad.fastq.gz", b"invalid"), ("empty.fastq", b"")):
                    require(client.post("/samples/upload", headers=authorization,
                                        files={"file": (filename, data)}).status_code == 422, "negative_fastq_failed")
                require(client.post("/samples/upload", headers=authorization,
                                    files={"file": ("small.fastq", FASTQ)}, data={"extra": "refused"}).status_code
                        == 422, "negative_extra_field_failed")
                bad_headers = {**authorization, "Content-Type": "multipart/form-data; boundary=smoke-boundary"}
                require(client.post("/samples/upload", headers=bad_headers, content=b"broken").status_code == 400,
                        "negative_multipart_failed")
                app.state.settings = isolated.model_copy(update={"upload_max_bytes": len(FASTQ) - 1})
                try:
                    require(client.post("/samples/upload", headers=authorization,
                                        files={"file": ("limit.fastq", FASTQ)}).status_code == 413, "negative_limit_failed")
                finally:
                    app.state.settings = isolated
                verify_rows(factory, manifest)
                require(client.get("/health").status_code == 200, "health_failed")
        manifest.record("checks_completed", samples=2, negative_checks=8)
        cleanup_owned(factory, check, manifest)
        return {"mode": "run", "database": DATABASE, "status": "passed", "samples": 2,
                "cleanup": "confirmed", "manifest": str(manifest.root / "manifest.jsonl")}
    except BaseException:
        # No cleanup on ANY failed/uncertain run. Even a 503 can follow a committed upload.
        try:
            files = [{"name": path.name, "device": path.lstat().st_dev, "inode": path.lstat().st_ino}
                     for path in manifest.storage.iterdir()]
            manifest.record("reconciliation_required", id_user=manifest.user_id, files=files)
        except Exception:
            pass
        print(json.dumps({"mode": "run", "status": "retained_for_reconciliation",
                          "manifest": str(manifest.root / "manifest.jsonl")}))
        raise
    finally:
        if engine is not None:
            engine.dispose()
        manifest.file.close()


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group(required=True)
    modes.add_argument("--preflight", action="store_true", help="Read-only testing-database checks only")
    modes.add_argument("--run", action="store_true", help="WRITES: requires separate approval before execution")
    args = parser.parse_args(argv)
    # Process-local only. No SQL/HTTP tracebacks or credential-bearing library logs.
    logging.disable(logging.CRITICAL)
    try:
        settings, parameters = load_configuration()
        report = preflight(parameters) if args.preflight else run_smoke(settings, parameters)
        print(json.dumps(report, sort_keys=True))
        return 0
    except SmokeFailure as error:
        print(json.dumps({"status": "blocked", "check": str(error)}))
    except psycopg.Error as error:
        sqlstate = error.sqlstate if error.sqlstate and re.fullmatch(r"[0-9A-Z]{5}", error.sqlstate) else None
        print(json.dumps({"status": "blocked", "check": "postgres_connection_or_read_check_failed",
                          "sqlstate": sqlstate}))
    except KeyboardInterrupt:
        print(json.dumps({"status": "interrupted", "check": "review_manifest_if_run_was_started"}))
    except Exception:
        # Runner boundary deliberately suppresses raw settings, SQL, and driver errors.
        print(json.dumps({"status": "blocked", "check": "configuration_or_runner_failed_details_hidden"}))
    return 1


if __name__ == "__main__":
    sys.exit(main())
