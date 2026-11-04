"""Synthetic M8 smoke runner, guarded to an explicitly created isolated cluster.

This script never reads .env/passfiles. Connection metadata comes from the
non-secret manifest written when creating the new cluster; every connection
verifies database name, cluster directory, and ownership marker before use.
It never creates, drops, or migrates any existing user database.
"""

import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import io
import json
import os
from pathlib import Path
import threading
from uuid import uuid4

import psycopg
from sqlalchemy import create_engine, event, func, inspect, select, text
from sqlalchemy.orm import sessionmaker

from app.core.config import Settings
from app.database import Base
from app.models import Analysis, Genotype, Job, ReferenceGenome, Sample, User, Variant
from app.schemas.job import JobCreateRequest
from app.services import jobs
from app.services.pipeline import LocalExecutor, PipelineResult


TARGET = "genopath_speedrun_20261103"


def connect_checked(manifest, *, autocommit=False):
    if (manifest.get("database") != TARGET or manifest.get("isolated_cluster") is not True
            or manifest.get("database_previously_existed") is not False
            or manifest.get("host") != "127.0.0.1"):
        raise RuntimeError("Disposable ownership manifest refused")
    if any(name.startswith("PG") for name in os.environ):
        raise RuntimeError("PG environment overrides are refused for disposable testing")
    connection = psycopg.connect(
        dbname=TARGET, host="127.0.0.1", port=int(manifest["port"]), user="postgres",
        passfile=str(Path(manifest["data_directory"]).parent / "unused-passfile"),
        connect_timeout=5, sslmode="disable", autocommit=autocommit,
        options="-c search_path=public -c statement_timeout=10000 -c lock_timeout=5000",
    )
    with connection.cursor() as cursor:
        cursor.execute("SELECT current_database(), current_setting('data_directory'), "
                       "shobj_description((SELECT oid FROM pg_database WHERE datname=current_database()), 'pg_database')")
        database, directory, marker = cursor.fetchone()
    if (database != TARGET or Path(directory).resolve() != Path(manifest["data_directory"]).resolve()
            or marker != "genopath-isolated:" + manifest["nonce"]):
        connection.close()
        raise RuntimeError("Disposable connection isolation check failed")
    if not autocommit:
        connection.rollback()
    return connection


def migrate_pristine_or_verify(manifest):
    from alembic import command
    from alembic.config import Config

    connection = connect_checked(manifest, autocommit=True)
    try:
        present = connection.execute("SELECT to_regclass('public.alembic_version')").fetchone()[0]
        if present is None:
            tables = connection.execute("SELECT tablename FROM pg_tables WHERE schemaname='public'").fetchall()
            if tables:
                raise RuntimeError("Refusing migration of non-pristine unversioned database")
            root = Path(__file__).resolve().parents[1]
            configuration = Config(str(root / "alembic.ini"))
            configuration.output_buffer = io.StringIO()
            # This harness validates M8, even when later feature branches add revisions.
            command.upgrade(configuration, "0003_m8_pipeline", sql=True)
            connection.execute(configuration.output_buffer.getvalue())
        revision = connection.execute("SELECT version_num FROM public.alembic_version").fetchone()[0]
        if revision != "0003_m8_pipeline":
            raise RuntimeError("Unexpected disposable schema revision")
        return revision
    finally:
        connection.close()


class FixtureExecutor:
    def __init__(self, content):
        self.content = content

    def execute(self, plan):
        plan.outdir.mkdir(parents=True)
        output = plan.outdir / "result.vcf"
        output.write_text(self.content)
        return PipelineResult(output, {"synthetic": True, "fixture": "explicit VCF"})


def main(manifest_path: Path, evidence: Path):
    Settings.model_config = {**Settings.model_config, "env_file": None}
    manifest = json.loads(manifest_path.read_text())
    revision = migrate_pristine_or_verify(manifest)
    engine = create_engine("postgresql+psycopg://", creator=lambda: connect_checked(manifest),
                           hide_parameters=True, echo=False)
    factory = sessionmaker(engine, expire_on_commit=False, autoflush=False)
    inspector = inspect(engine)
    assert set(inspector.get_table_names()) == {*Base.metadata.tables, "alembic_version"}
    for name, table in Base.metadata.tables.items():
        assert set(table.columns.keys()) == {column["name"] for column in inspector.get_columns(name)}
    storage = manifest_path.parent / "fixtures" / uuid4().hex
    uploads, references = storage / "uploads", storage / "references"
    uploads.mkdir(parents=True)
    references.mkdir()
    (uploads / "synthetic.fastq").write_text("@r\nACGT\n+\n!!!!\n")
    (references / "tiny.fa").write_text(">synthetic_chr\nACGTACGT\n")
    suffix = uuid4().hex[:12]
    with factory.begin() as db:
        user = User(username="m8_" + suffix, nama="Synthetic fixture", email=suffix + "@example.invalid",
                    password_hash="unused synthetic fixture; no login", role="user")
        other = User(username="other_" + suffix, nama="Synthetic fixture", email="other_" + suffix + "@example.invalid",
                     password_hash="unused synthetic fixture; no login", role="user")
        reference = ReferenceGenome(nama_genom="SYNTHETIC, not an approved genome", path_fasta="tiny.fa", versi="fixture")
        db.add_all([user, other, reference])
        db.flush()
        sample = Sample(id_user=user.id_user, nama_berkas="synthetic.fastq", path_penyimpanan="synthetic.fastq",
                        ukuran_berkas=15, waktu_unggah=datetime.now(timezone.utc).replace(tzinfo=None))
        db.add(sample)
        db.flush()
        owner, outsider, sample_id, reference_id = user.id_user, other.id_user, sample.id_sample, reference.id_reference_genome
    settings = Settings(_env_file=None, database_url=None, upload_root=uploads, reference_root=references,
                        pipeline_root=storage / "runs", pipeline_enabled=True, pipeline_allow_synthetic=True,
                        pipeline_timeout_seconds=5)

    def request():
        return JobCreateRequest(id_sample=sample_id, id_reference_genome=reference_id, request_id=str(uuid4()),
                                vcf_sample="synthetic_sample", parameter_qual=30.0, parameter_dp=10,
                                execution_mode="synthetic", variant_ploidy=2)

    def counts(identifier):
        with factory() as db:
            analysis = db.scalar(select(Analysis).where(Analysis.id_job == identifier))
            if analysis is None:
                return (0, 0, 0)
            variants = db.scalar(select(func.count()).select_from(Variant).where(Variant.id_analysis == analysis.id_analysis))
            genotypes = db.scalar(select(func.count()).select_from(Genotype).join(Variant).where(Variant.id_analysis == analysis.id_analysis))
            return (1, variants, genotypes)

    cases, trace = {}, []
    submitted = request()
    normal = jobs.create_job(factory, settings, owner, submitted)
    trace.append(normal.model_dump(mode="json"))

    class ObserveRunning:
        def execute(self, plan):
            trace.append(jobs.get_job(factory, normal.id_job, owner).model_dump(mode="json"))
            return LocalExecutor().execute(plan)

    assert jobs.run_job(factory, settings, normal.id_job, ObserveRunning()) == "completed"
    trace.append(jobs.get_job(factory, normal.id_job, owner).model_dump(mode="json"))
    assert [x["status"] for x in trace] == ["Queued", "Running", "Completed"]
    assert counts(normal.id_job) == (1, 3, 3)
    cases["native_synthetic_process_and_atomic_result"] = True
    assert jobs.create_job(factory, settings, owner, submitted).id_job == normal.id_job
    assert jobs.run_job(factory, settings, normal.id_job) == "not_claimed"
    assert counts(normal.id_job) == (1, 3, 3)
    cases["submission_and_execution_replay_do_not_duplicate"] = True
    try:
        jobs.get_job(factory, normal.id_job, outsider)
    except jobs.JobNotFound:
        cases["ownership_enforced"] = True
    assert cases.get("ownership_enforced")

    header = "##fileformat=VCFv4.2\n#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tsynthetic_sample\n"
    row = "synthetic_chr\t1\t.\tA\tC,G\t60\tPASS\tDP=999;FLAG\tGT:DP\t1|2:20\n"
    bad = jobs.create_job(factory, settings, owner, request())
    assert jobs.run_job(factory, settings, bad.id_job, FixtureExecutor(header + row * 205 + row.replace(":20", ":bad"))) == "failed"
    assert counts(bad.id_job) == (0, 0, 0)
    cases["late_parse_error_rolls_back_flushed_rows"] = True

    invalid = jobs.create_job(factory, settings, owner, request())

    def invalid_fk(mapper, connection, genotype):
        genotype.id_sample = 2**31 - 1

    event.listen(Genotype, "before_insert", invalid_fk)
    try:
        assert jobs.run_job(factory, settings, invalid.id_job, FixtureExecutor(header + row)) == "failed"
    finally:
        event.remove(Genotype, "before_insert", invalid_fk)
    assert counts(invalid.id_job) == (0, 0, 0)
    cases["real_postgresql_fk_error_rolls_back_all_results"] = True
    retry = jobs.retry_job(factory, settings, invalid.id_job, owner)
    assert retry.id_job != invalid.id_job and jobs.run_job(factory, settings, retry.id_job) == "completed"
    cases["explicit_retry_uses_new_job"] = True

    def submit_competing(_):
        try:
            return jobs.create_job(factory, settings, owner, request()).id_job
        except jobs.JobConflict:
            return None

    with ThreadPoolExecutor(max_workers=2) as pool:
        competing = list(pool.map(submit_competing, range(2)))
    assert sum(x is not None for x in competing) == 1
    cases["concurrent_creation_enforces_one_active_job"] = True
    competing_id = next(x for x in competing if x is not None)
    entered, release = threading.Event(), threading.Event()
    calls = []

    class BlockingExecutor:
        def execute(self, plan):
            calls.append(True)
            entered.set()
            if not release.wait(5):
                raise RuntimeError("Synthetic synchronization timeout")
            return FixtureExecutor(header + row).execute(plan)

    with ThreadPoolExecutor(max_workers=2) as pool:
        first = pool.submit(jobs.run_job, factory, settings, competing_id, BlockingExecutor())
        assert entered.wait(5)
        second = pool.submit(jobs.run_job, factory, settings, competing_id, BlockingExecutor())
        assert second.result(timeout=5) == "not_claimed"
        release.set()
        assert first.result(timeout=5) == "completed"
    assert len(calls) == 1 and counts(competing_id) == (1, 1, 1)
    cases["concurrent_workers_claim_job_once"] = True
    with factory() as db:
        records = db.execute(select(Variant.chromosome, Variant.position, Variant.ref_allele,
                                    Variant.alt_allele, Variant.qual, Variant.variant_type,
                                    Variant.filter_status, Variant.info, Genotype.genotype_call, Genotype.dp)
                             .join(Genotype).join(Analysis).where(Analysis.id_job == normal.id_job)
                             .order_by(Variant.id_variant)).mappings().all()
        version = db.scalar(text("SHOW server_version"))
    evidence.mkdir(parents=True, exist_ok=True)
    report = {
        "captured_at": datetime.now(timezone.utc).isoformat(), "database": TARGET,
        "postgresql_version": version, "postgresql_real": True, "isolated_cluster": True,
        "database_previously_existed": False, "alembic_revision": revision,
        "existing_databases_modified": False, "biological_alignment_verified": False,
        "nextflow_execution_verified": False, "executor": "Actual Python subprocess, SYNTHETIC VCF",
        "cases_passed": cases, "lifecycle": trace, "persisted_records": [dict(x) for x in records],
        "normal_job_id": normal.id_job, "fixture_owner": owner,
        "runtime_settings": {"upload_root": str(uploads), "reference_root": str(references),
                             "pipeline_root": str(settings.pipeline_root)},
    }
    with (evidence / "postgresql-synthetic.json").open("x", encoding="utf-8") as output:
        json.dump(report, output, indent=2)
        output.write("\n")
    engine.dispose()
    print(json.dumps({"postgresql_real": True, "cases_passed": len(cases), "lifecycle": [x["status"] for x in trace]}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--evidence-dir", required=True, type=Path)
    options = parser.parse_args()
    main(options.manifest, options.evidence_dir)
