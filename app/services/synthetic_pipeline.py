"""Explicit synthetic executor fixture. No alignment, calling, or biological claim."""

from pathlib import Path
import re
import sys


def main():
    output, label, ploidy_text = sys.argv[1:]
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,63}", label):
        raise ValueError("Invalid synthetic sample label")
    ploidy = int(ploidy_text)
    if not 1 <= ploidy <= 16:
        raise ValueError("Invalid synthetic ploidy")
    gt = "/".join(["0"] * (ploidy - 1) + ["1"])
    content = ("##fileformat=VCFv4.2\n##source=GENOPATH_SYNTHETIC_NO_ALIGNMENT\n"
               "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\t" + label + "\n")
    for pos, ref, alt in [(1, "A", "C"), (2, "A", "AT"), (3, "A", "C,AT")]:
        content += f"synthetic_chr\t{pos}\t.\t{ref}\t{alt}\t60\tPASS\tDP=999\tGT:DP\t{gt}:25\n"
    with Path(output).open("x", encoding="utf-8") as stream:
        stream.write(content)


if __name__ == "__main__":
    main()
