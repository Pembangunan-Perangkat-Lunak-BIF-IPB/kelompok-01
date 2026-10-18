"""Bounded, single-file multipart receiver using python-multipart callbacks."""

from contextlib import asynccontextmanager
import logging
import re
import tempfile
from typing import BinaryIO

from fastapi import Request
from python_multipart import MultipartParser
from python_multipart.exceptions import FormParserError, MultipartParseError
from python_multipart.multipart import parse_options_header
from starlette.requests import ClientDisconnect

from app.core.config import Settings
from app.services.fastq import InvalidFilenameError, UploadLimitError, validate_filename
from app.services.storage import StorageError
from app.services.upload_validation import joined_thread


CHUNK_BYTES = 65_536
OVERHEAD_BYTES = 65_536
HEADER_BYTES = 16_384


class MultipartError(ValueError):
    """Malformed or incomplete multipart request."""


class UploadFieldsError(ValueError):
    """The request does not contain exactly one file field."""


class UploadMediaTypeError(ValueError):
    """The request does not use multipart/form-data."""


class MultipartUpload:
    def __init__(self, request: Request, settings: Settings):
        content_type = request.headers.get("content-type", "")
        if len(content_type) > HEADER_BYTES:
            raise UploadLimitError("Request headers exceed their byte limit.")
        media_type, options = parse_options_header(content_type)
        if media_type != b"multipart/form-data":
            raise UploadMediaTypeError("Expected multipart/form-data.")
        boundary = options.get(b"boundary", b"")
        if not re.fullmatch(rb"[0-9A-Za-z'()+_,./:=? -]{1,70}", boundary) or boundary.endswith(b" "):
            raise MultipartError("Invalid multipart boundary.")
        lengths = request.headers.getlist("content-length")
        self.declared_size = None
        if lengths:
            if len(lengths) != 1 or not re.fullmatch(r"[0-9]{1,20}", lengths[0]):
                raise MultipartError("Invalid Content-Length.")
            self.declared_size = int(lengths[0])
            if self.declared_size > settings.upload_max_bytes + OVERHEAD_BYTES:
                raise UploadLimitError("Request body exceeds its byte limit.")
        self.max_file_bytes = settings.upload_max_bytes
        self.total_bytes = 0
        self.size_bytes = 0
        self.filename = ""
        self.file: BinaryIO | None = None
        self.complete = False
        self.parts = 0
        self.headers_done = False
        self.headers: dict[bytes, bytes] = {}
        self._name = bytearray()
        self._value = bytearray()
        self._chunk = b""
        self._offset = 0
        self._header_start: int | None = None
        self._last_position = 0
        self._header_wire_end = 0
        callbacks = {
            "on_part_begin": self._part_begin,
            "on_header_field": self._header_field,
            "on_header_value": self._header_value,
            "on_header_end": self._header_end,
            "on_headers_finished": self._headers_finished,
            "on_part_data": self._part_data,
            "on_end": self._end,
        }
        self.parser = MultipartParser(
            boundary, callbacks, max_header_size=HEADER_BYTES,
            max_header_count=HEADER_BYTES // 4,
        )
        # Parser diagnostics can include input characters. Use only our fixed errors.
        self.parser.logger = logging.Logger(__name__, level=logging.CRITICAL + 1)

    def open(self) -> None:
        # Anonymous private temporary file; no client filename or global named path.
        self.file = tempfile.TemporaryFile(mode="w+b")

    def _part_begin(self) -> None:
        self.parts += 1
        if self.parts > 1:
            raise UploadFieldsError("Expected exactly one file field named file.")

    def _touch_header(self, start: int, end: int) -> None:
        if self._header_start is None:
            self._header_start = self._offset + start
        self._last_position = self._offset + end
        if self._last_position - self._header_start > HEADER_BYTES:
            raise UploadLimitError("Multipart headers exceed their byte limit.")

    def _header_field(self, data: bytes, start: int, end: int) -> None:
        self._touch_header(start, end)
        self._name.extend(data[start:end])

    def _header_value(self, data: bytes, start: int, end: int) -> None:
        self._touch_header(start, end)
        self._value.extend(data[start:end])

    def _header_end(self) -> None:
        # Locate the current terminating CR using callback offsets, accounting for
        # spaces omitted by the value callback and headers split across chunks.
        end = self._chunk.find(b"\r", max(0, self._last_position - self._offset))
        self._header_wire_end = self._offset + end + 2
        if end < 0 or self._header_start is None:
            raise MultipartError("Malformed multipart headers.")
        if self._header_wire_end - self._header_start > HEADER_BYTES:
            raise UploadLimitError("Multipart headers exceed their byte limit.")
        name = bytes(self._name).lower()
        if name in self.headers:
            raise MultipartError("Duplicate multipart header.")
        self.headers[name] = bytes(self._value)
        self._name.clear()
        self._value.clear()

    def _headers_finished(self) -> None:
        if self._header_start is None:
            raise UploadFieldsError("Expected exactly one file field named file.")
        if self._header_wire_end - self._header_start + 2 > HEADER_BYTES:
            raise UploadLimitError("Multipart headers exceed their byte limit.")
        raw_disposition = self.headers.get(b"content-disposition", b"")
        # The library strips legacy Windows paths from filename parameters.
        # Refuse backslashes BEFORE that normalization can conceal a client path.
        if b"\\" in raw_disposition:
            raise InvalidFilenameError("Invalid upload filename.")
        disposition, options = parse_options_header(raw_disposition)
        if disposition != b"form-data" or options.get(b"name") != b"file" or b"filename" not in options:
            raise UploadFieldsError("Expected exactly one file field named file.")
        if b"content-transfer-encoding" in self.headers:
            raise MultipartError("Encoded multipart parts are not supported.")
        try:
            self.filename = options[b"filename"].decode("utf-8")
        except UnicodeError:
            raise UploadFieldsError("Invalid upload filename.") from None
        validate_filename(self.filename)
        self.headers_done = True

    def _part_data(self, data: bytes, start: int, end: int) -> None:
        self.size_bytes += end - start
        if self.size_bytes > self.max_file_bytes:
            raise UploadLimitError("Upload exceeds its byte limit.")
        assert self.file is not None
        self.file.write(memoryview(data)[start:end])

    def _end(self) -> None:
        self.complete = True

    def feed(self, chunk: bytes) -> None:
        self._chunk = chunk
        self._offset = self.total_bytes
        self.total_bytes += len(chunk)
        if self.total_bytes > self.max_file_bytes + OVERHEAD_BYTES:
            raise UploadLimitError("Request body exceeds its byte limit.")
        try:
            self.parser.write(chunk)
        except MultipartParseError as error:
            if str(error) in ("Maximum header size exceeded", "Maximum header count exceeded"):
                raise UploadLimitError("Multipart headers exceed their byte limit.") from None
            raise MultipartError("Malformed multipart body.") from None
        # Includes leading whitespace/epilogue. Allow bounded parser lookbehind.
        if self.total_bytes - self.size_bytes > OVERHEAD_BYTES + 80:
            raise UploadLimitError("Multipart overhead exceeds its byte limit.")
        if not self.headers_done and self._header_start is not None:
            if self.total_bytes - self._header_start > HEADER_BYTES:
                raise UploadLimitError("Multipart headers exceed their byte limit.")
        self._chunk = b""

    def finish(self) -> None:
        self.parser.finalize()
        if not self.complete:
            raise MultipartError("Incomplete multipart body.")
        if self.parts != 1 or not self.headers_done:
            raise UploadFieldsError("Expected exactly one file field named file.")
        if self.declared_size is not None and self.declared_size != self.total_bytes:
            raise MultipartError("Content-Length does not match the received body.")
        if self.total_bytes - self.size_bytes > OVERHEAD_BYTES:
            raise UploadLimitError("Multipart overhead exceeds its byte limit.")
        assert self.file is not None
        self.file.seek(0)


@asynccontextmanager
async def receive_upload(request: Request, settings: Settings):
    try:
        upload = MultipartUpload(request, settings)
    except FormParserError:
        raise MultipartError("Malformed multipart headers.") from None
    primary = None
    try:
        await joined_thread(upload.open)
        try:
            async for chunk in request.stream():
                for offset in range(0, len(chunk), CHUNK_BYTES):
                    piece = chunk[offset:offset + CHUNK_BYTES]
                    await joined_thread(lambda: upload.feed(piece))
        except ClientDisconnect:
            raise MultipartError("Upload connection interrupted.") from None
        await joined_thread(upload.finish)
        yield upload
    except BaseException as error:
        primary = error
        raise
    finally:
        if upload.file is not None:
            try:
                await joined_thread(upload.file.close)
            except OSError:
                if primary is not None:
                    primary.add_note("Temporary upload cleanup failed.")
                else:
                    raise StorageError("Temporary upload cleanup failed.") from None
