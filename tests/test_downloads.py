"""Download contracts on isolated SQLite/temporary VCFs; no production database."""
import csv
import io
from pathlib import Path

import pytest
from sqlalchemy import delete, select
from app.models import Analysis, Genotype, Job, Variant
from test_results import case, headers  # Reuse the owned, persisted synthetic VCF fixture.


def download(case, suffix, **query):
    return case.client.get(f"/jobs/{case.identifier}/{suffix}", headers=headers(case), params=query)


def artifact(case):
    with case.factory() as db:
        analysis = db.scalar(select(Analysis).where(Analysis.id_job == case.identifier))
        return case.settings.pipeline_root / analysis.path_vcf


def test_selected_vcf_is_original_artifact_with_correct_download_headers(case):
    response = download(case, "vcf")
    assert response.status_code == 200
    assert response.content == artifact(case).read_bytes()
    assert response.headers["content-type"].startswith("text/vcf")
    assert "selected.vcf" in response.headers["content-disposition"]
    assert int(response.headers["content-length"]) == len(response.content)
    assert response.headers["cache-control"] == "private, no-store"
    assert len([line for line in response.text.splitlines() if not line.startswith("#")]) == 4


@pytest.mark.parametrize("suffix", ["vcf", "csv"])
def test_download_requires_jwt_and_ownership(case, suffix):
    path = f"/jobs/{case.identifier}/{suffix}"
    assert case.client.get(path).status_code == 401
    assert case.client.get(path, headers={"Authorization": "Bearer invalid"}).status_code == 401
    assert case.client.get(path, headers=headers(case, 2)).status_code == 404


@pytest.mark.parametrize("status", ["Queued", "Running", "Failed"])
@pytest.mark.parametrize("suffix", ["vcf", "csv"])
def test_unfinished_job_cannot_download(case, status, suffix):
    with case.factory.begin() as db:
        db.get(Job, case.identifier).status = status
    assert download(case, suffix).status_code == 409


@pytest.mark.parametrize("damage", ["missing", "empty", "invalid", "invalid-record", "wrong-count",
                                   "file-symlink", "run-symlink", "root-symlink", "metadata-path", "wrong-run"])
def test_vcf_refuses_missing_invalid_or_unsafe_artifacts(case, damage):
    path = artifact(case)
    if damage == "missing":
        path.unlink()
    elif damage == "empty":
        path.write_bytes(b"")
    elif damage == "invalid":
        path.write_bytes(b"not a VCF")
    elif damage == "invalid-record":
        path.write_text(path.read_text() + "malformed\n")
    elif damage == "wrong-count":
        path.write_text("\n".join(line for line in path.read_text().splitlines() if line.startswith("#")) + "\n")
    elif damage == "file-symlink":
        retained = path.with_name("retained.vcf")
        path.rename(retained)
        path.symlink_to(retained)
    elif damage == "run-symlink":
        old = path.parent
        retained = old.with_name("retained")
        old.rename(retained)
        old.symlink_to(retained, target_is_directory=True)
    elif damage == "root-symlink":
        linked = case.tmp / "linked-jobs"
        linked.symlink_to(case.settings.pipeline_root, target_is_directory=True)
        case.settings.pipeline_root = linked
    else:
        with case.factory.begin() as db:
            analysis = db.scalar(select(Analysis).where(Analysis.id_job == case.identifier))
            analysis.path_vcf = "/etc/passwd" if damage == "metadata-path" else "0" * 32 + "/selected.vcf"
    response = download(case, "vcf")
    assert response.status_code == 404
    assert str(case.tmp) not in response.text


def test_vcf_never_uses_a_requested_arbitrary_path(case):
    assert download(case, "vcf", path="/etc/passwd").content == artifact(case).read_bytes()


def test_csv_preserves_multiallelic_original_gt_and_explicit_filter_scope(case):
    response = download(case, "csv")
    assert response.status_code == 200
    rows = list(csv.DictReader(io.StringIO(response.text)))
    assert len(rows) == 4
    mixed = next(row for row in rows if row["ALT"] == "C,AT")
    assert mixed["GT"] == "1|2" and mixed["DP"] == "20"
    assert {row["SAMPLE_ID"] for row in rows} == {"1"}
    filtered = list(csv.DictReader(io.StringIO(download(case, "csv", min_qual=30, max_qual=60).text)))
    assert [row["POS"] for row in filtered] == ["2", "3"]
    assert download(case, "csv", limit=1).status_code == 422


def test_csv_exports_more_than_multiple_frontend_and_server_pages(case):
    with case.factory.begin() as db:
        analysis = db.scalar(select(Analysis).where(Analysis.id_job == case.identifier))
        for position in range(1000, 1505):
            db.add(Variant(id_analysis=analysis.id_analysis, chromosome="batch", position=position,
                           ref_allele="A", alt_allele="C", qual=None, variant_type="snp"))
    rows = list(csv.DictReader(io.StringIO(download(case, "csv").text)))
    assert len(rows) == 509
    assert len({(row["CHROM"], row["POS"]) for row in rows}) == 509
    assert rows[-1]["POS"] == "1504"
    assert rows[-1]["GT"] == rows[-1]["DP"] == rows[-1]["QUAL"] == ""


def test_csv_escapes_text_and_prevents_spreadsheet_formula_execution(case):
    with case.factory.begin() as db:
        first = db.scalars(select(Variant).order_by(Variant.id_variant)).first()
        first.chromosome = ' =SUM(1,2)"\ncontig'
        first.qual = None
        db.execute(delete(Genotype).where(Genotype.id_variant == first.id_variant))
    rows = list(csv.DictReader(io.StringIO(download(case, "csv").text)))
    assert rows[0]["CHROM"] == '\' =SUM(1,2)"\ncontig'
    assert rows[0]["GT"] == rows[0]["DP"] == rows[0]["QUAL"] == ""
