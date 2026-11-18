"""Install verified, existing E. coli benchmark assets under reference_root.

This does not download/build assets or modify the database. Alembic revision
0006 registers the corresponding ReferenceGenome row.
"""

import argparse
import hashlib
import json
from pathlib import Path
import shutil
import sys


REPOSITORY = Path(__file__).resolve().parents[1]
SOURCE = REPOSITORY / "build/biological-benchmark/ecoli-k12-mg1655"
ASSET_SUBDIR = "ecoli-k12-mg1655"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reference-root", type=Path, default=Path("data/reference"))
    args = parser.parse_args()
    manifest = json.loads((SOURCE / "manifest.json").read_text(encoding="utf-8"))
    assets = [manifest["reference"]["fasta_file"], manifest["reads"]["fastq_file_original"]]
    assets.extend(item["path"] for item in manifest["index"]["files"])
    expected = {
        manifest["reference"]["fasta_file"]: manifest["reference"]["fasta_sha256"],
        manifest["reads"]["fastq_file_original"]: manifest["reads"]["fastq_sha256_original"],
    }
    expected.update({item["path"]: item["sha256"] for item in manifest["index"]["files"]})

    destination_root = args.reference_root.expanduser().absolute()
    destinations = {}
    for relative in assets:
        source = SOURCE / relative
        target = destination_root / ASSET_SUBDIR / relative
        if source.is_symlink() or not source.is_file() or sha256(source) != expected[relative]:
            raise SystemExit(f"Source asset failed manifest verification: {relative}")
        if target.is_symlink():
            raise SystemExit(f"Refusing symlink destination: {target}")
        if target.exists() and (not target.is_file() or sha256(target) != expected[relative]):
            raise SystemExit(f"Refusing to overwrite a different asset: {target}")
        destinations[relative] = (source, target)

    for relative, (source, target) in destinations.items():
        if not target.exists():
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
        if sha256(target) != expected[relative]:
            raise SystemExit(f"Installed asset checksum mismatch: {target}")

    print(f"Installed {len(assets)} verified assets under {destination_root / ASSET_SUBDIR}")
    print(f"Reference: {destination_root / ASSET_SUBDIR / manifest['reference']['fasta_file']}")
    print(f"FASTQ: {destination_root / ASSET_SUBDIR / manifest['reads']['fastq_file_original']}")
    print(f"Bowtie2 index prefix: {destination_root / ASSET_SUBDIR / manifest['index']['index_prefix']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
