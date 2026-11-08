"""Supervise a killable validator while keeping staging ownership in the parent."""

import asyncio
from collections.abc import Callable
import os
from pathlib import Path
import signal
import subprocess
import sys
from threading import Event
import time
from typing import BinaryIO, TypeVar

from app.core.config import Settings
from app.services.fastq import InvalidFastqError, UploadLimitError, validate_upload
from app.services.storage import LocalStorage, StagedUpload, StorageError, UploadMetadata


class ValidationBudgetError(ValueError):
    """Validation exceeded its CPU or wall-clock allowance."""


class UploadCancelled(Exception):
    """Internal cancellation signal; never returned as an HTTP response."""


T = TypeVar("T")


async def joined_thread(function: Callable[[], T], stop: Event | None = None) -> T:
    """Never abandon a thread that still owns file descriptors or a subprocess."""
    task = asyncio.create_task(asyncio.to_thread(function))
    try:
        return await asyncio.shield(task)
    except asyncio.CancelledError as primary:
        if stop is not None:
            stop.set()
        while not task.done():
            try:
                await asyncio.shield(task)
            except asyncio.CancelledError:
                continue
            except Exception:
                break
        try:
            task.result()
        except UploadCancelled:
            pass
        except Exception:
            primary.add_note("Upload worker cleanup failed; reconciliation may be required.")
        raise


def validate_in_process(source: BinaryIO, suffix: str, settings: Settings, stop: Event) -> None:
    if stop.is_set():
        raise UploadCancelled()

    max_bytes = (
        settings.upload_max_decompressed_bytes
        if suffix == ".fastq.gz"
        else settings.upload_max_bytes
    )

    # Jalur khusus Windows: modul 'resource' & pewarisan file descriptor Linux tidak tersedia di Windows.
    # Jalankan validasi stream FASTQ secara langsung di worker thread.
    if os.name == "nt":
        source.seek(0)
        validate_upload(
            source,
            suffix,
            max_bytes=max_bytes,
            max_line_bytes=settings.upload_max_line_bytes,
        )
        source.seek(0)
        return

    # Jalur Linux / POSIX: Jalankan validation_worker.py dalam subproses terisolasi
    O_CLOEXEC = getattr(os, "O_CLOEXEC", 0)
    descriptor = os.open(f"/proc/self/fd/{source.fileno()}", os.O_RDONLY | O_CLOEXEC)
    try:
        command = [
            sys.executable, "-I", "-B", str(Path(__file__).with_name("validation_worker.py")),
            str(descriptor), suffix, str(max_bytes), str(settings.upload_max_line_bytes),
            str(settings.upload_validation_cpu_seconds),
        ]
        with subprocess.Popen(
            command, pass_fds=(descriptor,), env={}, stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        ) as process:
            deadline = time.monotonic() + settings.upload_validation_wall_seconds
            try:
                while True:
                    if stop.is_set():
                        raise UploadCancelled()
                    remaining = deadline - time.monotonic()
                    if remaining <= 0:
                        raise ValidationBudgetError("Validation resource budget exceeded.")
                    try:
                        code = process.wait(timeout=min(0.05, remaining))
                        break
                    except subprocess.TimeoutExpired:
                        continue
            finally:
                if process.poll() is None:
                    process.kill()
                process.wait()
        if code == 2:
            raise InvalidFastqError("Invalid FASTQ or gzip file.")
        if code == 3:
            raise UploadLimitError("FASTQ data exceeds its resource limit.")
        
        SIGXCPU = getattr(signal, "SIGXCPU", None)
        SIGKILL = getattr(signal, "SIGKILL", None)
        budget_signals = []
        if SIGXCPU is not None:
            budget_signals.append(-SIGXCPU)
        if SIGKILL is not None:
            budget_signals.append(-SIGKILL)

        if code in budget_signals:
            raise ValidationBudgetError("Validation resource budget exceeded.")
        if code != 0:
            raise StorageError("Validation worker unavailable.")
    finally:
        os.close(descriptor)


async def stage_and_validate(
    source: BinaryIO, filename: str, settings: Settings,
    *, on_validated: Callable[[StagedUpload, Event], T] | None = None,
) -> UploadMetadata | T:
    """Keep the staging context open for an optional post-validation operation."""
    stop = Event()

    def run() -> UploadMetadata | T:
        def validator(target: BinaryIO, suffix: str) -> None:
            validate_in_process(target, suffix, settings, stop)

        with LocalStorage(settings).stage(source, filename, validator=validator) as upload:
            if stop.is_set():
                raise UploadCancelled()
            if on_validated is not None:
                return on_validated(upload, stop)
            return upload.metadata

    return await joined_thread(run, stop)