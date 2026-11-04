"""Synthetic VCF unit tests; no application, settings, or database initialization."""

from io import StringIO
from unittest.mock import Mock

import pytest

from app.services import vcf_summary
from app.services.vcf_summary import InvalidVcfError, VcfSummary, summarize_vcf


HEADER = "##fileformat=VCFv4.2\n#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\n"


def record(ref="A", alt="C", pos="1"):
    return f"chr1\t{pos}\t.\t{ref}\t{alt}\t.\tPASS\t.\n"


def write_vcf(tmp_path, content):
    path = tmp_path / "synthetic.vcf"
    path.write_bytes(content.encode("utf-8"))
    return path


def test_summary_counts_records_and_keeps_categories_exclusive(tmp_path):
    content = HEADER + "".join([
        record("A", "C"), record("C", "A,G"),
        record("A", "AT"), record("AT", "A"), record("AC", "A,ACT"),
        record("A", "C,AT"), record("AC", "GT"), record("A", "<DEL>"),
        record("A", "."),
    ])
    summary = summarize_vcf(write_vcf(tmp_path, content))

    assert summary == VcfSummary(total_variants=8, snps=2, indels=3, other=3)
    assert summary.total_variants == summary.snps + summary.indels + summary.other


@pytest.mark.parametrize("ref,alt,expected", [
    ("A", "C", "snp"), ("a", "g", "snp"), ("C", "A,G,T", "snp"),
    ("A", "AT", "indel"), ("AT", "A", "indel"),
    ("A", "TA", "indel"), ("TA", "A", "indel"),  # Right padding at POS=1.
    ("ACG", "ATCG", "indel"), ("ATCG", "ACG", "indel"),
    ("A", "AC,AGG", "indel"), ("ACG", "A,AC", "indel"),
    ("AC", "A,ACT", "indel"),  # Both deletion and insertion are InDels.
    ("AC", "GT", "other"), ("AC", "AT", "other"),  # MNV / padded SNP.
    ("AC", "AGT", "other"), ("ACG", "ATTG", "other"),  # Complex delins.
    ("A", "C,AT", "other"), ("AC", "A,GT", "other"),
    ("A", "N", "other"), ("N", "A", "other"), ("AN", "A", "other"),
    ("A", "C,N", "other"), ("A", "<DEL>", "other"),
    ("A", "<INS:ME:ALU>", "other"), ("A", "<NON_REF>", "other"),
    ("A", "<*>", "other"), ("A", "*", "other"), ("A", "C,*", "other"),
    ("A", "C,<NON_REF>", "other"),
    ("A", "A[chr2:10[", "other"), ("A", "A]chr2:10]", "other"),
    ("A", "[chr2:10[A", "other"), ("A", "]chr2:10]A", "other"),
    ("A", "A.", "other"), ("A", ".A", "other"),
])
def test_conservative_allele_classification(tmp_path, ref, alt, expected):
    summary = summarize_vcf(write_vcf(tmp_path, HEADER + record(ref, alt)))

    assert summary == VcfSummary(
        total_variants=1,
        snps=int(expected == "snp"),
        indels=int(expected == "indel"),
        other=int(expected == "other"),
    )


@pytest.mark.parametrize("body", ["", record(alt=".")])
def test_header_only_and_non_variant_records_return_zero_counts(tmp_path, body):
    assert summarize_vcf(write_vcf(tmp_path, HEADER + body)) == VcfSummary()


def test_metadata_line_endings_path_string_and_missing_final_newline(tmp_path):
    content = HEADER.replace("#CHROM", "##source=synthetic\n#CHROM") + record()
    path = write_vcf(tmp_path, content.rstrip("\n").replace("\n", "\r\n"))

    assert summarize_vcf(str(path)) == VcfSummary(total_variants=1, snps=1)


def test_filter_and_sample_genotypes_do_not_select_records(tmp_path):
    header = HEADER.rstrip("\n") + "\tFORMAT\tSYNTHETIC_1\tSYNTHETIC_2\n"
    # ALT-based record counting includes filtered calls and all-reference genotypes.
    body = record().rstrip("\n").replace("PASS", "q10") + "\tGT\t0/0\t./.\n"

    assert summarize_vcf(write_vcf(tmp_path, header + body)) == VcfSummary(1, 1, 0, 0)


def test_telomeric_position_zero_is_allowed(tmp_path):
    assert summarize_vcf(write_vcf(tmp_path, HEADER + record(alt="<DEL>", pos="0"))) == (
        VcfSummary(total_variants=1, other=1)
    )


@pytest.mark.parametrize("body", [
    "\n", "chr1 1 . A C . PASS .\n", "chr1\t1\t.\tA\tC\n",
    record().rstrip("\n") + "\textra\n", record().replace("\tPASS\t", "\t\t"),
    record().replace("chr1", "."), record().replace("chr1", "chr 1"),
    record(pos="-1"), record(pos="1.5"), record(pos="+1"), record(pos="one"),
    record(pos="١"), record(pos=" 1"),
    record(ref="."), record(ref="R"), record(ref="A C"),
    record(alt=""), record(alt="R"), record(alt="C,"), record(alt=",C"),
    record(alt="C,,G"), record(alt=".,C"), record(alt="C C"),
    record(alt="A"), record(alt="a"), record(alt="C,C"), record(alt="C,c"),
    record(alt="<DEL"), record(alt="<>"), record(alt="<DEL ME>"),
    record(alt="A[chr2:10]"), record(alt="A[chr2:bad["),
])
def test_invalid_records_raise_with_line_number(tmp_path, body):
    with pytest.raises(InvalidVcfError, match="line 3") as error:
        summarize_vcf(write_vcf(tmp_path, HEADER + body))

    assert error.value.line_number == 3


@pytest.mark.parametrize("content,line_number", [
    ("", 1), ("\n", 1), (record(), 1),
    (HEADER.split("\n", 1)[1] + record(), 1),
    (HEADER.replace("VCFv4.2", "VCFv3.3"), 1),
    ("##fileformat=VCFv4.2\n", 2),
    ("##fileformat=VCFv4.2\n" + record(), 2),
    (HEADER.replace("\tPOS\t", "\tPOSITION\t"), 2),
    (HEADER.rstrip("\n") + "\tFORMAT\n", 2),
    (HEADER.rstrip("\n") + "\tOTHER\tSAMPLE\n", 2),
    (HEADER.rstrip("\n") + "\tFORMAT\tSAME\tSAME\n", 2),
    (HEADER.rstrip("\n") + "\tFORMAT\t\n", 2),
    (HEADER.rstrip("\n") + "\tFORMAT\tBAD NAME\n", 2),
    (HEADER + HEADER.split("\n", 1)[1], 3),
    (HEADER + "##source=late\n", 3),
    ("##fileformat=VCFv4.2\n" + HEADER, 2),
    (HEADER + "#unexpected\n", 3),
])
def test_missing_malformed_or_misplaced_headers_are_errors(tmp_path, content, line_number):
    with pytest.raises(InvalidVcfError) as error:
        summarize_vcf(write_vcf(tmp_path, content))

    assert error.value.line_number == line_number


def test_record_width_must_match_sample_header(tmp_path):
    header = HEADER.rstrip("\n") + "\tFORMAT\tSYNTHETIC\n"
    with pytest.raises(InvalidVcfError, match="line 3"):
        summarize_vcf(write_vcf(tmp_path, header + record()))


def test_late_invalid_record_aborts_instead_of_returning_partial_counts(tmp_path):
    path = write_vcf(tmp_path, HEADER + record() + record(pos="invalid"))
    with pytest.raises(InvalidVcfError, match="line 4"):
        summarize_vcf(path)


def test_reader_iterates_lines_without_read_or_readlines(monkeypatch):
    class IterationOnly(StringIO):
        def read(self, *args, **kwargs):
            raise AssertionError("Must not read the entire VCF")

        def readlines(self, *args, **kwargs):
            raise AssertionError("Must not collect VCF lines")

    stream = IterationOnly(HEADER + record() * 3)
    opener = Mock(return_value=stream)
    monkeypatch.setattr(vcf_summary, "open", opener, raising=False)

    assert summarize_vcf("synthetic.vcf") == VcfSummary(total_variants=3, snps=3)
    opener.assert_called_once_with("synthetic.vcf", encoding="utf-8")
    assert stream.closed


def test_missing_file_propagates_io_error(tmp_path):
    with pytest.raises(FileNotFoundError):
        summarize_vcf(tmp_path / "missing.vcf")


def test_invalid_utf8_propagates_decoding_error(tmp_path):
    path = tmp_path / "synthetic.vcf"
    path.write_bytes(HEADER.encode("utf-8") + b"\xff\n")
    with pytest.raises(UnicodeDecodeError):
        summarize_vcf(path)
