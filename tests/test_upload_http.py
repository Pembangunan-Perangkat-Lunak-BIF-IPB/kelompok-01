import asyncio
from io import BytesIO
import gzip
import os
from pathlib import Path
import secrets
import signal
import subprocess
from threading import Event
from types import SimpleNamespace
from unittest.mock import Mock

from pydantic import SecretStr
import pytest
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError

from app.api.dependencies import get_current_user
from app.api.routes import samples
from app.core.config import Settings
from app.core.security import create_access_token
from app.database import get_session_factory
from app.models import Sample, User
from app.services import multipart_upload, upload_validation
from app.services.fastq import InvalidFastqError, UploadLimitError
from app.services.multipart_upload import MultipartUpload, receive_upload
from app.services.storage import LocalStorage, StagedUpload, StorageError
from app.services.upload_validation import (
    UploadCancelled, ValidationBudgetError, joined_thread, stage_and_validate, validate_in_process,
)


FASTQ = b"@read\nACGT\n+\n!!!!\n"
CONTENT_TYPE = b"multipart/form-data; boundary=test-boundary"


def multipart(data=FASTQ, filename="reads.fastq", field="file", extra_headers=b""):
    return (
        b"--test-boundary\r\nContent-Disposition: form-data; name=\"" + field.encode()
        + b"\"; filename=\"" + filename.encode() + b"\"\r\n" + extra_headers
        + b"\r\n" + data + b"\r\n--test-boundary--\r\n"
    )


async def call_app(application, body=b"", *, headers=None, method="POST", path="/samples/upload",
                   chunk_size=7, disconnect=False, forbid_receive=False, before_receive=None):
    scope = {
        "type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1",
        "method": method, "scheme": "http", "path": path, "raw_path": path.encode(),
        "query_string": b"", "headers": headers if headers is not None else [(b"content-type", CONTENT_TYPE)],
        "client": ("127.0.0.1", 1234), "server": ("test", 80), "root_path": "",
    }
    messages = []
    offset = 0
    reads = 0

    async def receive():
        nonlocal offset, reads
        reads += 1
        if forbid_receive:
            raise AssertionError("Body read before authentication or admission")
        if before_receive is not None:
            before_receive()
        if disconnect and offset >= len(body) // 2:
            return {"type": "http.disconnect"}
        data = body[offset:offset + chunk_size]
        offset += len(data)
        return {"type": "http.request", "body": data, "more_body": offset < len(body)}

    async def send(message):
        messages.append(message)

    await application(scope, receive, send)
    import json
    response = next(message for message in messages if message["type"] == "http.response.start")
    content = b"".join(message.get("body", b"") for message in messages if message["type"] == "http.response.body")
    return SimpleNamespace(status=response["status"], headers=dict(response["headers"]),
                           body=json.loads(content), reads=reads)


@pytest.fixture(autouse=True)
def isolated_upload_environment(monkeypatch):
    monkeypatch.setattr(Settings, "model_config", {**Settings.model_config, "env_file": None})
    for name in ("DATABASE_URL", "GENOPATH_JWT_SECRET"):
        monkeypatch.delenv(name, raising=False)
    forbidden = Mock(side_effect=AssertionError("Upload tests must not access a database"))
    monkeypatch.setattr("app.database.get_engine", forbidden)
    monkeypatch.setattr("sqlalchemy.create_engine", forbidden)
    monkeypatch.setattr("sqlalchemy.engine.Engine.connect", forbidden)
    monkeypatch.setattr("sqlalchemy.MetaData.create_all", forbidden)
    yield
    forbidden.assert_not_called()
    assert not samples.upload_slot.locked()


@pytest.fixture
def case(tmp_path, app_factory, monkeypatch):
    settings = Settings(_env_file=None, upload_root=tmp_path / "storage", upload_chunk_bytes=7)
    application = app_factory(settings)

    async def authenticated():
        return User(id_user=7)

    application.dependency_overrides[get_current_user] = authenticated
    sessions = []
    committed = []
    reconciliation_keys = set()

    def make_session():
        session = Mock(spec=Session)
        pending = []
        session.get.return_value = User(id_user=7)
        session.add.side_effect = pending.append

        def flush():
            assert len(pending) == 1
            pending[0].id_sample = 42 + len(committed)

        session.flush.side_effect = flush
        session.commit.side_effect = lambda: committed.extend(pending)
        sessions.append(session)
        return session

    factory = Mock(side_effect=make_session)
    application.dependency_overrides[get_session_factory] = lambda: factory
    temporary_files = []
    real_temporary_file = multipart_upload.tempfile.TemporaryFile

    def temporary_file(*args, **kwargs):
        target = real_temporary_file(*args, **kwargs, dir=tmp_path)
        temporary_files.append(target)
        return target

    monkeypatch.setattr(multipart_upload.tempfile, "TemporaryFile", temporary_file)
    yield SimpleNamespace(app=application, settings=settings, temporary_files=temporary_files,
                          sessions=sessions, committed=committed, factory=factory,
                          reconciliation_keys=reconciliation_keys)
    assert all(file.closed for file in temporary_files)
    assert all(session.close.called for session in sessions)
    stored_keys = {path.name for path in settings.upload_root.iterdir()} if settings.upload_root.exists() else set()
    assert stored_keys == {sample.path_penyimpanan for sample in committed} | reconciliation_keys


@pytest.mark.parametrize("compressed", [False, True])
def test_upload_validates_in_real_worker_and_persists_owned_sample(case, compressed):
    data = gzip.compress(FASTQ, mtime=0) if compressed else FASTQ
    name = "reads.fastq.gz" if compressed else "reads.fastq"
    response = asyncio.run(call_app(case.app, multipart(data, name)))
    assert response.status == 201
    assert set(response.body) == {"id_sample", "nama_berkas", "ukuran_berkas", "waktu_unggah"}
    assert response.body["id_sample"] == 42
    assert response.body["nama_berkas"] == name
    assert response.body["ukuran_berkas"] == len(data)
    assert response.body["waktu_unggah"].endswith("Z")
    sample, = case.committed
    assert isinstance(sample, Sample) and sample.id_user == 7
    assert sample.nama_berkas == name and sample.ukuran_berkas == len(data)
    assert sample.waktu_unggah.tzinfo is None
    assert not Path(sample.path_penyimpanan).is_absolute()
    assert sample.path_penyimpanan.endswith(".fastq.gz" if compressed else ".fastq")
    assert (case.settings.upload_root / sample.path_penyimpanan).read_bytes() == data
    assert len(case.sessions) == 2
    case.sessions[0].commit.assert_not_called()
    case.sessions[1].commit.assert_called_once()


@pytest.mark.parametrize("authorization", [None, b"Basic invalid", b"Bearer invalid"])
def test_invalid_auth_does_not_read_huge_body_or_create_temporary_files(case, authorization):
    case.app.dependency_overrides.clear()
    case.app.state.settings = case.settings.model_copy(update={"jwt_secret": SecretStr(secrets.token_urlsafe(48))})
    headers = [(b"content-type", CONTENT_TYPE), (b"content-length", b"9000000000")]
    if authorization is not None:
        headers.append((b"authorization", authorization))
    response = asyncio.run(call_app(case.app, headers=headers, forbid_receive=True))
    assert response.status == 401
    assert response.headers[b"www-authenticate"] == b"Bearer"
    assert response.reads == 0
    assert case.temporary_files == []


def test_real_jwt_dependency_uses_mock_auth_and_separate_write_session(case):
    case.app.dependency_overrides.clear()
    settings = case.settings.model_copy(update={"jwt_secret": SecretStr(secrets.token_urlsafe(48))})
    case.app.state.settings = settings
    case.app.dependency_overrides[get_session_factory] = lambda: case.factory
    token = create_access_token(7, settings)
    headers = [(b"content-type", CONTENT_TYPE), (b"authorization", ("Bearer " + token).encode())]
    response = asyncio.run(call_app(case.app, multipart(), headers=headers))
    assert response.status == 201
    auth_session, write_session = case.sessions
    auth_session.get.assert_called_once_with(User, 7)
    assert auth_session.close.call_count == 2  # Early release and dependency teardown.
    for method in (auth_session.add, auth_session.flush, auth_session.commit, auth_session.delete):
        method.assert_not_called()
    write_session.add.assert_called_once()
    write_session.commit.assert_called_once()
    write_session.get.assert_not_called()


@pytest.mark.parametrize("compressed", [False, True])
@pytest.mark.parametrize("delta", [-1, 0, 1])
def test_http_file_size_limit_inclusive_without_content_length(case, compressed, delta):
    data = gzip.compress(FASTQ, mtime=0) if compressed else FASTQ
    case.settings.upload_max_bytes = len(data) - delta
    response = asyncio.run(call_app(case.app, multipart(data, "reads.fastq.gz" if compressed else "reads.fastq")))
    assert response.status == (413 if delta == 1 else 201)


@pytest.mark.parametrize("declared", [None, "correct", "0", "1", "larger", "-1", "abc", "9000000000"])
def test_content_length_is_checked_and_not_trusted(case, declared):
    data = multipart()
    headers = [(b"content-type", CONTENT_TYPE)]
    if declared is not None:
        value = str(len(data)) if declared == "correct" else str(len(data) + 1) if declared == "larger" else declared
        headers.append((b"content-length", value.encode()))
    response = asyncio.run(call_app(case.app, data, headers=headers))
    expected = 201 if declared in (None, "correct") else 413 if declared == "9000000000" else 400
    assert response.status == expected
    if declared in ("-1", "abc", "9000000000"):
        assert response.reads == 0


@pytest.mark.parametrize("kind", ["second-file", "extra-field", "text-field", "wrong-name", "missing", "duplicate-header"])
def test_parts_and_fields_are_strict(case, kind):
    data = multipart()
    if kind in ("second-file", "extra-field"):
        extra = (b'Content-Disposition: form-data; name="file"; filename="other.fastq"'
                 if kind == "second-file" else b'Content-Disposition: form-data; name="extra"')
        data = data.replace(b"--test-boundary--\r\n", b"--test-boundary\r\n" + extra + b"\r\n\r\nx\r\n--test-boundary--\r\n")
    elif kind == "text-field":
        data = data.replace(b'; filename="reads.fastq"', b"")
    elif kind == "wrong-name":
        data = multipart(field="other")
    elif kind == "missing":
        data = b"--test-boundary--\r\n"
    else:
        data = multipart(extra_headers=b"Content-Disposition: form-data\r\n")
    response = asyncio.run(call_app(case.app, data))
    assert response.status == (400 if kind == "duplicate-header" else 422)


@pytest.mark.parametrize("data", [b"", b"not multipart", multipart()[:-10], multipart().replace(b"\r\n", b"\n")])
def test_malformed_and_truncated_multipart(case, data):
    assert asyncio.run(call_app(case.app, data)).status == 400


@pytest.mark.parametrize("filename,data", [
    ("../reads.fastq", FASTQ), ("C:\\data\\reads.fastq", FASTQ),
    ("\\\\server\\reads.fastq", FASTQ), ("reads.txt", FASTQ), ("reads.fastq", b""),
    ("reads.fastq", b"bad FASTQ"), ("reads.fastq.gz", b"bad gzip"),
    ("reads.fastq.gz", gzip.compress(FASTQ, mtime=0)[:-3]),
])
def test_invalid_filename_fastq_and_gzip_are_cleaned(case, filename, data):
    assert asyncio.run(call_app(case.app, multipart(data, filename))).status == 422


def test_decompression_limit_returns_413(case):
    case.settings.upload_max_decompressed_bytes = len(FASTQ) - 1
    assert asyncio.run(call_app(case.app, multipart(gzip.compress(FASTQ), "reads.fastq.gz"))).status == 413


@pytest.mark.parametrize("content_type,status", [(b"application/json", 415), (b"multipart/form-data", 400)])
def test_media_type_and_boundary_rejected_before_body(case, content_type, status):
    response = asyncio.run(call_app(case.app, headers=[(b"content-type", content_type)], forbid_receive=True))
    assert response.status == status


def test_disconnect_is_rejected_and_closes_incoming_file(case):
    assert asyncio.run(call_app(case.app, multipart(), disconnect=True)).status == 400


@pytest.mark.parametrize("delta", [-1, 0, 1])
def test_total_header_limit_is_inclusive_even_with_leading_spaces(case, delta):
    # Include all raw header bytes and the final CRLF, including skipped spaces.
    standard = b'Content-Disposition: form-data; name="file"; filename="reads.fastq"\r\n'
    length = multipart_upload.HEADER_BYTES + delta
    extra = b"X-Test:" + b" " * (length - len(standard) - len(b"X-Test:\r\n\r\n")) + b"\r\n"
    response = asyncio.run(call_app(case.app, multipart(extra_headers=extra), chunk_size=257))
    assert response.status == (413 if delta == 1 else 201)


@pytest.mark.parametrize("delta", [-1, 0, 1])
def test_total_body_limit_inclusive_with_small_policy(case, monkeypatch, delta):
    data = multipart()
    # Exact body limit is set with a small overhead budget, without large fixtures.
    monkeypatch.setattr(multipart_upload, "OVERHEAD_BYTES", len(data) - len(FASTQ) - delta)
    case.settings.upload_max_bytes = len(FASTQ)
    response = asyncio.run(call_app(case.app, data))
    assert response.status == (413 if delta == 1 else 201)


def test_parser_feeds_and_file_writes_are_bounded(case, monkeypatch):
    original_feed = MultipartUpload.feed
    sizes = []

    def feed(self, chunk):
        sizes.append(len(chunk))
        assert len(chunk) <= 65_536
        return original_feed(self, chunk)

    monkeypatch.setattr(MultipartUpload, "feed", feed)
    response = asyncio.run(call_app(case.app, multipart(FASTQ * 6000), chunk_size=10**6))
    assert response.status == 201
    assert len(sizes) > 1


def test_concurrent_request_rejected_without_body_and_slot_released(case, monkeypatch, app_factory):
    second_app = app_factory(case.settings)
    second_app.dependency_overrides.update(case.app.dependency_overrides)
    async def scenario():
        entered = asyncio.Event()
        release = asyncio.Event()
        original = samples.persist_upload

        async def hold(*args):
            entered.set()
            await release.wait()
            return await original(*args)

        monkeypatch.setattr(samples, "persist_upload", hold)
        first = asyncio.create_task(call_app(case.app, multipart()))
        await asyncio.wait_for(entered.wait(), 5)
        try:
            second = await call_app(second_app, forbid_receive=True)
            assert second.status == 503
            assert second.headers[b"retry-after"] == b"1"
            assert second.reads == 0
        finally:
            release.set()
        assert (await first).status == 201

    asyncio.run(scenario())


@pytest.mark.parametrize("error,status", [(OSError("private-marker"), 503), (StorageError("private-marker"), 503),
                                         (ValidationBudgetError("private-marker"), 422)])
def test_service_and_budget_errors_are_sanitized_and_release_slot(case, monkeypatch, error, status):
    async def fail(*args):
        raise error

    monkeypatch.setattr(samples, "persist_upload", fail)
    response = asyncio.run(call_app(case.app, multipart()))
    assert response.status == status
    assert "private-marker" not in str(response.body)


def test_openapi_retains_picker_bearer_and_final_contract(case):
    operation = case.app.openapi()["paths"]["/samples/upload"]["post"]
    assert operation["security"] == [{"HTTPBearer": []}]
    body = operation["requestBody"]["content"]["multipart/form-data"]["schema"]
    assert body["properties"]["file"] == {"type": "string", "format": "binary"}
    assert body["required"] == ["file"]
    assert body["additionalProperties"] is False
    assert "201" in operation["responses"] and "200" not in operation["responses"]
    schema = case.app.openapi()["components"]["schemas"]["SampleUploadResponse"]
    assert set(schema["properties"]) == {"id_sample", "nama_berkas", "ukuran_berkas", "waktu_unggah"}


def test_health_remains_public_without_secret_and_without_body_read(case):
    case.app.dependency_overrides.clear()
    response = asyncio.run(call_app(case.app, method="GET", path="/health", headers=[], forbid_receive=True))
    assert response.status == 200
    assert response.body == {"status": "ok"}


@pytest.mark.parametrize("field,value", [("upload_validation_cpu_seconds", 0),
                                        ("upload_validation_wall_seconds", 0),
                                        ("upload_validation_wall_seconds", float("inf"))])
def test_validation_limits_require_positive_finite_values(field, value):
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        Settings(_env_file=None, **{field: value})


@pytest.mark.parametrize("chunk_size", [1, 7, 65_536])
def test_parser_callbacks_handle_fragmented_headers_and_boundaries(tmp_path, chunk_size):
    from starlette.requests import Request
    request = Request({"type": "http", "headers": [(b"content-type", CONTENT_TYPE)]})
    parser = MultipartUpload(request, Settings(_env_file=None, upload_max_bytes=len(FASTQ)))
    parser.file = BytesIO()
    data = multipart(extra_headers=b"X-Empty:   \r\n")
    for offset in range(0, len(data), chunk_size):
        parser.feed(data[offset:offset + chunk_size])
    parser.finish()
    assert parser.file.read() == FASTQ
    assert parser.filename == "reads.fastq"


@pytest.mark.parametrize("delta", [-1, 0, 1])
def test_parser_never_writes_bytes_past_file_limit(delta):
    from starlette.requests import Request
    request = Request({"type": "http", "headers": [(b"content-type", CONTENT_TYPE)]})
    limit = len(FASTQ) - delta
    parser = MultipartUpload(request, Settings(_env_file=None, upload_max_bytes=limit))
    parser.file = BytesIO()
    if delta == 1:
        with pytest.raises(UploadLimitError):
            for byte in multipart():
                parser.feed(bytes([byte]))
        assert len(parser.file.getvalue()) <= limit
    else:
        for byte in multipart():
            parser.feed(bytes([byte]))
        parser.finish()
        assert parser.file.read() == FASTQ


@pytest.mark.parametrize("data,suffix,error_type", [
    (FASTQ, ".fastq", None), (gzip.compress(FASTQ), ".fastq.gz", None),
    (gzip.compress(b"") * 20 + gzip.compress(FASTQ), ".fastq.gz", None),
    (b"bad", ".fastq", InvalidFastqError),
    (gzip.compress(FASTQ)[:-3], ".fastq.gz", InvalidFastqError),
    (gzip.compress(FASTQ * 10), ".fastq.gz", UploadLimitError),
])
def test_worker_real_validation_uses_pure_parser_without_database(tmp_path, data, suffix, error_type):
    source_path = tmp_path / "source"
    source_path.write_bytes(data)
    settings = Settings(_env_file=None, upload_max_decompressed_bytes=len(FASTQ) * 2)
    with source_path.open("rb") as source:
        if error_type is None:
            validate_in_process(source, suffix, settings, Event())
        else:
            with pytest.raises(error_type):
                validate_in_process(source, suffix, settings, Event())


class FakeProcess:
    def __init__(self, code=0, hang=False, cancel=None):
        self.code = code
        self.returncode = None
        self.hang = hang
        self.cancel = cancel
        self.killed = False
        self.reaped = False

    def __enter__(self):
        return self

    def __exit__(self, *args):
        assert self.returncode is not None

    def wait(self, timeout=None):
        if timeout is None:
            self.reaped = True
        if self.cancel is not None:
            self.cancel.set()
        if self.hang and not self.killed:
            raise subprocess.TimeoutExpired("isolated-test-worker", timeout)
        self.returncode = -signal.SIGKILL if self.killed else self.code
        return self.returncode

    def poll(self):
        return self.returncode

    def kill(self):
        self.killed = True


@pytest.mark.parametrize("code,error_type", [(0, None), (2, InvalidFastqError), (3, UploadLimitError),
                                            (-signal.SIGXCPU, ValidationBudgetError), (70, StorageError)])
def test_worker_protocol_and_minimal_read_only_environment(tmp_path, monkeypatch, code, error_type):
    import fcntl
    settings = Settings(_env_file=None)
    source_path = tmp_path / "source.fastq"
    source_path.write_bytes(FASTQ)
    process = FakeProcess(code)
    passed_descriptors = []

    def spawn(command, **kwargs):
        assert command[1:3] == ["-I", "-B"]
        assert kwargs["env"] == {}
        assert "preexec_fn" not in kwargs and "shell" not in kwargs
        assert kwargs["stdout"] == kwargs["stderr"] == subprocess.DEVNULL
        descriptor, = kwargs["pass_fds"]
        assert fcntl.fcntl(descriptor, fcntl.F_GETFL) & os.O_ACCMODE == os.O_RDONLY
        passed_descriptors.append(descriptor)
        return process

    monkeypatch.setattr(upload_validation.subprocess, "Popen", spawn)
    with source_path.open("rb") as source:
        if error_type is None:
            validate_in_process(source, ".fastq", settings, Event())
        else:
            with pytest.raises(error_type):
                validate_in_process(source, ".fastq", settings, Event())
    assert process.reaped
    for descriptor in passed_descriptors:
        with pytest.raises(OSError):
            os.fstat(descriptor)


@pytest.mark.parametrize("cancelled", [False, True])
def test_worker_timeout_or_cancel_kills_reaps_then_storage_cleans(tmp_path, monkeypatch, cancelled):
    stop = Event()
    process = FakeProcess(hang=True, cancel=stop if cancelled else None)
    monkeypatch.setattr(upload_validation.subprocess, "Popen", lambda *args, **kwargs: process)
    clock = iter([0, 0, 2, 3])
    monkeypatch.setattr(upload_validation.time, "monotonic", lambda: next(clock))
    settings = Settings(_env_file=None, upload_root=tmp_path / "storage", upload_validation_wall_seconds=1)

    def validator(source, suffix):
        validate_in_process(source, suffix, settings, stop)

    # Observe cleanup ordering, not just the final filesystem contents.
    real_unlink = os.unlink

    def unlink(*args, **kwargs):
        assert process.killed and process.reaped
        return real_unlink(*args, **kwargs)

    monkeypatch.setattr("app.services.storage.os.unlink", unlink)
    with pytest.raises(UploadCancelled if cancelled else ValidationBudgetError):
        with LocalStorage(settings).stage(BytesIO(FASTQ), "reads.fastq", validator=validator):
            pytest.fail("Validation failure was ignored")
    assert list(settings.upload_root.iterdir()) == []


def test_worker_spawn_failure_closes_passed_descriptor_and_cleans_stage(tmp_path, monkeypatch):
    passed = []

    def fail_spawn(*args, **kwargs):
        passed.extend(kwargs["pass_fds"])
        raise OSError("private-worker-marker")

    monkeypatch.setattr(upload_validation.subprocess, "Popen", fail_spawn)
    settings = Settings(_env_file=None, upload_root=tmp_path / "storage")
    with pytest.raises(StorageError, match="Could not stage upload"):
        with LocalStorage(settings).stage(
            BytesIO(FASTQ), "reads.fastq",
            validator=lambda source, suffix: validate_in_process(source, suffix, settings, Event()),
        ):
            pytest.fail("Spawn failure was ignored")
    assert list(settings.upload_root.iterdir()) == []
    for descriptor in passed:
        with pytest.raises(OSError):
            os.fstat(descriptor)


def test_real_subprocess_is_killed_on_wall_timeout_before_cleanup(case, monkeypatch):
    real_popen = subprocess.Popen
    processes = []

    def spawn_sleep(command, **kwargs):
        process = real_popen([command[0], "-I", "-B", "-c", "import time; time.sleep(30)"], **kwargs)
        processes.append(process)
        return process

    monkeypatch.setattr(upload_validation.subprocess, "Popen", spawn_sleep)
    case.settings.upload_validation_wall_seconds = 0.05
    response = asyncio.run(call_app(case.app, multipart()))
    assert response.status == 422
    assert len(processes) == 1
    assert processes[0].poll() is not None


def test_request_cancellation_waits_for_real_worker_before_cleanup(case, monkeypatch):
    real_popen = subprocess.Popen
    entered = Event()
    processes = []

    def spawn_sleep(command, **kwargs):
        process = real_popen([command[0], "-I", "-B", "-c", "import time; time.sleep(30)"], **kwargs)
        processes.append(process)
        entered.set()
        return process

    monkeypatch.setattr(upload_validation.subprocess, "Popen", spawn_sleep)

    async def scenario():
        task = asyncio.create_task(call_app(case.app, multipart()))
        try:
            async with asyncio.timeout(5):
                while not entered.is_set():
                    await asyncio.sleep(0.01)
            task.cancel()
            with pytest.raises(asyncio.CancelledError):
                await task
            assert processes[0].poll() is not None
            assert not samples.upload_slot.locked()
        finally:
            if not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

    asyncio.run(scenario())


def test_cancellation_during_multipart_write_joins_thread_before_close(case, monkeypatch):
    original = MultipartUpload.feed
    entered, release = Event(), Event()

    def hold(self, data):
        entered.set()
        assert release.wait(5)
        assert not self.file.closed
        original(self, data)

    monkeypatch.setattr(MultipartUpload, "feed", hold)

    async def scenario():
        task = asyncio.create_task(call_app(case.app, multipart()))
        try:
            async with asyncio.timeout(5):
                while not entered.is_set():
                    await asyncio.sleep(0.01)
            task.cancel()
            await asyncio.sleep(0.01)
            assert not task.done()
            assert not case.temporary_files[0].closed
            release.set()
            with pytest.raises(asyncio.CancelledError):
                await task
        finally:
            release.set()
            if not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

    asyncio.run(scenario())


def test_auth_read_session_closed_before_receive_and_no_writer_until_validation(case, monkeypatch):
    real_validate = upload_validation.validate_in_process

    def before_receive():
        assert len(case.sessions) == 1
        assert case.sessions[0].close.called
        case.sessions[0].add.assert_not_called()

    def validate(*args):
        before_receive()
        return real_validate(*args)

    monkeypatch.setattr(upload_validation, "validate_in_process", validate)
    response = asyncio.run(call_app(case.app, multipart(), before_receive=before_receive))
    assert response.status == 201
    assert len(case.sessions) == 2
    case.sessions[1].commit.assert_called_once()


@pytest.mark.parametrize("existing_root", [False, True])
def test_storage_parent_sync_failure_returns_503_before_sample_session(case, monkeypatch, existing_root):
    from app.services import storage

    if existing_root:
        case.settings.upload_root.mkdir(mode=0o700)
    parent = case.settings.upload_root.parent.stat()
    real_sync = os.fsync

    def fail_parent_sync(descriptor):
        info = os.fstat(descriptor)
        if (info.st_dev, info.st_ino) == (parent.st_dev, parent.st_ino):
            raise OSError("private-parent-sync-marker")
        real_sync(descriptor)

    monkeypatch.setattr(storage.os, "fsync", fail_parent_sync)
    response = asyncio.run(call_app(case.app, multipart()))
    assert response.status == 503
    assert "private-parent-sync-marker" not in str(response.body)
    assert len(case.sessions) == 1  # Authentication only; no Sample writer session.
    case.sessions[0].close.assert_called()
    case.sessions[0].add.assert_not_called()
    case.sessions[0].commit.assert_not_called()
    assert case.committed == []
    assert all(file.closed for file in case.temporary_files)
    if case.settings.upload_root.exists():
        assert list(case.settings.upload_root.iterdir()) == []


def test_auth_session_close_failure_returns_503_without_reading_body(case):
    original_factory = case.factory.side_effect

    def factory():
        db = original_factory()
        db.close.side_effect = [OperationalError(None, None, RuntimeError("private-close-marker")), None]
        return db

    case.factory.side_effect = factory
    response = asyncio.run(call_app(case.app, forbid_receive=True))
    assert response.status == 503 and response.reads == 0
    assert "private-close-marker" not in str(response.body)
    assert case.temporary_files == []


@pytest.mark.parametrize("phase", ["flush", "finalize", "commit"])
def test_persistence_http_failures_cleanup_or_preserve_and_sanitize(case, monkeypatch, caplog, phase):
    original_factory = case.factory.side_effect

    def factory():
        db = original_factory()
        if phase == "flush":
            db.flush.side_effect = OperationalError(None, None, RuntimeError("private-flush-marker"))
        if phase == "commit":
            def commit():
                row = db.add.call_args.args[0]
                case.reconciliation_keys.add(row.path_penyimpanan)
                raise OperationalError(None, None, RuntimeError("private-commit-marker"))
            db.commit.side_effect = commit
        return db

    case.factory.side_effect = factory
    if phase == "finalize":
        monkeypatch.setattr(StagedUpload, "finalize", Mock(side_effect=StorageError("private-finalize-marker")))
    response = asyncio.run(call_app(case.app, multipart()))
    assert response.status == 503
    assert "private-" not in str(response.body) + caplog.text
    write_session = case.sessions[-1]
    write_session.rollback.assert_called_once()
    if phase == "commit":
        assert len(case.reconciliation_keys) == 1
        key, = case.reconciliation_keys
        assert (case.settings.upload_root / key).read_bytes() == FASTQ
    else:
        write_session.commit.assert_not_called()
        assert list(case.settings.upload_root.iterdir()) == []


@pytest.mark.parametrize("phase", ["flush", "commit-success", "commit-ambiguous"])
def test_cancellation_during_persistence_waits_and_preserves_commit_boundary(case, phase):
    entered, release = Event(), Event()
    original_factory = case.factory.side_effect

    def factory():
        db = original_factory()
        if phase == "flush":
            original_flush = db.flush.side_effect

            def flush():
                original_flush()
                entered.set()
                assert release.wait(5)

            db.flush.side_effect = flush
        else:
            original_commit = db.commit.side_effect

            def commit():
                row = db.add.call_args.args[0]
                case.reconciliation_keys.add(row.path_penyimpanan)
                entered.set()
                assert release.wait(5)
                if phase == "commit-ambiguous":
                    raise OperationalError(None, None, RuntimeError("private-commit-marker"))
                original_commit()

            db.commit.side_effect = commit
        return db

    case.factory.side_effect = factory

    async def scenario():
        task = asyncio.create_task(call_app(case.app, multipart()))
        try:
            async with asyncio.timeout(5):
                while not entered.is_set():
                    await asyncio.sleep(0.01)
            task.cancel()
            await asyncio.sleep(0.01)
            assert not task.done()
            assert samples.upload_slot.locked()
            assert not case.temporary_files[0].closed
            release.set()
            with pytest.raises(asyncio.CancelledError):
                await task
            write_session = case.sessions[-1]
            if phase == "flush":
                write_session.commit.assert_not_called()
                write_session.rollback.assert_called_once()
                assert list(case.settings.upload_root.iterdir()) == []
            else:
                key, = case.reconciliation_keys
                assert (case.settings.upload_root / key).read_bytes() == FASTQ
                write_session.commit.assert_called_once()
            assert not samples.upload_slot.locked()
        finally:
            release.set()
            if not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

    asyncio.run(scenario())


def test_client_cannot_supply_owner_as_an_extra_form_field(case):
    data = multipart().replace(
        b"--test-boundary--\r\n",
        b'--test-boundary\r\nContent-Disposition: form-data; name="id_user"\r\n\r\n999\r\n--test-boundary--\r\n',
    )
    assert asyncio.run(call_app(case.app, data)).status == 422
    assert case.committed == []
    assert len(case.sessions) == 1
