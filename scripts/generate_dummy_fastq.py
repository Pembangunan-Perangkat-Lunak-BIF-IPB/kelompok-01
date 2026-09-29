"""Generate synthetic single-end FASTQ for upload tests, not biological validation."""

import argparse
import random
from pathlib import Path


def positive_int(value: str) -> int:
    try:
        number = int(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("must be an integer") from exc
    if number <= 0:
        raise argparse.ArgumentTypeError("must be greater than zero")
    return number


def write_fastq(
    output: Path,
    *,
    reads: int = 10,
    read_length: int = 150,
    seed: int = 42,
) -> None:
    if reads <= 0 or read_length <= 0:
        raise ValueError("reads and read_length must be greater than zero")

    rng = random.Random(seed)
    quality = "I" * read_length  # Phred+33: 'I' represents a quality score of 40.
    output.parent.mkdir(parents=True, exist_ok=True)

    # Exclusive creation protects existing sample files from accidental overwrite.
    with output.open("x", encoding="ascii", newline="\n") as handle:
        for index in range(1, reads + 1):
            sequence = "".join(rng.choices("ACGT", k=read_length))
            handle.write(f"@dummy_{index:06d}\n{sequence}\n+\n{quality}\n")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output", type=Path, default=Path("data/samples/dummy.fastq")
    )
    parser.add_argument("--reads", type=positive_int, default=10)
    parser.add_argument("--read-length", type=positive_int, default=150)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    try:
        write_fastq(
            args.output,
            reads=args.reads,
            read_length=args.read_length,
            seed=args.seed,
        )
    except OSError as exc:
        parser.exit(1, f"Could not write FASTQ: {exc}\n")

    print(
        f"Created {args.output}: {args.reads} reads, "
        f"{args.read_length} bases/read, {args.output.stat().st_size} bytes"
    )


if __name__ == "__main__":
    main()
