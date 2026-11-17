"""Strict record reader for persistence; legacy summarize_vcf semantics are unchanged.

Each ALT-bearing VCF record remains one Variant (comma-separated ALT is preserved).
Exactly one named VCF sample must match the explicit Job mapping. GT allele indexes
and phase separators are retained, including missing/haploid/polyploid calls.
DP means FORMAT/DP for that sample; INFO/DP is retained but never substituted.
QUAL/DP '.' become None. PASS selection and thresholds belong to ingestion.
"""

from dataclasses import dataclass
import math
from pathlib import Path
import re
from typing import Iterator

from app.services.vcf_summary import InvalidVcfError, _allele_type, _alternates, summarize_vcf


@dataclass(frozen=True)
class VcfRecord:
    chrom: str
    position: int
    ref: str
    alt: str
    qual: float | None
    filters: str
    info: dict[str, str | None]
    genotype: str
    dp: int | None
    variant_type: str
    source_line: str


def _integer(value: str, line: int, label: str) -> int:
    normalized = value.lstrip("0") or "0"
    if (not re.fullmatch(r"[0-9]+", value) or len(normalized) > 10
            or len(normalized) == 10 and normalized > "2147483647"):
        raise InvalidVcfError(line, f"{label} exceeds the supported non-negative integer range")
    return int(normalized)


def read_vcf_records(path: Path, expected_sample: str) -> Iterator[VcfRecord]:
    # Reuse all existing structural checks before yielding any records. Second
    # pass is still streaming; ingestion rolls back on any later semantic error.
    summarize_vcf(path)
    names = None
    with path.open(encoding="utf-8") as stream:
        for number, raw in enumerate(stream, 1):
            line = raw.rstrip("\r\n")
            if line.startswith("##"):
                continue
            if line.startswith("#CHROM"):
                names = tuple(line.split("\t")[9:])
                if names != (expected_sample,):
                    raise InvalidVcfError(number, "VCF sample must exactly match the explicit Job sample mapping")
                continue
            fields = line.split("\t")
            chrom, pos, _, ref, alt, qual_text, filters, info_text = fields[:8]
            if names is None or len(fields) != 10:
                raise InvalidVcfError(number, "one mapped VCF sample is required")
            position = _integer(pos, number, "POS")
            ref = ref.upper()
            alternates = _alternates(ref, alt, number)
            try:
                qual = None if qual_text == "." else float(qual_text)
                if qual is not None and (not math.isfinite(qual) or qual < 0):
                    raise ValueError
            except ValueError:
                raise InvalidVcfError(number, "QUAL must be finite and non-negative or missing") from None
            if filters not in (".", "PASS"):
                labels = filters.split(";")
                if len(set(labels)) != len(labels) or any(
                    not re.fullmatch(r"[^\s;=]+", label) or label in ("PASS", ".") for label in labels
                ):
                    raise InvalidVcfError(number, "invalid FILTER labels")
            info = {}
            if info_text != ".":
                for entry in info_text.split(";"):
                    key, separator, value = entry.partition("=")
                    if (not re.fullmatch(r"[^\s;=]+", key) or key in info
                            or separator and (not value or any(c.isspace() for c in value))):
                        raise InvalidVcfError(number, "invalid or duplicate INFO field")
                    info[key] = value if separator else None
            formats = fields[8].split(":")
            values = fields[9].split(":")
            if (len(formats) != len(set(formats)) or len(values) > len(formats)
                    or "GT" not in formats or any(not re.fullmatch(r"[A-Za-z][A-Za-z0-9_]*", k) for k in formats)):
                raise InvalidVcfError(number, "invalid FORMAT or missing GT")
            sample = dict(zip(formats, values + ["."] * (len(formats) - len(values))))
            gt = sample["GT"]
            if not re.fullmatch(r"(?:\.|[0-9]+)(?:[/|](?:\.|[0-9]+))*", gt):
                raise InvalidVcfError(number, "invalid GT")
            if any(_integer(a, number, "GT") > len(alternates) for a in re.split(r"[/|]", gt) if a != "."):
                raise InvalidVcfError(number, "GT allele index exceeds ALT count")
            depth = sample.get("DP", ".")
            depth_value = None if depth == "." else _integer(depth, number, "FORMAT/DP")
            if not alternates:
                continue
            types = {_allele_type(ref, a) for a in alternates}
            kind = next(iter(types)) if len(types) == 1 else "other"
            yield VcfRecord(chrom, position, ref, ",".join(alternates), qual, filters,
                            info, gt, depth_value, kind, line)
