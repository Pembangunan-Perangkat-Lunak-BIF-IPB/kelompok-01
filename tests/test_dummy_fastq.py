import subprocess
import sys
from pathlib import Path

import pytest

from scripts.generate_dummy_fastq import write_fastq

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "generate_dummy_fastq.py"


def test_default_fastq_has_valid_records(tmp_path: Path) -> None:
    output = tmp_path / "samples" / "dummy.fastq"
    write_fastq(output)

    lines = output.read_text(encoding="ascii").splitlines()
    assert len(lines) == 40
    assert 2_000 < output.stat().st_size < 4_000
    assert output.read_bytes().endswith(b"\n")

    for index in range(10):
        header, sequence, separator, quality = lines[index * 4 : index * 4 + 4]
        assert header == f"@dummy_{index + 1:06d}"
        assert set(sequence) <= set("ACGT")
        assert separator == "+"
        assert len(sequence) == len(quality) == 150
        assert quality == "I" * 150


def test_seed_produces_reproducible_output(tmp_path: Path) -> None:
    first = tmp_path / "first.fastq"
    second = tmp_path / "second.fastq"
    write_fastq(first, reads=3, read_length=75, seed=7)
    write_fastq(second, reads=3, read_length=75, seed=7)

    assert first.read_bytes() == second.read_bytes()


def test_existing_file_is_not_overwritten(tmp_path: Path) -> None:
    output = tmp_path / "existing.fastq"
    output.write_text("keep this content", encoding="ascii")

    with pytest.raises(FileExistsError):
        write_fastq(output)

    assert output.read_text(encoding="ascii") == "keep this content"


@pytest.mark.parametrize("reads,read_length", [(0, 150), (-1, 150), (10, 0), (10, -1)])
def test_invalid_dimensions_do_not_create_file(
    tmp_path: Path, reads: int, read_length: int
) -> None:
    output = tmp_path / "invalid.fastq"

    with pytest.raises(ValueError, match="greater than zero"):
        write_fastq(output, reads=reads, read_length=read_length)

    assert not output.exists()


def test_cli_generates_custom_fastq(tmp_path: Path) -> None:
    output = tmp_path / "custom.fastq"
    result = subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            "--output", str(output),
            "--reads", "2",
            "--read-length", "25",
        ],
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr
    lines = output.read_text(encoding="ascii").splitlines()
    assert len(lines) == 8
    assert len(lines[1]) == len(lines[3]) == 25


@pytest.mark.parametrize("value", ["0", "-1", "abc"])
def test_cli_rejects_invalid_reads(tmp_path: Path, value: str) -> None:
    output = tmp_path / "invalid.fastq"
    result = subprocess.run(
        [sys.executable, str(SCRIPT), "--output", str(output), "--reads", value],
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 2
    assert not output.exists()
