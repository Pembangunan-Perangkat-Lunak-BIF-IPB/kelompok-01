"""Bounded, structural FASTQ validation without biological interpretation."""

from collections.abc import Iterator
import gzip
import re
from typing import BinaryIO
import unicodedata
import zlib


class InvalidFilenameError(ValueError):
    """The client filename is unsafe or unsupported."""


class InvalidFastqError(ValueError):
    """The input is not a structurally valid FASTQ stream."""


class UploadLimitError(ValueError):
    """An upload or decompression resource limit was exceeded."""


_VISIBLE = re.compile(rb"[!-~]+")


def validate_filename(filename: str) -> str:
    """Validate display metadata and return its allowed, case-sensitive suffix."""
    if not isinstance(filename, str):
        raise InvalidFilenameError("Invalid upload filename.")
    try:
        size = len(filename.encode("utf-8"))
    except UnicodeError:
        raise InvalidFilenameError("Invalid upload filename.") from None
    if (
        not filename or size > 255 or filename != filename.strip()
        or any(char in filename for char in "/\\:")
        or any(unicodedata.category(char).startswith("C") for char in filename)
    ):
        raise InvalidFilenameError("Invalid upload filename.")
    for suffix in (".fastq.gz", ".fastq"):
        if filename.endswith(suffix) and filename[:-len(suffix)].strip(". "):
            return suffix
    raise InvalidFilenameError("Only .fastq and .fastq.gz files are supported.")


def _lines(stream: BinaryIO, max_bytes: int, max_line_bytes: int) -> Iterator[bytes]:
    total = 0
    while True:
        # The extra byte detects overflow even when the limit is reached exactly.
        raw = stream.readline(min(max_line_bytes + 2, max_bytes - total + 1))
        if not raw:
            return
        total += len(raw)
        if total > max_bytes:
            raise UploadLimitError("FASTQ data exceeds its byte limit.")
        line = raw.removesuffix(b"\n")
        if raw.endswith(b"\n"):
            line = line.removesuffix(b"\r")
        if len(line) > max_line_bytes:
            raise UploadLimitError("FASTQ line exceeds its byte limit.")
        yield line


def _visible(line: bytes) -> bool:
    return _VISIBLE.fullmatch(line) is not None


def validate_fastq(stream: BinaryIO, *, max_bytes: int, max_line_bytes: int) -> None:
    """Consume to EOF with bounded lines; sequence and quality may be wrapped.

    Sequence tokens and qualities must be visible ASCII, without whitespace.
    No nucleotide alphabet, quality threshold, or pairing inference is applied.
    """
    if max_bytes <= 0 or max_line_bytes <= 0:
        raise ValueError("FASTQ limits must be positive.")
    lines = iter(_lines(stream, max_bytes, max_line_bytes))
    records = 0
    for header in lines:
        if (
            not header.startswith(b"@") or not header[1:].strip()
            or any(char < 32 or char > 126 for char in header)
        ):
            raise InvalidFastqError("Invalid FASTQ header.")
        sequence_length = 0
        for line in lines:
            if line.startswith(b"+"):
                if line[1:] and line[1:] != header[1:]:
                    raise InvalidFastqError("FASTQ separator does not match its header.")
                break
            if not _visible(line):
                raise InvalidFastqError("Invalid FASTQ sequence formatting.")
            sequence_length += len(line)
        else:
            raise InvalidFastqError("FASTQ separator is missing.")
        if not sequence_length:
            raise InvalidFastqError("FASTQ sequence is empty.")
        quality_length = 0
        while quality_length < sequence_length:
            quality = next(lines, None)
            if quality is None or not _visible(quality):
                raise InvalidFastqError("FASTQ quality is missing or invalid.")
            quality_length += len(quality)
        if quality_length != sequence_length:
            raise InvalidFastqError("FASTQ sequence and quality lengths differ.")
        records += 1
    if not records:
        raise InvalidFastqError("FASTQ input is empty.")


def validate_upload(stream: BinaryIO, suffix: str, *, max_bytes: int, max_line_bytes: int) -> None:
    """Shared validation for local staging and the isolated worker."""
    if suffix == ".fastq.gz":
        try:
            with gzip.GzipFile(fileobj=stream, mode="rb") as decoded:
                validate_fastq(decoded, max_bytes=max_bytes, max_line_bytes=max_line_bytes)
        except (gzip.BadGzipFile, EOFError, zlib.error):
            raise InvalidFastqError("Invalid or truncated gzip stream.") from None
    else:
        validate_fastq(stream, max_bytes=max_bytes, max_line_bytes=max_line_bytes)
