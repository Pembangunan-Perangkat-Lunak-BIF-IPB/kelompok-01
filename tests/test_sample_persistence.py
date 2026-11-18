from datetime import datetime, timezone
from io import BytesIO
from threading import Event
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models import Sample
from app.services import samples
from app.services.samples import _persist_sample
from app.services.storage import LocalStorage, StagedUpload, StorageError
from app.services.upload_validation import UploadCancelled


FASTQ = b"@read\nACGT\n+\n!!!!\n"


@pytest.fixture(autouse=True)
def isolated_persistence_environment(monkeypatch):
    monkeypatch.setattr(Settings, "model_config", {**Settings.model_config, "env_file": None})
    for name in ("DATABASE_URL", "GENOPATH_JWT_SECRET"):
        monkeypatch.delenv(name, raising=False)
    forbidden = Mock(side_effect=AssertionError("Persistence unit tests must not access a database"))
    monkeypatch.setattr("app.database.get_engine", forbidden)
    monkeypatch.setattr("sqlalchemy.create_engine", forbidden)
    monkeypatch.setattr("sqlalchemy.engine.Engine.connect", forbidden)
    monkeypatch.setattr("sqlalchemy.MetaData.create_all", forbidden)
    yield
    forbidden.assert_not_called()


@pytest.fixture
def case(tmp_path):
    settings = Settings(_env_file=None, upload_root=tmp_path / "storage", upload_chunk_bytes=7)
    db = Mock(spec=Session)
    pending = []
    db.add.side_effect = pending.append

    def flush():
        pending[0].id_sample = 123

    db.flush.side_effect = flush
    return SimpleNamespace(store=LocalStorage(settings), db=db, pending=pending,
                           factory=Mock(return_value=db), stop=Event())


def persist(case):
    with case.store.stage(BytesIO(FASTQ), "original.fastq") as upload:
        return _persist_sample(upload, case.stop, 7, case.factory)


def test_persistence_order_metadata_timestamp_and_no_postcommit_orm_reads(case, monkeypatch):
    events = []
    timestamp = datetime(2030, 1, 2, 3, 4, 5, tzinfo=timezone.utc)
    clock = Mock()
    clock.now.return_value = timestamp
    monkeypatch.setattr(samples, "datetime", clock)
    original_flush = case.db.flush.side_effect
    original_finalize, original_preserve, original_retain = (
        StagedUpload.finalize, StagedUpload.preserve_for_reconciliation, StagedUpload.retain,
    )

    def flush():
        events.append("flush")
        original_flush()

    def finalize(upload):
        events.append("finalize")
        return original_finalize(upload)

    def preserve(upload):
        events.append("preserve")
        original_preserve(upload)

    def retain(upload):
        events.append("retain")
        original_retain(upload)

    def commit():
        events.append("commit")
        sample, = case.pending
        assert (case.store.root / sample.path_penyimpanan).read_bytes() == FASTQ
        assert not list(case.store.root.glob("*.part"))
        # Simulate ORM expiry after commit. The response must already be detached.
        sample.id_sample = None
        sample.nama_berkas = None

    case.db.flush.side_effect = flush
    case.db.commit.side_effect = commit
    monkeypatch.setattr(StagedUpload, "finalize", finalize)
    monkeypatch.setattr(StagedUpload, "preserve_for_reconciliation", preserve)
    monkeypatch.setattr(StagedUpload, "retain", retain)
    response = persist(case)
    sample, = case.pending
    assert isinstance(sample, Sample) and sample.id_user == 7
    assert sample.ukuran_berkas == len(FASTQ)
    assert sample.waktu_unggah == timestamp.replace(tzinfo=None)
    assert response.id_sample == 123 and response.nama_berkas == "original.fastq"
    assert response.waktu_unggah == timestamp
    assert events == ["flush", "finalize", "preserve", "retain", "commit"]
    assert not sample.path_penyimpanan.startswith("/")
    assert len(list(case.store.root.iterdir())) == 1
    case.db.refresh.assert_not_called()
    case.db.get.assert_not_called()
    case.db.rollback.assert_not_called()
    case.db.close.assert_called_once()


@pytest.mark.parametrize("phase", ["factory", "add", "flush", "finalize", "preserve"])
def test_failure_before_commit_rolls_back_and_removes_owned_files(case, monkeypatch, phase):
    error = StorageError("injected-storage-failure") if phase in ("finalize", "preserve") else OperationalError(
        "private-query-marker", {}, RuntimeError("private-driver-marker"),
    )
    if phase == "factory":
        case.factory.side_effect = error
    elif phase in ("add", "flush"):
        getattr(case.db, phase).side_effect = error
    else:
        monkeypatch.setattr(StagedUpload, phase if phase == "finalize" else "preserve_for_reconciliation",
                            Mock(side_effect=error))
    with pytest.raises(type(error)) as caught:
        persist(case)
    assert caught.value is error
    assert list(case.store.root.iterdir()) == []
    case.db.commit.assert_not_called()
    if phase == "factory":
        case.db.rollback.assert_not_called()
        case.db.close.assert_not_called()
    else:
        case.db.rollback.assert_called_once()
        case.db.close.assert_called_once()


def test_partial_finalize_failure_rolls_back_and_removes_published_file(case, monkeypatch):
    original = StagedUpload.finalize

    def fail_after_finalization(upload):
        original(upload)
        raise StorageError("injected-finalize-failure")

    monkeypatch.setattr(StagedUpload, "finalize", fail_after_finalization)
    with pytest.raises(StorageError):
        persist(case)
    assert list(case.store.root.iterdir()) == []
    case.db.rollback.assert_called_once()
    case.db.commit.assert_not_called()


@pytest.mark.parametrize("commit_landed", [False, True])
@pytest.mark.parametrize("rollback_fails", [False, True])
def test_commit_ambiguity_always_preserves_file_even_if_rollback_returns(
    case, caplog, commit_landed, rollback_fails,
):
    error = OperationalError("private-query-marker", {}, RuntimeError("private-driver-marker"))
    durable_rows = []

    def commit():
        if commit_landed:
            durable_rows.extend(case.pending)
        raise error  # Both a lost ACK and a server rejection look uncertain here.

    case.db.commit.side_effect = commit
    if rollback_fails:
        case.db.rollback.side_effect = OperationalError(None, None, RuntimeError("private-rollback-marker"))
    with pytest.raises(OperationalError) as caught:
        persist(case)
    assert caught.value is error
    sample, = case.pending
    assert (case.store.root / sample.path_penyimpanan).read_bytes() == FASTQ
    assert not list(case.store.root.glob("*.part"))
    case.db.rollback.assert_called_once()
    case.db.close.assert_called_once()
    assert bool(durable_rows) == commit_landed
    assert "outcome unknown" in error.__notes__[0]
    assert sample.path_penyimpanan in caplog.text
    assert "original.fastq" not in caplog.text
    assert all(marker not in caplog.text for marker in (
        "private-query-marker", "private-driver-marker", "private-rollback-marker",
    ))


@pytest.mark.parametrize("phase", ["before-session", "flush", "finalize"])
def test_cancellation_before_commit_rolls_back_and_cleans(case, monkeypatch, phase):
    if phase == "before-session":
        case.stop.set()
    elif phase == "flush":
        original = case.db.flush.side_effect

        def flush():
            original()
            case.stop.set()

        case.db.flush.side_effect = flush
    else:
        original = StagedUpload.finalize

        def finalize(upload):
            original(upload)
            case.stop.set()

        monkeypatch.setattr(StagedUpload, "finalize", finalize)
    with pytest.raises(UploadCancelled):
        persist(case)
    assert list(case.store.root.iterdir()) == []
    case.db.commit.assert_not_called()
    if phase == "before-session":
        case.factory.assert_not_called()
    else:
        case.db.rollback.assert_called_once()
        case.db.close.assert_called_once()


def test_cancellation_after_preservation_finishes_protected_commit(case, monkeypatch):
    original = StagedUpload.preserve_for_reconciliation

    def preserve(upload):
        original(upload)
        case.stop.set()

    monkeypatch.setattr(StagedUpload, "preserve_for_reconciliation", preserve)
    assert persist(case).id_sample == 123
    case.db.commit.assert_called_once()
    case.db.rollback.assert_not_called()
    assert len(list(case.store.root.glob("*.fastq"))) == 1


def test_rollback_and_close_errors_do_not_mask_precommit_failure(case):
    primary = OperationalError(None, None, RuntimeError("private-flush-marker"))
    case.db.flush.side_effect = primary
    case.db.rollback.side_effect = OSError("private-rollback-marker")
    case.db.close.side_effect = OSError("private-close-marker")
    with pytest.raises(OperationalError) as caught:
        persist(case)
    assert caught.value is primary
    assert len(primary.__notes__) == 2
    assert all("private" not in note for note in primary.__notes__)
    assert list(case.store.root.iterdir()) == []


def test_session_close_failure_after_known_commit_does_not_turn_success_into_error(case, caplog):
    case.db.close.side_effect = OSError("private-close-marker")
    assert persist(case).id_sample == 123
    assert len(list(case.store.root.glob("*.fastq"))) == 1
    assert "confirmed commit" in caplog.text
    assert "private-close-marker" not in caplog.text


def test_existing_final_file_is_preserved_on_collision_and_transaction_rolled_back(case):
    with case.store.stage(BytesIO(FASTQ), "original.fastq") as upload:
        existing = case.store.root / upload.metadata.storage_key
        existing.write_bytes(b"foreign-file")
        with pytest.raises(StorageError):
            _persist_sample(upload, case.stop, 7, case.factory)
    assert existing.read_bytes() == b"foreign-file"
    assert list(case.store.root.iterdir()) == [existing]
    case.db.rollback.assert_called_once()
    case.db.commit.assert_not_called()
