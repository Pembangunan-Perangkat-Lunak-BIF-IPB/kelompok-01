#!/usr/bin/python3
"""Single-end SAM adapter using an explicit, precomputed Bowtie2 index.

Standard library only so Nextflow can execute this file without app settings.
Reference identity is checked from reconstructed index sequence, not filenames.
"""

import argparse
import hashlib
from pathlib import Path
import re
import resource
import subprocess
import tempfile


SUFFIXES = ("1", "2", "3", "4", "rev.1", "rev.2")


def index_files(prefix: Path) -> list[Path]:
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,127}", prefix.name):
        raise ValueError("Unsafe Bowtie2 index prefix.")
    groups = [[Path(f"{prefix}.{suffix}.{extension}") for suffix in SUFFIXES]
              for extension in ("bt2", "bt2l")]
    present = [[path.exists() for path in group] for group in groups]
    complete = [group for group, flags in zip(groups, present) if all(flags)]
    if len(complete) != 1 or sum(sum(flags) for flags in present) != 6:
        raise ValueError("Exactly one complete six-file Bowtie2 index is required.")
    if any(not path.is_file() or path.stat().st_size == 0 for path in complete[0]):
        raise ValueError("Bowtie2 index contains an empty or invalid file.")
    return complete[0]


def fasta_digest(path: Path) -> str:
    digest = hashlib.sha256()
    names = set()
    bases = 0
    with path.open(encoding="ascii") as stream:
        for raw in stream:
            line = raw.strip()
            if not line:
                continue
            if line.startswith(">"):
                if names and not bases:
                    raise ValueError("Empty FASTA sequence.")
                name = line[1:].split()[0] if line[1:].strip() else ""
                if not name or name in names:
                    raise ValueError("Invalid or duplicate FASTA sequence name.")
                names.add(name)
                bases = 0
                digest.update(b"\n>" + name.encode("ascii") + b"\n")
            else:
                sequence = line.upper()
                if not names or not re.fullmatch(r"[ACGTN]+", sequence):
                    raise ValueError("Unsupported FASTA sequence.")
                bases += len(sequence)
                digest.update(sequence.encode("ascii"))
    if not names or not bases:
        raise ValueError("Empty FASTA reference.")
    return digest.hexdigest()


def validate_reference(reference: Path, prefix: Path, inspector: Path, directory: Path) -> str:
    index_files(prefix)
    # A private temporary file bounds Python memory even for a larger reference.
    with tempfile.TemporaryDirectory(prefix="index-check-", dir=directory) as temporary:
        reconstructed = Path(temporary) / "index.fa"
        with reconstructed.open("xb") as output:
            subprocess.run([str(inspector), str(prefix)], stdout=output, check=True, timeout=120)
        expected = fasta_digest(reference)
        if fasta_digest(reconstructed) != expected:
            raise ValueError("Bowtie2 index does not match reference sequence and contig names.")
    return expected


def align(*, reads: Path, reference: Path, output: Path, sample: str, threads: int,
          prefix: Path, bowtie2: Path, inspector: Path) -> None:
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,63}", sample) or not 1 <= threads <= 4:
        raise ValueError("Invalid sample mapping or thread limit.")
    if not reads.is_file() or output.exists() or output.is_symlink():
        raise ValueError("Reads are missing or output already exists.")
    validate_reference(reference, prefix, inspector, output.parent)
    # Fixed arguments, no shell, no index construction, no implicit reference.
    with output.open("xb") as sam:
        subprocess.run([str(bowtie2), "--end-to-end", "--sensitive", "--seed", "0",
                        "-x", str(prefix), "-U", str(reads), "-p", str(threads),
                        "--rg-id", sample, "--rg", "SM:" + sample],
                       stdout=sam, check=True, timeout=600)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("reads", "reference", "output", "index-prefix", "bowtie2", "bowtie2-inspect"):
        parser.add_argument("--" + name, required=True, type=Path)
    parser.add_argument("--sample-name", required=True)
    parser.add_argument("--threads", required=True, type=int)
    args = parser.parse_args()
    # M8 local execution budget; full-reference capacity is a separate checkpoint.
    budget = 4 * 1024**3
    soft, hard = resource.getrlimit(resource.RLIMIT_AS)
    limit = min(budget, hard) if hard != resource.RLIM_INFINITY else budget
    resource.setrlimit(resource.RLIMIT_AS, (min(soft, limit) if soft >= 0 else limit, hard))
    align(reads=args.reads, reference=args.reference, output=args.output,
          sample=args.sample_name, threads=args.threads, prefix=args.index_prefix,
          bowtie2=args.bowtie2, inspector=args.bowtie2_inspect)


if __name__ == "__main__":
    main()
