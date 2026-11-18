"""Streaming, record-level counts for local, uncompressed UTF-8 VCF files.

Policy (deliberately conservative, not a full VCF validator):
* Require a VCFv4.x fileformat line first and one tab-delimited #CHROM header.
  Metadata before #CHROM is ignored; blank lines and later headers are errors.
* Count each record with ALT other than '.' once, including filtered records,
  regardless of sample genotypes. Do not deduplicate positions or records.
* SNP: REF and every ALT are distinct, single A/C/G/T bases.
* InDel: every ALT is an A/C/G/T sequence representing a pure insertion or
  deletion after removing shared prefix and suffix. Either padding direction
  is supported. Length differences alone do not establish an InDel.
* A multiallelic record is SNP/InDel only if all ALTs have that same category.
  Mixed types, MNVs, padded substitutions, complex replacements, N-containing
  alleles, symbolic alleles, spanning-deletion '*', and breakends are 'other'.
* ALT '.' is a non-variant record and is excluded from every count.
* Invalid structure/alleles raise InvalidVcfError with a 1-based line number;
  no partial summary is returned. Checks cover header/record column counts,
  nonempty fields, CHROM, non-negative decimal POS (including telomeric 0),
  REF/ALT syntax, duplicate ALTs, and ALT equal to REF. QUAL/FILTER/INFO and
  genotype semantics, metadata declarations, sorting, and reference agreement
  are not validated. I/O and Unicode decoding errors propagate to the caller.

Memory use scales with the longest line, not the number of records. No database,
application settings, external tools, or third-party packages are used.
"""

from dataclasses import dataclass
from os import PathLike
import re


_COLUMNS = ("#CHROM", "POS", "ID", "REF", "ALT", "QUAL", "FILTER", "INFO")
_SEQUENCE = re.compile(r"[ACGTNacgtn]+")
_SYMBOLIC = re.compile(r"<[^<>\s,]+>")
_BREAKEND = re.compile(
    r"(?:[ACGTNacgtn]+(?P<right>[\[\]])[^\[\]\s,]+:[0-9]+(?P=right)"
    r"|(?P<left>[\[\]])[^\[\]\s,]+:[0-9]+(?P=left)[ACGTNacgtn]+"
    r"|[ACGTNacgtn]+\.|\.[ACGTNacgtn]+)"
)


class InvalidVcfError(ValueError):
    """The input failed one of this summary reader's structural checks."""

    def __init__(self, line_number: int, reason: str) -> None:
        self.line_number = line_number
        super().__init__(f"Invalid VCF at line {line_number}: {reason}")


@dataclass(frozen=True)
class VcfSummary:
    """Mutually exclusive record counts; total_variants = snps + indels + other."""

    total_variants: int = 0
    snps: int = 0
    indels: int = 0
    other: int = 0


def _allele_type(ref: str, alt: str) -> str:
    if any(base not in "ACGT" for base in ref + alt):
        return "other"
    if len(ref) == len(alt) == 1:
        return "snp"
    if len(ref) == len(alt):
        return "other"

    # Trim by indices so long alleles do not incur repeated string copies.
    start = 0
    while start < min(len(ref), len(alt)) and ref[start] == alt[start]:
        start += 1
    ref_end, alt_end = len(ref), len(alt)
    while ref_end > start and alt_end > start and ref[ref_end - 1] == alt[alt_end - 1]:
        ref_end -= 1
        alt_end -= 1
    return "indel" if (start == ref_end) != (start == alt_end) else "other"


def _alternates(ref: str, value: str, line_number: int) -> list[str]:
    """Validate ALT notation and normalize sequence case, preserving symbolic IDs."""
    if value == ".":
        return []
    alternates = []
    for alt in value.split(","):
        if _SEQUENCE.fullmatch(alt):
            alt = alt.upper()
        elif alt != "*" and not (_SYMBOLIC.fullmatch(alt) or _BREAKEND.fullmatch(alt)):
            raise InvalidVcfError(line_number, "invalid ALT notation")
        alternates.append(alt)
    if ref in alternates or len(set(alternates)) != len(alternates):
        raise InvalidVcfError(line_number, "ALT equals REF or contains duplicate alleles")
    return alternates


def summarize_vcf(path: str | PathLike[str]) -> VcfSummary:
    """Read a local file once, returning counts only after the entire file succeeds.

    A header-only VCF returns zero counts; an empty or headerless file is invalid.
    No quality, FILTER, or genotype selection is applied. For compressed VCF or
    BCF, the caller must first supply an uncompressed VCF file.
    """
    total = snps = indels = other = 0
    column_count = None
    line_number = 0
    with open(path, encoding="utf-8") as stream:
        for line_number, raw in enumerate(stream, start=1):
            line = raw.removesuffix("\n").removesuffix("\r")
            if line_number == 1:
                if not re.fullmatch(r"##fileformat=VCFv4\.[0-9]+", line):
                    raise InvalidVcfError(line_number, "expected VCFv4.x fileformat line first")
                continue
            if line.startswith("##"):
                if column_count is not None or line.startswith("##fileformat="):
                    raise InvalidVcfError(line_number, "misplaced or duplicate metadata")
                continue
            if line.startswith("#"):
                columns = line.split("\t")
                if column_count is not None or tuple(columns[:8]) != _COLUMNS:
                    raise InvalidVcfError(line_number, "invalid or duplicate #CHROM header")
                if len(columns) > 8 and (
                    len(columns) < 10 or columns[8] != "FORMAT"
                    or any(not name or any(c.isspace() for c in name) for name in columns[9:])
                    or len(set(columns[9:])) != len(columns[9:])
                ):
                    raise InvalidVcfError(line_number, "expected FORMAT and unique sample names")
                column_count = len(columns)
                continue
            if column_count is None:
                raise InvalidVcfError(line_number, "missing #CHROM header")
            fields = line.split("\t")
            if len(fields) != column_count or any(not field for field in fields):
                raise InvalidVcfError(line_number, "wrong column count or empty field")
            chrom, pos, _, ref, alt = fields[:5]
            if chrom == "." or any(c.isspace() for c in chrom):
                raise InvalidVcfError(line_number, "invalid CHROM")
            if not re.fullmatch(r"[0-9]+", pos):
                raise InvalidVcfError(line_number, "POS must be a non-negative decimal integer")
            if not _SEQUENCE.fullmatch(ref):
                raise InvalidVcfError(line_number, "REF must contain only A/C/G/T/N")
            ref = ref.upper()
            alternates = _alternates(ref, alt, line_number)
            if not alternates:
                continue
            total += 1
            categories = {_allele_type(ref, allele) for allele in alternates}
            if categories == {"snp"}:
                snps += 1
            elif categories == {"indel"}:
                indels += 1
            else:
                other += 1
    if column_count is None:
        raise InvalidVcfError(line_number + 1, "missing #CHROM header")
    return VcfSummary(total_variants=total, snps=snps, indels=indels, other=other)
