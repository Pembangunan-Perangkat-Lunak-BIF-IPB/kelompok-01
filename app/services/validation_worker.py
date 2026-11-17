"""One-shot Linux validator. Receives only a descriptor and numeric limits."""

import os
from pathlib import Path
import resource
import sys


def main() -> int:
    # -I deliberately excludes the script directory. Import only the pure parser;
    # never import app.main, Settings, authentication, or database modules here.
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    from app.services.fastq import InvalidFastqError, UploadLimitError, validate_upload

    descriptor, suffix, max_bytes, line_bytes, cpu_seconds = sys.argv[1:]
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    cpu_seconds = int(cpu_seconds)
    resource.setrlimit(resource.RLIMIT_CPU, (cpu_seconds, cpu_seconds + 1))
    try:
        with os.fdopen(int(descriptor), "rb") as source:
            validate_upload(source, suffix, max_bytes=int(max_bytes), max_line_bytes=int(line_bytes))
    except InvalidFastqError:
        return 2
    except UploadLimitError:
        return 3
    return 0


if __name__ == "__main__":
    try:
        result = main()
    except Exception:
        result = 70  # No traceback or input data crosses the worker boundary.
    sys.exit(result)
