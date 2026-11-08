"""Private local upload staging; compatible with Linux server and Windows dev environment."""

from collections.abc import Callable, Iterator
from contextlib import contextmanager
from dataclasses import dataclass, field
import os
from pathlib import Path
import stat
from typing import BinaryIO
from uuid import uuid4

from app.core.config import Settings
from app.services.fastq import (
    UploadLimitError, validate_upload, validate_filename,
)


class StorageError(RuntimeError):
    """Local storage could not complete an operation safely."""


@dataclass(frozen=True)
class UploadMetadata:
    original_name: str
    storage_key: str  # Relative to the configured root, never a client path.
    size_bytes: int  # Compressed size for .fastq.gz.


def _open_root(root: Path) -> int:
    """Walk using directory descriptors, refusing symlinks in every component."""
    root.mkdir(parents=True, exist_ok=True)
    if os.name == "nt":
        return -1

    flags = os.O_RDONLY | getattr(os, "O_DIRECTORY", 0) | getattr(os, "O_NOFOLLOW", 0)
    current = os.open(root.anchor, flags)
    try:
        for component in root.parts[1:]:
            try:
                os.mkdir(component, mode=0o700, dir_fd=current)
            except FileExistsError:
                pass
            os.fsync(current)
            child = os.open(component, flags, dir_fd=current)
            os.close(current)
            current = child
        info = os.fstat(current)
        current_uid = getattr(os, "geteuid", lambda: info.st_uid)()
        if info.st_uid != current_uid or info.st_mode & 0o022:
            raise StorageError("Upload root must be owned by the service and not writable by others.")
        return current
    except BaseException:
        os.close(current)
        raise


@dataclass(repr=False)
class StagedUpload:
    metadata: UploadMetadata
    _root_fd: int
    _stage_name: str
    _identity: tuple[int, int]
    _root_path: Path | None = None
    _published: bool = field(default=False, init=False)
    _finalized: bool = field(default=False, init=False)
    _retained: bool = field(default=False, init=False)
    _closed: bool = field(default=False, init=False)

    def _owned(self, name: str) -> bool:
        try:
            if os.name == "nt" and self._root_path:
                full_path = self._root_path / name
                info = os.stat(str(full_path), follow_symlinks=False)
            else:
                info = os.stat(name, dir_fd=self._root_fd, follow_symlinks=False)
        except FileNotFoundError:
            return False
        if not stat.S_ISREG(info.st_mode):
            return False
        if os.name != "nt" and (info.st_dev, info.st_ino) != self._identity:
            raise StorageError("Upload file was replaced; refusing to modify it.")
        return True

    def finalize(self) -> UploadMetadata:
        """Publish the complete file atomically, without replacing any target."""
        if self._closed or self._published:
            raise StorageError("Upload is closed or already finalized.")
        try:
            if not self._owned(self._stage_name):
                raise StorageError("Staged upload is missing.")
            
            if os.name == "nt" and self._root_path:
                src_path = self._root_path / self._stage_name
                dst_path = self._root_path / self.metadata.storage_key
                os.replace(src_path, dst_path)
            else:
                os.link(
                    self._stage_name, self.metadata.storage_key,
                    src_dir_fd=self._root_fd, dst_dir_fd=self._root_fd,
                    follow_symlinks=False,
                )
                os.unlink(self._stage_name, dir_fd=self._root_fd)
                try:
                    os.fsync(self._root_fd)
                except OSError:
                    pass
            self._published = True
            self._finalized = True
        except OSError as e:
            raise StorageError(f"Could not finalize upload: {e}") from None
        return self.metadata

    def retain(self) -> None:
        """Keep a successfully finalized upload when this context exits."""
        if self._closed or not self._finalized:
            raise StorageError("Only an open, finalized upload can be retained.")
        if not self._owned(self.metadata.storage_key):
            raise StorageError("Finalized upload is missing.")
        self._retained = True

    def preserve_for_reconciliation(self) -> None:
        self.retain()

    def _cleanup(self) -> None:
        if self._retained:
            return
        names = [self._stage_name]
        if self._published:
            names.insert(0, self.metadata.storage_key)
        failed = False
        for name in names:
            try:
                if self._owned(name):
                    if os.name == "nt" and self._root_path:
                        full_path = self._root_path / name
                        if full_path.exists():
                            full_path.unlink()
                    else:
                        os.unlink(name, dir_fd=self._root_fd)
            except (OSError, StorageError):
                failed = True
        if failed:
            raise StorageError("Could not clean up all owned upload files.") from None


class LocalStorage:
    def __init__(self, settings: Settings):
        self.root = Path(os.path.abspath(settings.upload_root))
        self.settings = settings

    @contextmanager
    def stage(
        self, source: BinaryIO, filename: str,
        *, validator: Callable[[BinaryIO, str], None] | None = None,
    ) -> Iterator[StagedUpload]:
        suffix = validate_filename(filename)
        try:
            root_fd = _open_root(self.root)
        except OSError:
            raise StorageError("Could not open upload storage.") from None
        staged = None
        descriptor = None
        primary_error = None
        try:
            try:
                identifier = uuid4().hex
                stage_name = identifier + ".part"
                
                if os.name == "nt":
                    stage_path = self.root / stage_name
                    descriptor = os.open(
                        str(stage_path),
                        os.O_CREAT | os.O_EXCL | getattr(os, "O_BINARY", 0) | os.O_RDWR,
                        0o600,
                    )
                else:
                    descriptor = os.open(
                        stage_name, os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0) | os.O_RDWR,
                        0o600, dir_fd=root_fd,
                    )
                
                info = os.fstat(descriptor)
                staged = StagedUpload(
                    UploadMetadata(filename, identifier + suffix, 0), root_fd,
                    stage_name, (info.st_dev, info.st_ino),
                    _root_path=self.root,
                )
                with os.fdopen(descriptor, "w+b", closefd=False) as target:
                    total = 0
                    while True:
                        chunk = source.read(min(
                            self.settings.upload_chunk_bytes,
                            self.settings.upload_max_bytes - total + 1,
                        ))
                        if not chunk:
                            break
                        total += len(chunk)
                        if total > self.settings.upload_max_bytes:
                            raise UploadLimitError("Upload exceeds its byte limit.")
                        target.write(chunk)
                    target.flush()
                    target.seek(0)
                    if validator is not None:
                        validator(target, suffix)
                    else:
                        validate_upload(
                            target, suffix,
                            max_bytes=(self.settings.upload_max_decompressed_bytes
                                       if suffix == ".fastq.gz" else self.settings.upload_max_bytes),
                            max_line_bytes=self.settings.upload_max_line_bytes,
                        )
                    os.fsync(target.fileno())

                # Lepas penguncian file di Windows sebelum yield/finalize agar os.replace tidak gagal dengan WinError 32
                if os.name == "nt" and descriptor is not None:
                    try:
                        os.close(descriptor)
                        descriptor = None
                    except OSError:
                        pass

                staged.metadata = UploadMetadata(filename, identifier + suffix, total)
            except OSError as e:
                raise StorageError(f"Could not stage upload: {e}") from None
            yield staged
        except BaseException as error:
            primary_error = error
            raise
        finally:
            cleanup_failed = False
            if descriptor is not None and staged is None:
                try:
                    info = os.stat(descriptor)
                    staged = StagedUpload(
                        UploadMetadata(filename, identifier + suffix, 0), root_fd,
                        stage_name, (info.st_dev, info.st_ino),
                        _root_path=self.root,
                    )
                except OSError:
                    cleanup_failed = True
            try:
                if staged is not None:
                    staged._cleanup()
            except StorageError:
                cleanup_failed = True
            if staged is not None:
                staged._closed = True
            if descriptor is not None:
                try:
                    os.close(descriptor)
                except OSError:
                    cleanup_failed = True
            if root_fd != -1:
                try:
                    os.close(root_fd)
                except OSError:
                    cleanup_failed = True
            if cleanup_failed:
                message = "Upload cleanup incomplete; storage reconciliation required."
                if primary_error is not None:
                    primary_error.add_note(message)
                else:
                    raise StorageError(message) from None