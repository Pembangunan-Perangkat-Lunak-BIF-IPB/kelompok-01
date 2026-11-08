"""Controlled diploid fixture for real-tool smoke tests, not research evidence."""

import argparse
from collections import Counter
import gzip
import hashlib
import json
from pathlib import Path
import random


SEED = 20261104
LENGTH = 20000
READ_LENGTH = 150
STRIDE = 5
SAMPLE = "m8_fixture_diploid"
CHROM = "fixture_chr1"


def reverse_complement(sequence):
    return sequence.translate(str.maketrans("ACGT", "TGCA"))[::-1]


def write_exclusive(path, content):
    with path.open("x", encoding="ascii", newline="\n") as stream:
        stream.write(content)


def fasta(name, sequence):
    return f">{name}\n" + "\n".join(
        sequence[i:i + 60] for i in range(0, len(sequence), 60)
    ) + "\n"


def generate_fixture(root: Path):
    # A fresh directory protects fixtures and evidence from previous runs.
    root.mkdir(mode=0o700, parents=True, exist_ok=False)
    rng = random.Random(SEED)
    reference = "".join(rng.choice("ACGT") for _ in range(LENGTH))
    snp_index, insertion_anchor = 5000, 12000
    snp_alt = next(base for base in "ACGT" if base != reference[snp_index])
    insertion = "".join(base for base in "ACGT" if base != reference[insertion_anchor])
    alternate = reference[:snp_index] + snp_alt + reference[snp_index + 1:]
    alternate = alternate[:insertion_anchor + 1] + insertion + alternate[insertion_anchor + 1:]
    # Uniqueness is checked in both orientations, without running an aligner.
    kmers = Counter(min(reference[i:i + 31], reverse_complement(reference[i:i + 31]))
                    for i in range(LENGTH - 30))
    assert max(kmers.values()) == 1
    assert len(alternate) == LENGTH + 3
    assert insertion[-1] != reference[insertion_anchor]
    reads = []
    per_haplotype = []
    strand_counts = Counter()
    for haplotype, sequence in enumerate((reference, alternate), 1):
        count = 0
        for number, start in enumerate(range(0, len(sequence) - READ_LENGTH + 1, STRIDE)):
            reverse = (number + haplotype) % 2 == 0
            read = sequence[start:start + READ_LENGTH]
            if reverse:
                read = reverse_complement(read)
            restored = reverse_complement(read) if reverse else read
            assert restored == sequence[start:start + READ_LENGTH]
            strand_counts["reverse" if reverse else "forward"] += 1
            reads.append(f"@fixture_h{haplotype}_{start:05d}_{'R' if reverse else 'F'}\n"
                         f"{read}\n+\n{'I' * READ_LENGTH}\n")
            count += 1
        per_haplotype.append(count)
    fastq = "".join(reads).encode("ascii")
    write_exclusive(root / "reference.fa", fasta(CHROM, reference))
    write_exclusive(root / "truth_haplotypes.fa", fasta("haplotype_1", reference)
                    + fasta("haplotype_2", alternate))
    with (root / "reads.fastq").open("xb") as stream:
        stream.write(fastq)
    with (root / "reads.fastq.gz").open("xb") as stream:
        with gzip.GzipFile(filename="", mode="wb", fileobj=stream, mtime=0, compresslevel=6) as compressed:
            compressed.write(fastq)
    assert gzip.decompress((root / "reads.fastq.gz").read_bytes()) == fastq
    truth = [
        {"position": snp_index + 1, "ref": reference[snp_index], "alt": snp_alt, "type": "snp", "gt": "0|1"},
        {"position": insertion_anchor + 1, "ref": reference[insertion_anchor],
         "alt": reference[insertion_anchor] + insertion, "type": "indel", "gt": "0|1"},
    ]
    header = ("##fileformat=VCFv4.2\n##source=GENOPATH_CONTROLLED_TRUTH_NOT_CALLER_OUTPUT\n"
              f"##contig=<ID={CHROM},length={LENGTH}>\n"
              '##FORMAT=<ID=GT,Number=1,Type=String,Description="Known phased diploid truth">\n'
              f"#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\t{SAMPLE}\n")
    write_exclusive(root / "truth.vcf", header + "".join(
        f"{CHROM}\t{v['position']}\t.\t{v['ref']}\t{v['alt']}\t.\t.\t.\tGT\t{v['gt']}\n"
        for v in truth))
    names = ["reference.fa", "truth_haplotypes.fa", "reads.fastq", "reads.fastq.gz", "truth.vcf"]
    files = {name: {"bytes": (root / name).stat().st_size,
                    "sha256": hashlib.sha256((root / name).read_bytes()).hexdigest()} for name in names}
    manifest = {"kind": "controlled synthetic input for real bioinformatics tools",
                "research_evidence": False, "seed": SEED, "reference_length": LENGTH,
                "sample": SAMPLE, "chromosome": CHROM, "fixture_ploidy": 2,
                "ploidy_scope": "this fixture only; no GenoPath default",
                "read_length": READ_LENGTH, "quality": "Phred+33 Q40",
                "reads_per_haplotype": per_haplotype, "total_reads": sum(per_haplotype),
                "strand_counts": dict(strand_counts), "nominal_depth": len(reads) * READ_LENGTH / LENGTH,
                "canonical_31mers_unique": True, "gzip_matches_plain": True,
                "truth": truth, "files": files}
    write_exclusive(root / "fixture.json", json.dumps(manifest, indent=2) + "\n")
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", required=True, type=Path)
    args = parser.parse_args()
    try:
        manifest = generate_fixture(args.output_dir)
    except OSError as error:
        parser.exit(1, f"Fixture generation refused or incomplete: {error}\n")
    print(json.dumps({key: manifest[key] for key in
                     ("reference_length", "fixture_ploidy", "total_reads", "nominal_depth", "truth")}))


if __name__ == "__main__":
    main()
