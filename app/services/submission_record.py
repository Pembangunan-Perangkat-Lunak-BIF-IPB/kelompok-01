"""Private, fsynced upload receipts; flock serializes a user's submission UUID.

The receipt is written BEFORE Sample persistence. An interrupted/ambiguous
upload is never automatically retried. Keep receipts for operator reconciliation.
"""

try:
    import fcntl
except ImportError:
    # Dummy object agar tidak crash di Windows
    class DummyFcntl:
        LOCK_EX = 0
        LOCK_SH = 0
        LOCK_NB = 0
        LOCK_UN = 0

        @staticmethod
        def flock(fd, operation):
            pass  # Di Windows, penguncian file di-bypass untuk pengujian lokal

    fcntl = DummyFcntl()
import json
import os
import stat
from uuid import uuid4

from app.services.storage import _open_root


class SubmissionBusy(ValueError):
    pass


class SubmissionRecord:
    def __init__(self, root, owner, request_id):
        self.root_fd = _open_root(root.absolute() / ".submissions")
        self.lock_fd = None
        self.name = f"{owner}-{request_id}.json"
        try:
            self.lock_fd = os.open(self.name + ".lock", os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW,
                                   0o600, dir_fd=self.root_fd)
            self._check(self.lock_fd)
            try:
                fcntl.flock(self.lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                raise SubmissionBusy("Submission is already in progress.") from None
            try:
                fd = os.open(self.name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=self.root_fd)
            except FileNotFoundError:
                self.data = None
            else:
                try:
                    self._check(fd)
                    raw = os.read(fd, 65_537)
                    if len(raw) > 65_536:
                        raise ValueError("Invalid submission receipt.")
                    self.data = json.loads(raw)
                    if not isinstance(self.data, dict) or self.data.get("version") != 1:
                        raise ValueError("Invalid submission receipt.")
                    phase = self.data.get("phase")
                    if (phase not in ("upload_started", "rejected", "sample_stored", "job_stored")
                            or not isinstance(self.data.get("configuration"), dict)
                            or not isinstance(self.data.get("fingerprint"), dict)
                            or phase in ("sample_stored", "job_stored") and not isinstance(self.data.get("sample"), dict)):
                        raise ValueError("Invalid submission receipt.")
                finally:
                    os.close(fd)
        except BaseException:
            self.close()
            raise

    @staticmethod
    def _check(fd):
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_uid != os.geteuid() or info.st_mode & 0o077:
            raise ValueError("Unsafe submission receipt.")

    def write(self, data):
        raw = json.dumps({**data, "version": 1}, allow_nan=False).encode("utf-8")
        if len(raw) > 65_536:
            raise ValueError("Submission receipt exceeds its size limit.")
        temporary = self.name + "." + uuid4().hex + ".part"
        fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                     0o600, dir_fd=self.root_fd)
        with os.fdopen(fd, "wb") as stream:
            stream.write(raw)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, self.name, src_dir_fd=self.root_fd, dst_dir_fd=self.root_fd)
        os.fsync(self.root_fd)
        self.data = {**data, "version": 1}

    def close(self):
        if self.lock_fd is not None:
            os.close(self.lock_fd)
            self.lock_fd = None
        if self.root_fd is not None:
            os.close(self.root_fd)
            self.root_fd = None
