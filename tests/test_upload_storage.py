from io import BytesIO
import gzip
import os
from pathlib import Path
import stat
from types import SimpleNamespace
from unittest.mock import Mock

from pydantic import ValidationError
import pytest

from app.core.config import Settings
from app.services import storage as storage_module
from app.services.fastq import (
    InvalidFastqError, InvalidFilenameError, UploadLimitError, validate_fastq, validate_filename,
)
from app.services.storage import LocalStorage, StorageError


FASTQ = b"@read\nACGT\n+\n!!!!\n"


@pytest.fixture(autouse=True)
def no_database_or_environment(monkeypatch):
    monkeypatch.setattr(Settings, "model_config", {**Settings.model_config, "env_file": None})
    for name in (
        "DATABASE_URL", "GENOPATH_JWT_SECRET", "GENOPATH_UPLOAD_ROOT", "GENOPATH_UPLOAD_MAX_BYTES",
        "GENOPATH_UPLOAD_MAX_DECOMPRESSED_BYTES", "GENOPATH_UPLOAD_CHUNK_BYTES",
        "GENOPATH_UPLOAD_MAX_LINE_BYTES",
    ):
        monkeypatch.delenv(name, raising=False)
    forbidden = Mock(side_effect=AssertionError("Upload unit tests must not access a database"))
    monkeypatch.setattr("sqlalchemy.create_engine", forbidden)
    monkeypatch.setattr("sqlalchemy.engine.Engine.connect", forbidden)
    yield
    forbidden.assert_not_called()


@pytest.fixture
def store(tmp_path):
    return LocalStorage(Settings(_env_file=None, upload_root=tmp_path / "uploads", upload_chunk_bytes=7))


def validate(data, *, max_bytes=10_000, max_line_bytes=100):
    validate_fastq(BytesIO(data), max_bytes=max_bytes, max_line_bytes=max_line_bytes)


@pytest.mark.parametrize("data", [
    FASTQ, FASTQ * 2, FASTQ.rstrip(b"\n"), FASTQ.replace(b"\n", b"\r\n"),
    b"@read description\nAC\nGT\n+read description\n!@\n+!\n",
    b"@a\nAC\n+\n@@\n@b\nG\n+\n+\n",
    b"@read\nxyz.-\n+\nIIIII\n",  # Format checks do not enforce a DNA alphabet or QC.
])
def test_valid_fastq_including_multiline_and_marker_quality(data):
    validate(data)


@pytest.mark.parametrize("data", [
    b"", b"\n", b"read\nAC\n+\n!!\n", b"@\nAC\n+\n!!\n", b"@  \nAC\n+\n!!\n",
    b"@read\n+\n", b"@read\nAC\n", b"@read\nAC\n+other\n!!\n",
    b"@read\nAC\n+\n!\n", b"@read\nAC\n+\n!!!\n", b"@read\nA C\n+\n!!!\n",
    b"@read\nAC\n+\n! \n", b"@read\nAC\n+\n!\x7f\n", b"@read\n\n+\n\n",
    b"@read\nAC\n+\n\n", FASTQ + b"unexpected\n", FASTQ + b"@next\nA\n+\n",
    b"@read\nA\xff\n+\n!!\n", b"@read\x00\nAC\n+\n!!\n",
])
def test_invalid_fastq_is_rejected(data):
    with pytest.raises(InvalidFastqError):
        validate(data)


@pytest.mark.parametrize("filename", [
    "", ".fastq", "..fastq", "../reads.fastq", "/tmp/reads.fastq", "folder/reads.fastq",
    "..\\reads.fastq", "C:\\reads.fastq", "reads.fastq:stream", "reads.fastq.exe",
    "reads.fq", "reads.gz", "reads.FASTQ", "reads.fastq ", " reads.fastq",
    "reads\x00.fastq", "reads\n.fastq", "reads\t.fastq", "reads\u202e.fastq",
    "a" * 256 + ".fastq", "\ud800.fastq", None,
])
def test_unsafe_or_unsupported_filename_is_rejected_without_creating_storage(store, filename):
    with pytest.raises(InvalidFilenameError):
        with store.stage(BytesIO(FASTQ), filename):
            pytest.fail("Invalid filename was accepted")
    assert not store.root.exists()


@pytest.mark.parametrize("name,suffix", [("reads.fastq", ".fastq"), ("reads.fastq.gz", ".fastq.gz"),
                                        ("sampel bawang.fastq", ".fastq"), ("sampél.fastq", ".fastq")])
def test_safe_names_are_only_metadata(name, suffix):
    assert validate_filename(name) == suffix


def test_constructor_has_no_filesystem_side_effects(store):
    assert not store.root.exists()


@pytest.mark.parametrize("existing", [False, True])
def test_root_setup_syncs_each_correct_parent_before_descending(tmp_path, monkeypatch, existing):
    root = tmp_path / "parent" / "uploads"
    if existing:
        root.mkdir(parents=True, mode=0o700)
        (root / "foreign.fastq").write_bytes(b"keep-existing")
    real_sync = os.fsync
    synced = []

    def sync_parent(descriptor):
        info = os.fstat(descriptor)
        assert stat.S_ISDIR(info.st_mode)
        synced.append((info.st_dev, info.st_ino))
        real_sync(descriptor)

    monkeypatch.setattr(storage_module.os, "fsync", sync_parent)
    descriptor = storage_module._open_root(root)
    try:
        info = os.fstat(descriptor)
        assert (info.st_dev, info.st_ino) == (root.stat().st_dev, root.stat().st_ino)
    finally:
        os.close(descriptor)
    # Each component's directory entry lives in its parent, not in the child.
    assert synced == [(parent.stat().st_dev, parent.stat().st_ino)
                      for parent in reversed(root.parents)]
    assert stat.S_IMODE(root.stat().st_mode) == 0o700
    if existing:
        assert (root / "foreign.fastq").read_bytes() == b"keep-existing"
    else:
        assert list(root.iterdir()) == []


@pytest.mark.parametrize("existing", [False, True])
@pytest.mark.parametrize("failed_parent", ["ancestor", "leaf"])
def test_parent_sync_failure_stops_before_staging_and_closes_descriptors(
    tmp_path, monkeypatch, existing, failed_parent,
):
    root = tmp_path / "parent" / "uploads"
    if existing:
        root.mkdir(parents=True, mode=0o700)
        (root / "foreign.fastq").write_bytes(b"keep-existing")
    target = tmp_path if failed_parent == "ancestor" else root.parent
    real_open, real_sync, real_fstat = os.open, os.fsync, os.fstat
    descriptors = []
    source, validator = Mock(wraps=BytesIO(FASTQ)), Mock()
    store = LocalStorage(Settings(_env_file=None, upload_root=root))

    def track_open(*args, **kwargs):
        descriptor = real_open(*args, **kwargs)
        descriptors.append(descriptor)
        return descriptor

    def fail_sync(descriptor):
        info = real_fstat(descriptor)
        if target.exists() and (info.st_dev, info.st_ino) == (target.stat().st_dev, target.stat().st_ino):
            raise OSError("private-parent-sync-marker")
        real_sync(descriptor)

    with monkeypatch.context() as patch:
        patch.setattr(storage_module.os, "open", track_open)
        patch.setattr(storage_module.os, "fsync", fail_sync)
        with pytest.raises(StorageError, match="Could not open upload storage") as error:
            with store.stage(source, "reads.fastq", validator=validator):
                pytest.fail("Directory sync failure was ignored")
    assert "private-parent-sync-marker" not in str(error.value)
    source.read.assert_not_called()
    validator.assert_not_called()
    for descriptor in descriptors:
        with pytest.raises(OSError):
            real_fstat(descriptor)
    assert not list(tmp_path.rglob("*.part"))
    if existing:
        assert (root / "foreign.fastq").read_bytes() == b"keep-existing"


def test_retry_syncs_existing_entry_left_by_failed_setup(tmp_path, monkeypatch):
    store = LocalStorage(Settings(_env_file=None, upload_root=tmp_path / "parent" / "uploads"))
    real_sync = os.fsync
    attempts = []

    def fail_once(descriptor):
        info = os.fstat(descriptor)
        parent = tmp_path.stat()
        if (info.st_dev, info.st_ino) == (parent.st_dev, parent.st_ino):
            attempts.append(descriptor)
            if len(attempts) == 1:
                raise OSError("injected-parent-sync-failure")
        real_sync(descriptor)

    monkeypatch.setattr(storage_module.os, "fsync", fail_once)
    with pytest.raises(StorageError):
        with store.stage(BytesIO(FASTQ), "reads.fastq"):
            pytest.fail("Directory sync failure was ignored")
    assert store.root.parent.is_dir() and not store.root.exists()
    with store.stage(BytesIO(FASTQ), "reads.fastq") as upload:
        upload.finalize()
        upload.retain()
    assert len(attempts) == 2
    assert (store.root / upload.metadata.storage_key).read_bytes() == FASTQ


def test_finalize_retain_and_unique_server_names(store):
    keys = []
    for _ in range(2):
        with store.stage(BytesIO(FASTQ), "reads.fastq") as upload:
            assert upload.metadata.original_name == "reads.fastq"
            assert upload.metadata.size_bytes == len(FASTQ)
            assert not (store.root / upload.metadata.storage_key).exists()
            metadata = upload.finalize()
            assert (store.root / metadata.storage_key).read_bytes() == FASTQ
            assert stat.S_IMODE((store.root / metadata.storage_key).stat().st_mode) == 0o600
            assert not list(store.root.glob("*.part"))
            upload.retain()
            keys.append(metadata.storage_key)
    assert keys[0] != keys[1]
    assert all(key.endswith(".fastq") and "reads" not in key for key in keys)
    assert len(list(store.root.iterdir())) == 2


@pytest.mark.parametrize("finalized", [False, True])
@pytest.mark.parametrize("caller_fails", [False, True])
def test_unretained_files_are_cleaned_even_after_finalize(store, finalized, caller_fails):
    def use_upload():
        with store.stage(BytesIO(FASTQ), "reads.fastq") as upload:
            if finalized:
                upload.finalize()
            if caller_fails:
                raise RuntimeError("Caller transaction failed")
    if caller_fails:
        with pytest.raises(RuntimeError, match="Caller transaction failed"):
            use_upload()
    else:
        use_upload()
    assert list(store.root.iterdir()) == []


def test_retain_requires_finalize_and_closed_handle_cannot_be_reused(store):
    with store.stage(BytesIO(FASTQ), "reads.fastq") as upload:
        with pytest.raises(StorageError):
            upload.retain()
    with pytest.raises(StorageError):
        upload.finalize()
    with pytest.raises(StorageError):
        upload.retain()


def test_finalize_cannot_run_twice(store):
    with store.stage(BytesIO(FASTQ), "reads.fastq") as upload:
        upload.finalize()
        with pytest.raises(StorageError):
            upload.finalize()
    assert list(store.root.iterdir()) == []


@pytest.mark.parametrize("compressed", [False, True])
@pytest.mark.parametrize("delta", [-1, 0, 1])
def test_upload_limit_is_inclusive_with_small_injected_limits(tmp_path, compressed, delta):
    data = gzip.compress(FASTQ, mtime=0) if compressed else FASTQ
    # File size is respectively limit-1, limit, or limit+1.
    settings = Settings(_env_file=None, upload_root=tmp_path / "uploads",
                        upload_max_bytes=len(data) - delta, upload_chunk_bytes=3)
    store = LocalStorage(settings)
    filename = "reads.fastq.gz" if compressed else "reads.fastq"
    if delta == 1:
        with pytest.raises(UploadLimitError):
            with store.stage(BytesIO(data), filename):
                pytest.fail("Oversized upload was accepted")
    else:
        with store.stage(BytesIO(data), filename) as upload:
            assert upload.metadata.size_bytes == len(data)
    assert list(store.root.iterdir()) == []


@pytest.mark.parametrize("delta", [-1, 0, 1])
def test_decompressed_limit_is_inclusive(tmp_path, delta):
    store = LocalStorage(Settings(_env_file=None, upload_root=tmp_path / "uploads",
                                 upload_max_decompressed_bytes=len(FASTQ) - delta))
    if delta == 1:
        with pytest.raises(UploadLimitError):
            with store.stage(BytesIO(gzip.compress(FASTQ, mtime=0)), "reads.fastq.gz"):
                pytest.fail("Decompression limit was ignored")
    else:
        with store.stage(BytesIO(gzip.compress(FASTQ, mtime=0)), "reads.fastq.gz"):
            pass
    assert list(store.root.iterdir()) == []


@pytest.mark.parametrize("data", [
    b"", FASTQ, gzip.compress(FASTQ, mtime=0)[:-4],
    gzip.compress(FASTQ, mtime=0)[:-8] + b"\x00" * 8,
    gzip.compress(FASTQ, mtime=0) + b"trailing garbage",
    gzip.compress(b"not fastq", mtime=0),
])
def test_corrupt_empty_or_misnamed_gzip_is_rejected_and_cleaned(store, data):
    with pytest.raises(InvalidFastqError):
        with store.stage(BytesIO(data), "reads.fastq.gz"):
            pytest.fail("Invalid gzip was accepted")
    assert list(store.root.iterdir()) == []


def test_valid_gzip_preserves_compressed_bytes_and_checks_concatenated_members(store):
    data = gzip.compress(FASTQ, mtime=0) + gzip.compress(FASTQ, mtime=0)
    with store.stage(BytesIO(data), "reads.fastq.gz") as upload:
        metadata = upload.finalize()
        upload.retain()
    assert metadata.size_bytes == len(data)
    assert (store.root / metadata.storage_key).read_bytes() == data


def test_small_gzip_bomb_is_rejected(tmp_path):
    data = gzip.compress(FASTQ * 1000, mtime=0)
    store = LocalStorage(Settings(_env_file=None, upload_root=tmp_path / "uploads",
                                 upload_max_decompressed_bytes=100))
    with pytest.raises(UploadLimitError):
        with store.stage(BytesIO(data), "reads.fastq.gz"):
            pytest.fail("Decompression limit was ignored")
    assert list(store.root.iterdir()) == []


@pytest.mark.parametrize("line", [b"@" + b"r" * 10, b"A" * 11, b"!" * 11])
def test_long_lines_are_bounded(line):
    with pytest.raises(UploadLimitError):
        validate(line + b"\n", max_line_bytes=10)


def test_line_limit_accepts_exact_length_including_crlf_handling():
    validate(b"@a\r\nACGT\r\n+\r\n!!!!\r\n", max_line_bytes=4)


def test_source_reads_are_bounded_and_source_remains_open(store):
    class BoundedSource(BytesIO):
        def read(self, size=-1):
            assert 0 < size <= 7
            return super().read(size)
    source = BoundedSource(FASTQ)
    with store.stage(source, "reads.fastq"):
        pass
    assert not source.closed


def test_validator_reads_bounded_lines():
    class BoundedSource(BytesIO):
        def readline(self, size=-1):
            assert 0 < size <= 102
            return super().readline(size)
    validate_fastq(BoundedSource(FASTQ), max_bytes=1000, max_line_bytes=100)


def test_interrupted_source_is_cleaned_and_error_is_sanitized(store):
    class BrokenSource(BytesIO):
        def read(self, size=-1):
            if self.tell():
                raise OSError("private-storage-marker")
            return super().read(size)
    with pytest.raises(StorageError) as error:
        with store.stage(BrokenSource(FASTQ), "reads.fastq"):
            pytest.fail("Interrupted input was accepted")
    assert str(error.value) == "Could not stage upload."
    assert list(store.root.iterdir()) == []


def test_invalid_plain_fastq_is_cleaned(store):
    with pytest.raises(InvalidFastqError):
        with store.stage(BytesIO(b"not FASTQ"), "reads.fastq"):
            pytest.fail("Invalid input was accepted")
    assert list(store.root.iterdir()) == []


def test_existing_final_file_is_not_overwritten_or_deleted(store):
    with store.stage(BytesIO(FASTQ), "reads.fastq") as upload:
        target = store.root / upload.metadata.storage_key
        target.write_bytes(b"keep-existing")
        with pytest.raises(StorageError):
            upload.finalize()
    assert target.read_bytes() == b"keep-existing"
    assert not list(store.root.glob("*.part"))


def test_existing_staging_file_is_not_overwritten(store, monkeypatch):
    store.root.mkdir()
    existing = store.root / ("a" * 32 + ".part")
    existing.write_bytes(b"keep-existing")
    monkeypatch.setattr(storage_module, "uuid4", lambda: SimpleNamespace(hex="a" * 32))
    with pytest.raises(StorageError):
        with store.stage(BytesIO(FASTQ), "reads.fastq"):
            pytest.fail("Staging collision was accepted")
    assert existing.read_bytes() == b"keep-existing"


@pytest.mark.parametrize("parent_symlink", [False, True])
def test_storage_refuses_symlink_root_or_ancestor(tmp_path, parent_symlink):
    outside = tmp_path / "outside"
    outside.mkdir()
    linked = tmp_path / "linked"
    linked.symlink_to(outside, target_is_directory=True)
    root = linked / "uploads" if parent_symlink else linked
    store = LocalStorage(Settings(_env_file=None, upload_root=root))
    with pytest.raises(StorageError):
        with store.stage(BytesIO(FASTQ), "reads.fastq"):
            pytest.fail("Symlink root was accepted")
    assert list(outside.iterdir()) == []


def test_final_symlink_is_never_followed_or_removed(store, tmp_path):
    outside = tmp_path / "outside.fastq"
    outside.write_bytes(b"keep-existing")
    with store.stage(BytesIO(FASTQ), "reads.fastq") as upload:
        target = store.root / upload.metadata.storage_key
        target.symlink_to(outside)
        with pytest.raises(StorageError):
            upload.finalize()
    assert target.is_symlink()
    assert outside.read_bytes() == b"keep-existing"


def test_replaced_staging_file_is_not_deleted(store, tmp_path):
    outside = tmp_path / "outside.fastq"
    outside.write_bytes(b"keep-existing")
    with pytest.raises(StorageError, match="refusing to modify"):
        with store.stage(BytesIO(FASTQ), "reads.fastq") as upload:
            part = next(store.root.glob("*.part"))
            part.unlink()
            part.symlink_to(outside)
            upload.finalize()
    assert outside.read_bytes() == b"keep-existing"
    assert part.is_symlink()


def test_storage_refuses_root_writable_by_others(store):
    store.root.mkdir(mode=0o777)
    store.root.chmod(0o777)
    with pytest.raises(StorageError):
        with store.stage(BytesIO(FASTQ), "reads.fastq"):
            pytest.fail("Unsafe root was accepted")


def test_storage_write_failure_cleans_owned_file(store, monkeypatch):
    real_sync = os.fsync

    def fail_sync(descriptor):
        if stat.S_ISREG(os.fstat(descriptor).st_mode):
            raise OSError("private-storage-marker")
        real_sync(descriptor)
    monkeypatch.setattr(storage_module.os, "fsync", fail_sync)
    with pytest.raises(StorageError):
        with store.stage(BytesIO(FASTQ), "reads.fastq"):
            pytest.fail("Write failure was ignored")
    assert list(store.root.iterdir()) == []


@pytest.mark.parametrize("field,value", [
    ("upload_max_bytes", 0), ("upload_max_bytes", 1_000_000_001),
    ("upload_max_decompressed_bytes", 0), ("upload_chunk_bytes", 0), ("upload_max_line_bytes", 0),
])
def test_invalid_resource_settings_are_rejected(field, value):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, **{field: value})


def test_defaults_and_environment_names(monkeypatch, tmp_path):
    defaults = Settings(_env_file=None)
    assert defaults.upload_root == Path("data/samples")
    assert defaults.upload_max_bytes == 1_000_000_000
    assert defaults.upload_max_decompressed_bytes == 4 * 1024**3
    monkeypatch.setenv("GENOPATH_UPLOAD_ROOT", str(tmp_path / "private"))
    monkeypatch.setenv("GENOPATH_UPLOAD_MAX_DECOMPRESSED_BYTES", "1024")
    settings = Settings(_env_file=None)
    assert settings.upload_root == tmp_path / "private"
    assert settings.upload_max_decompressed_bytes == 1024


@pytest.mark.parametrize("operation", ["fstat", "fdopen"])
@pytest.mark.parametrize("error_type", [OSError, RuntimeError])
def test_setup_failure_closes_descriptor_and_removes_part(store, monkeypatch, operation, error_type):
    real_fstat = os.fstat
    real_open_root = storage_module._open_root
    descriptors = []
    root_descriptors = []

    def track_root(root):
        descriptor = real_open_root(root)
        root_descriptors.append(descriptor)
        return descriptor

    def fail_setup(descriptor, *args, **kwargs):
        info = real_fstat(descriptor)
        if stat.S_ISREG(info.st_mode):
            descriptors.append(descriptor)
            raise error_type("injected-setup-failure")
        return info

    monkeypatch.setattr(storage_module.os, operation, fail_setup)
    monkeypatch.setattr(storage_module, "_open_root", track_root)
    expected = StorageError if error_type is OSError else error_type
    with pytest.raises(expected):
        with store.stage(BytesIO(FASTQ), "reads.fastq"):
            pytest.fail("Setup failure was ignored")
    assert len(descriptors) == 1
    for descriptor in descriptors + root_descriptors:
        with pytest.raises(OSError):
            real_fstat(descriptor)
    assert list(store.root.iterdir()) == []


def test_failed_setup_never_deletes_replacement_file(store, monkeypatch):
    real_fstat = os.fstat

    def fail_after_replacement(descriptor):
        info = real_fstat(descriptor)
        if stat.S_ISREG(info.st_mode):
            part = next(store.root.glob("*.part"))
            part.unlink()
            part.write_bytes(b"foreign-file")
            raise OSError("injected-setup-failure")
        return info

    monkeypatch.setattr(storage_module.os, "fstat", fail_after_replacement)
    with pytest.raises(StorageError, match="Could not stage upload") as error:
        with store.stage(BytesIO(FASTQ), "reads.fastq"):
            pytest.fail("Setup failure was ignored")
    assert next(store.root.iterdir()).read_bytes() == b"foreign-file"
    assert error.value.__notes__ == [
        "Upload cleanup incomplete; storage reconciliation required.",
    ]


def test_unidentifiable_setup_file_is_preserved_but_descriptor_is_closed(store, monkeypatch):
    real_fstat, real_stat = os.fstat, os.stat
    descriptors = []

    def fail_fstat(descriptor):
        info = real_fstat(descriptor)
        if stat.S_ISREG(info.st_mode):
            descriptors.append(descriptor)
            raise OSError("injected-fstat-failure")
        return info

    def fail_descriptor_stat(path, *args, **kwargs):
        if isinstance(path, int):
            raise OSError("injected-identity-failure")
        return real_stat(path, *args, **kwargs)

    monkeypatch.setattr(storage_module.os, "fstat", fail_fstat)
    monkeypatch.setattr(storage_module.os, "stat", fail_descriptor_stat)
    with pytest.raises(StorageError, match="Could not stage upload") as error:
        with store.stage(BytesIO(FASTQ), "reads.fastq"):
            pytest.fail("Setup failure was ignored")
    with pytest.raises(OSError):
        real_fstat(descriptors[0])
    assert len(list(store.root.glob("*.part"))) == 1
    assert "reconciliation required" in error.value.__notes__[0]


@pytest.mark.parametrize("operation", ["unlink", "fsync"])
def test_partial_finalize_cannot_be_retained_even_when_caller_catches_error(store, monkeypatch, operation):
    real_operation = getattr(os, operation)
    failed = False

    def fail_once(*args, **kwargs):
        nonlocal failed
        if not failed:
            failed = True
            raise OSError("injected-finalize-failure")
        return real_operation(*args, **kwargs)

    with store.stage(BytesIO(FASTQ), "reads.fastq") as upload:
        # Install after staging so fsync faults target directory finalization.
        monkeypatch.setattr(storage_module.os, operation, fail_once)
        with pytest.raises(StorageError, match="Could not finalize upload"):
            upload.finalize()
        for retain in (upload.retain, upload.preserve_for_reconciliation):
            with pytest.raises(StorageError, match="finalized"):
                retain()
    assert failed
    assert list(store.root.iterdir()) == []


@pytest.mark.parametrize("blocked_suffix", [".part", ".fastq"])
@pytest.mark.parametrize("primary_failure", [False, True])
def test_cleanup_tries_both_owned_names_and_preserves_primary_error(
    store, monkeypatch, blocked_suffix, primary_failure,
):
    real_unlink = os.unlink
    attempts = []
    primary = RuntimeError("caller-failure")

    def block_unlink(name, *args, **kwargs):
        attempts.append(name)
        if name.endswith(blocked_suffix):
            raise OSError("private-cleanup-marker")
        return real_unlink(name, *args, **kwargs)

    expected = RuntimeError if primary_failure else StorageError
    with pytest.raises(expected) as error:
        with store.stage(BytesIO(FASTQ), "reads.fastq") as upload:
            # Leave both names by failing the first staging unlink only.
            with monkeypatch.context() as patch:
                patch.setattr(storage_module.os, "unlink", Mock(side_effect=OSError("unlink failure")))
                with pytest.raises(StorageError):
                    upload.finalize()
            monkeypatch.setattr(storage_module.os, "unlink", block_unlink)
            if primary_failure:
                raise primary
    assert len(attempts) == 2
    remaining = list(store.root.iterdir())
    assert len(remaining) == 1
    assert remaining[0].name.endswith(blocked_suffix)
    if primary_failure:
        assert error.value is primary
        assert "reconciliation required" in primary.__notes__[0]
    else:
        assert "reconciliation required" in str(error.value)
    assert "private-cleanup-marker" not in str(error.value)


@pytest.mark.parametrize("replacement_suffix", [".part", ".fastq"])
def test_cleanup_preserves_foreign_name_and_removes_other_owned_name(store, monkeypatch, replacement_suffix):
    with pytest.raises(StorageError, match="reconciliation required"):
        with store.stage(BytesIO(FASTQ), "reads.fastq") as upload:
            with monkeypatch.context() as patch:
                patch.setattr(storage_module.os, "unlink", Mock(side_effect=OSError("unlink failure")))
                with pytest.raises(StorageError):
                    upload.finalize()
            replacement = next(store.root.glob("*" + replacement_suffix))
            replacement.unlink()
            replacement.write_bytes(b"foreign-file")
    assert list(store.root.iterdir()) == [replacement]
    assert replacement.read_bytes() == b"foreign-file"


def test_validation_error_is_not_masked_by_cleanup_failure(store, monkeypatch):
    monkeypatch.setattr(storage_module.os, "unlink", Mock(side_effect=OSError("private-cleanup-marker")))
    with pytest.raises(InvalidFastqError) as error:
        with store.stage(BytesIO(b"invalid"), "reads.fastq"):
            pytest.fail("Invalid FASTQ was accepted")
    assert "reconciliation required" in error.value.__notes__[0]
    assert "private-cleanup-marker" not in str(error.value)


def test_cleanup_failure_is_raised_inside_unrelated_except_block(store, monkeypatch):
    try:
        raise ValueError("already-handled-caller-error")
    except ValueError:
        with pytest.raises(StorageError, match="reconciliation required"):
            with store.stage(BytesIO(FASTQ), "reads.fastq"):
                monkeypatch.setattr(storage_module.os, "unlink", Mock(side_effect=OSError("unlink failure")))


@pytest.mark.parametrize("primary_failure", [False, True])
def test_descriptor_close_failure_still_closes_root_and_preserves_primary(store, monkeypatch, primary_failure):
    real_close, real_fstat = os.close, os.fstat
    closed = []
    primary = RuntimeError("caller-failure")

    def close_then_fail_file(descriptor):
        regular_file = stat.S_ISREG(real_fstat(descriptor).st_mode)
        real_close(descriptor)
        closed.append(descriptor)
        if regular_file:
            raise OSError("private-close-marker")

    expected = RuntimeError if primary_failure else StorageError
    with pytest.raises(expected) as error:
        with store.stage(BytesIO(FASTQ), "reads.fastq"):
            monkeypatch.setattr(storage_module.os, "close", close_then_fail_file)
            if primary_failure:
                raise primary
    assert len(closed) == 2  # File and root descriptors get independent attempts.
    for descriptor in closed:
        with pytest.raises(OSError):
            real_fstat(descriptor)
    assert list(store.root.iterdir()) == []
    if primary_failure:
        assert error.value is primary
        assert "reconciliation required" in primary.__notes__[0]
    assert "private-close-marker" not in str(error.value)


def test_finalize_error_is_not_masked_by_cleanup_failure(store, monkeypatch):
    real_unlink = os.unlink
    attempts = []

    def fail_stage_unlink(name, *args, **kwargs):
        attempts.append(name)
        if name.endswith(".part"):
            raise OSError("private-cleanup-marker")
        return real_unlink(name, *args, **kwargs)

    with pytest.raises(StorageError, match="Could not finalize upload") as error:
        with store.stage(BytesIO(FASTQ), "reads.fastq") as upload:
            monkeypatch.setattr(storage_module.os, "unlink", fail_stage_unlink)
            upload.finalize()
    assert len(attempts) == 3  # Finalize, then each of the two cleanup candidates.
    assert len(list(store.root.glob("*.part"))) == 1
    assert not list(store.root.glob("*.fastq"))
    assert "reconciliation required" in error.value.__notes__[0]


def test_preserve_before_ambiguous_commit_keeps_file_without_any_database(store):
    with pytest.raises(RuntimeError, match="commit outcome unknown"):
        with store.stage(BytesIO(FASTQ), "reads.fastq") as upload:
            metadata = upload.finalize()
            upload.preserve_for_reconciliation()
            raise RuntimeError("commit outcome unknown")
    assert (store.root / metadata.storage_key).read_bytes() == FASTQ
    assert not list(store.root.glob("*.part"))
    with pytest.raises(StorageError):
        upload.preserve_for_reconciliation()
