"""Private local upload staging for the Linux server; no HTTP or database I/O."""

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
    flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
    current = os.open(root.anchor, flags)
    try:
        for component in root.parts[1:]:
            try:
                os.mkdir(component, mode=0o700, dir_fd=current)
            except FileExistsError:
                pass
            # Persist this entry before descending. Sync existing entries too:
            # an earlier setup may have stopped after mkdir but before fsync.
            # No upload file or Sample transaction exists at this point.
            os.fsync(current)
            child = os.open(component, flags, dir_fd=current)
            os.close(current)
            current = child
        info = os.fstat(current)
        if info.st_uid != os.geteuid() or info.st_mode & 0o022:
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
    _published: bool = field(default=False, init=False)
    _finalized: bool = field(default=False, init=False)
    _retained: bool = field(default=False, init=False)
    _closed: bool = field(default=False, init=False)

    def _owned(self, name: str) -> bool:
        try:
            info = os.stat(name, dir_fd=self._root_fd, follow_symlinks=False)
        except FileNotFoundError:
            return False
        if not stat.S_ISREG(info.st_mode) or (info.st_dev, info.st_ino) != self._identity:
            raise StorageError("Upload file was replaced; refusing to modify it.")
        return True

    def finalize(self) -> UploadMetadata:
        """Publish the complete file atomically, without replacing any target."""
        if self._closed or self._published:
            raise StorageError("Upload is closed or already finalized.")
        try:
            if not self._owned(self._stage_name):
                raise StorageError("Staged upload is missing.")
            # A same-directory hard link atomically creates a complete final file.
            # Unlike replace/rename, an existing file or symlink is never overwritten.
            os.link(
                self._stage_name, self.metadata.storage_key,
                src_dir_fd=self._root_fd, dst_dir_fd=self._root_fd,
                follow_symlinks=False,
            )
            self._published = True
            os.unlink(self._stage_name, dir_fd=self._root_fd)
            os.fsync(self._root_fd)
            self._finalized = True
        except OSError:
            raise StorageError("Could not finalize upload.") from None
        return self.metadata

    def retain(self) -> None:
        """Keep a successfully finalized upload when this context exits."""
        if self._closed or not self._finalized:
            raise StorageError("Only an open, finalized upload can be retained.")
        if not self._owned(self.metadata.storage_key):
            raise StorageError("Finalized upload is missing.")
        self._retained = True

    def preserve_for_reconciliation(self) -> None:
        """Call BEFORE an external commit that could have an ambiguous outcome.

        Even an exception will then keep the file. The caller must reconcile it
        separately; a database error alone does not prove the commit rolled back.
        """
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
                    os.unlink(name, dir_fd=self._root_fd)
            except (OSError, StorageError):
                # A failure or replacement at one name must not skip the others.
                failed = True
        if failed:
            raise StorageError("Could not clean up all owned upload files.") from None


class LocalStorage:
    def __init__(self, settings: Settings):
        # No directory creation, resolution through symlinks, or I/O on construction.
        self.root = Path(os.path.abspath(settings.upload_root))
        self.settings = settings

    @contextmanager
    def stage(
        self, source: BinaryIO, filename: str,
        *, validator: Callable[[BinaryIO, str], None] | None = None,
    ) -> Iterator[StagedUpload]:
        """Copy bounded chunks, validate, then yield a rollback-by-default handle.

        The caller owns source. This context owns only files it created, identified
        by inode. Before any external commit, finalize and explicitly preserve the
        file for reconciliation; filesystem and database are not one transaction.
        """
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
                descriptor = os.open(
                    stage_name, os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW | os.O_RDWR,
                    0o600, dir_fd=root_fd,
                )
                info = os.fstat(descriptor)
                staged = StagedUpload(
                    UploadMetadata(filename, identifier + suffix, 0), root_fd,
                    stage_name, (info.st_dev, info.st_ino),
                )
                # Keep descriptor ownership here, including if fdopen() fails.
                # Keeping it open also prevents inode reuse during this context.
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
                staged.metadata = UploadMetadata(filename, identifier + suffix, total)
            except OSError:
                raise StorageError("Could not stage upload.") from None
            yield staged
        except BaseException as error:
            # Track only errors from this context, not an enclosing except block.
            primary_error = error
            raise
        finally:
            cleanup_failed = False
            # fstat() can fail after exclusive creation but before a handle exists.
            # Recover identity from the still-open descriptor, never from a path
            # that might have been replaced. If inspection also fails, refuse to
            # unlink an unidentified file and report incomplete cleanup.
            if descriptor is not None and staged is None:
                try:
                    info = os.stat(descriptor)
                    staged = StagedUpload(
                        UploadMetadata(filename, identifier + suffix, 0), root_fd,
                        stage_name, (info.st_dev, info.st_ino),
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
            # Each descriptor and each owned filename gets its own cleanup try.
            if descriptor is not None:
                try:
                    os.close(descriptor)
                except OSError:
                    cleanup_failed = True
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
