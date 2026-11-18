"""HTTP and plan contracts for the fixed biological demo assets."""

import gzip
import hashlib
from pathlib import Path

from sqlalchemy import select

from app.api.routes.samples import download_demo_fastq
from app.core.config import Settings
from app.main import create_app
from app.models import Job, ReferenceGenome
from app.services import jobs


def test_demo_download_openapi_declares_bearer_and_gzip_attachment():
    operation = create_app(Settings(_env_file=None)).openapi()["paths"]["/samples/demo-fastq"]["get"]
    assert operation["security"] == [{"HTTPBearer": []}]
    assert "application/gzip" in operation["responses"]["200"]["content"]


def test_demo_download_returns_fixed_attachment_and_exact_asset(m8_case):
    case = m8_case
    reads = case.settings.reference_root / "ecoli-k12-mg1655/reads/SRR522156.fastq.gz"
    reads.parent.mkdir(parents=True)
    body = gzip.compress(b"@real-record-name\nACGT\n+\nIIII\n", mtime=0)
    reads.write_bytes(body)

    response = download_demo_fastq(1, case.settings)
    assert Path(response.path) == reads.resolve()
    assert response.media_type == "application/gzip"
    assert response.headers["content-disposition"] == 'attachment; filename="ecoli-k12-mg1655-demo.fastq.gz"'
    assert response.headers["cache-control"] == "private, no-store"
    assert hashlib.sha256(Path(response.path).read_bytes()).hexdigest() == hashlib.sha256(body).hexdigest()

    reads.unlink()
    reads.parent.rmdir()
    reads.parent.parent.rmdir()


def test_options_include_demo_metadata_and_hide_runtime_paths(m8_case):
    case = m8_case
    directory = case.settings.reference_root / "ecoli-k12-mg1655"
    fasta = directory / "reference/NC_000913.3.fna"
    fasta.parent.mkdir(parents=True)
    fasta.write_text(">NC_000913.3 Escherichia coli str. K-12 substr. MG1655\nACGT\n")
    with case.factory.begin() as db:
        db.add(ReferenceGenome(
            id_reference_genome=7,
            nama_genom="Escherichia coli K-12 MG1655",
            versi="NC_000913.3 / GCF_000005845.2 ASM584v2",
            sumber="NCBI RefSeq; demo dataset SRR522156",
            path_fasta="ecoli-k12-mg1655/reference/NC_000913.3.fna",
            accession="NC_000913.3", strain="K-12 MG1655", is_demo=True,
            path_bowtie2_index="ecoli-k12-mg1655/index/NC_000913.3",
        ))
    result = jobs.analysis_options(case.factory, case.settings)
    row = next(item.model_dump() for item in result.references if item.id_reference_genome == 7)
    assert row == {
        "id_reference_genome": 7,
        "nama_genom": "Escherichia coli K-12 MG1655",
        "versi": "NC_000913.3 / GCF_000005845.2 ASM584v2",
        "sumber": "NCBI RefSeq; demo dataset SRR522156",
        "accession": "NC_000913.3",
        "strain": "K-12 MG1655",
        "is_demo": True,
    }
    assert "path_fasta" not in row and "path_bowtie2_index" not in row


def test_job_plan_uses_selected_reference_specific_index(m8_case):
    case = m8_case
    root = case.settings.reference_root / "ecoli-k12-mg1655"
    fasta = root / "reference/NC_000913.3.fna"
    fasta.parent.mkdir(parents=True)
    fasta.write_text(">NC_000913.3\nACGT\n")
    selected_prefix = root / "index/NC_000913.3"
    selected_prefix.parent.mkdir(parents=True)
    for suffix in ("1", "2", "3", "4", "rev.1", "rev.2"):
        Path(f"{selected_prefix}.{suffix}.bt2").write_bytes(b"non-empty test index file")
    global_prefix = case.settings.reference_root / "legacy-index"
    for suffix in ("1", "2", "3", "4", "rev.1", "rev.2"):
        Path(f"{global_prefix}.{suffix}.bt2").write_bytes(b"legacy configured test index")
    with case.factory.begin() as db:
        db.add(ReferenceGenome(
            id_reference_genome=7,
            nama_genom="Escherichia coli K-12 MG1655",
            path_fasta="ecoli-k12-mg1655/reference/NC_000913.3.fna",
            accession="NC_000913.3", strain="K-12 MG1655", is_demo=True,
            path_bowtie2_index="ecoli-k12-mg1655/index/NC_000913.3",
        ))
    settings = case.settings.model_copy(update={
        "pipeline_alignment_strategy": "bowtie2",
        "pipeline_bowtie2_index_prefix": global_prefix,
        "pipeline_alignment_adapter": Path("/bin/true"),
        "pipeline_bowtie2_executable": Path("/bin/true"),
        "pipeline_bowtie2_inspect_executable": Path("/bin/true"),
        "pipeline_nextflow_executable": Path("/bin/true"),
        "pipeline_fastp_executable": Path("/bin/true"),
        "pipeline_samtools_executable": Path("/bin/true"),
        "pipeline_bcftools_executable": Path("/bin/true"),
    })
    request = case.request.model_copy(update={"id_reference_genome": 7, "execution_mode": "nextflow"})
    with case.factory() as db:
        plan = jobs.build_plan(db, settings, 1, request)
    assert plan.reference == fasta.resolve()
    assert plan.bowtie2_index_prefix == selected_prefix
    assert plan.bowtie2_index_prefix != global_prefix
    queued = jobs.create_job(case.factory, settings, 1, request)
    with case.factory() as db:
        stored = db.scalar(select(Job).where(Job.id_job == queued.id_job))
        assert stored.id_reference_genome == 7
        assert stored.parameter_pipeline["request"]["id_reference_genome"] == 7
        assert stored.parameter_pipeline["reference"] == str(fasta.resolve())
        assert stored.parameter_pipeline["bowtie2_index_prefix"] == str(selected_prefix)
