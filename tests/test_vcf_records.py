from pathlib import Path

import pytest

from app.services.vcf_records import read_vcf_records
from app.services.vcf_summary import InvalidVcfError, summarize_vcf


HEADER = "##fileformat=VCFv4.2\n#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tfixture_sample\n"


def row(ref="A", alt="C", qual="60", filters="PASS", info="DP=999;FLAG", gt="0/1", dp="20", pos="1"):
    return f"synthetic_chr\t{pos}\t.\t{ref}\t{alt}\t{qual}\t{filters}\t{info}\tGT:DP\t{gt}:{dp}\n"


def read(tmp_path, body, header=HEADER):
    path = tmp_path / "records.vcf"
    path.write_text(header + body)
    return list(read_vcf_records(path, "fixture_sample"))


def test_record_metadata_phase_and_multiallelic_indexes_are_preserved(tmp_path):
    record, = read(tmp_path, row(alt="C,G", gt="1|2", info="DP=999;FLAG;TEXT=a,b"))
    assert (record.alt, record.variant_type, record.genotype, record.dp) == ("C,G", "snp", "1|2", 20)
    assert record.info == {"DP": "999", "FLAG": None, "TEXT": "a,b"}
    assert record.source_line.endswith("1|2:20")


@pytest.mark.parametrize("ref,alt,kind", [("A", "AT", "indel"), ("A", "C,AT", "other"),
                                            ("AC", "GT", "other"), ("A", "<DEL>", "other")])
def test_types_match_legacy_record_semantics(tmp_path, ref, alt, kind):
    record, = read(tmp_path, row(ref=ref, alt=alt))
    assert record.variant_type == kind
    summary = summarize_vcf(tmp_path / "records.vcf")
    assert summary.total_variants == 1
    assert getattr(summary, {"snp": "snps", "indel": "indels", "other": "other"}[kind]) == 1


@pytest.mark.parametrize("gt", [".", "./.", "0|.", "1", "0/0/1", "0/0"])
def test_missing_haploid_polyploid_and_reference_genotypes_are_not_rewritten(tmp_path, gt):
    record, = read(tmp_path, row(gt=gt, dp=".", qual="."))
    assert record.genotype == gt and record.dp is None and record.qual is None


@pytest.mark.parametrize("kwargs", [
    {"qual": "NaN"}, {"qual": "inf"}, {"qual": "-1"}, {"qual": "bad"},
    {"dp": "-1"}, {"dp": "1.5"}, {"dp": "2147483648"},
    {"gt": "0/2"}, {"gt": "-1/0"}, {"gt": "0//1"}, {"gt": "A"},
    {"filters": "PASS;q10"}, {"filters": "q10;q10"}, {"filters": "q 10"},
    {"info": "DP=1;DP=2"}, {"info": "DP="}, {"info": "FLAG;"}, {"info": "X=a b"},
    {"pos": "2147483648"},
    {"pos": "9" * 5000}, {"dp": "9" * 5000}, {"gt": "9" * 5000},
])
def test_semantically_invalid_records_fail(tmp_path, kwargs):
    with pytest.raises(InvalidVcfError):
        read(tmp_path, row(**kwargs))


@pytest.mark.parametrize("header", [
    HEADER.replace("fixture_sample", "different"), HEADER.rstrip("\n") + "\textra_sample\n",
    HEADER.replace("\tFORMAT\tfixture_sample", ""),
])
def test_sample_mapping_must_be_explicit_and_exact(tmp_path, header):
    with pytest.raises(InvalidVcfError):
        read(tmp_path, row(), header=header)


@pytest.mark.parametrize("body", [row().replace("GT:DP", "GT:GT"),
                                  row().replace("GT:DP", "AD:DP"),
                                  row().replace("0/1:20", "0/1:20:3")])
def test_invalid_format_is_rejected(tmp_path, body):
    with pytest.raises(InvalidVcfError):
        read(tmp_path, body)


def test_nonvariant_and_empty_results_are_valid_and_zero(tmp_path):
    assert read(tmp_path, "") == []
    assert read(tmp_path, row(alt=".", gt="0/0")) == []


def test_missing_trailing_dp_is_none_not_info_depth(tmp_path):
    record, = read(tmp_path, row().replace("0/1:20", "0/1"))
    assert record.dp is None and record.info["DP"] == "999"


def test_long_leading_zero_integer_fields_are_bounded_without_python_int_limit(tmp_path):
    record, = read(tmp_path, row(pos="0" * 5000 + "1", dp="0" * 5000 + "20"))
    assert record.position == 1 and record.dp == 20
