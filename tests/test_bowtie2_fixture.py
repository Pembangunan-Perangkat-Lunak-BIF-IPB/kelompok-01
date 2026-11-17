import gzip
import hashlib
import json

import pytest

from scripts.generate_bowtie2_fixture import generate_fixture, reverse_complement


def test_fixture_is_reproducible_and_reads_match_known_diploid_truth(tmp_path):
    first, second = tmp_path / "first", tmp_path / "second"
    manifest = generate_fixture(first)
    assert generate_fixture(second) == manifest
    assert sorted(p.name for p in first.iterdir()) == sorted(p.name for p in second.iterdir())
    for path in first.iterdir():
        assert path.read_bytes() == (second / path.name).read_bytes()
    assert manifest["reference_length"] == 20_000 and manifest["fixture_ploidy"] == 2
    assert manifest["total_reads"] == 7942
    assert manifest["truth"] == [
        {"position": 5001, "ref": "A", "alt": "C", "type": "snp", "gt": "0|1"},
        {"position": 12001, "ref": "A", "alt": "ACGT", "type": "indel", "gt": "0|1"},
    ]
    haplotypes = (first / "truth_haplotypes.fa").read_text().split(">")[1:]
    reference, alternate = ["".join(h.splitlines()[1:]) for h in haplotypes]
    assert alternate == reference[:5000] + "C" + reference[5001:12001] + "CGT" + reference[12001:]
    lines = (first / "reads.fastq").read_text().splitlines()
    names = set()
    for name, sequence, plus, quality in zip(*[iter(lines)] * 4):
        assert name not in names
        names.add(name)
        _, haplotype, start, strand = name.split("_")
        truth = (reference, alternate)[int(haplotype[1:]) - 1][int(start):int(start) + 150]
        assert sequence == (reverse_complement(truth) if strand == "R" else truth)
        assert plus == "+" and quality == "I" * 150
    assert len(names) == 7942 and len(lines) == 7942 * 4
    assert gzip.decompress((first / "reads.fastq.gz").read_bytes()) == (first / "reads.fastq").read_bytes()
    assert json.loads((first / "fixture.json").read_text()) == manifest
    for name, metadata in manifest["files"].items():
        content = (first / name).read_bytes()
        assert len(content) == metadata["bytes"]
        assert hashlib.sha256(content).hexdigest() == metadata["sha256"]


def test_fixture_refuses_existing_directory_without_overwriting(tmp_path):
    target = tmp_path / "existing"
    generate_fixture(target)
    before = {p.name: p.read_bytes() for p in target.iterdir()}
    with pytest.raises(FileExistsError):
        generate_fixture(target)
    assert {p.name: p.read_bytes() for p in target.iterdir()} == before
