"""Local demo runtime. Secrets/artifacts live only in ignored .runtime/.

No credentials on the command line. No changes to existing databases.
"""
import argparse
import getpass
import json
import os
from pathlib import Path
import re
import secrets

from pydantic import SecretStr
from sqlalchemy import create_engine, text

from app.core.config import Settings

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / ".runtime"


def private_write(path, data):
    temporary = path.with_suffix(".new")
    fd = os.open(temporary, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(fd, "w") as target:
        json.dump(data, target)
    os.replace(temporary, path)


def configuration():
    data = json.loads((RUNTIME / "private.json").read_text())
    return Settings(
        _env_file=None, database_url=SecretStr(data["database_url"]), jwt_secret=SecretStr(data["jwt_secret"]),
        upload_root=RUNTIME / "samples", upload_max_bytes=10 * 1024**2,
        reference_root=RUNTIME / "fixture", pipeline_root=RUNTIME / "jobs",
        pipeline_enabled=True, pipeline_allow_synthetic=False, pipeline_threads=2,
        pipeline_max_active_jobs=1,
        pipeline_timeout_seconds=600, pipeline_alignment_strategy="bowtie2",
        pipeline_alignment_adapter=ROOT / "app/services/bowtie2_adapter.py",
        pipeline_bowtie2_index_prefix=RUNTIME / "fixture/fixture",
        **{"pipeline_" + name + "_executable": RUNTIME / "bin" / executable for name, executable in [
            ("bowtie2", "bowtie2"), ("bowtie2_inspect", "bowtie2-inspect"), ("nextflow", "nextflow"),
            ("fastp", "fastp"), ("samtools", "samtools"), ("bcftools", "bcftools"),
        ]},
    )


def verified_engine():
    settings = configuration()
    data = json.loads((RUNTIME / "private.json").read_text())
    if not re.fullmatch(r"genopath_demo_20261110_[a-f0-9]{6}", data["database_name"]):
        raise RuntimeError("Demo database identity is invalid.")
    engine = create_engine(settings.database_url.get_secret_value())
    with engine.connect() as conn:
        identity = conn.execute(text("select current_database(), current_user")).one()
        if tuple(identity) != (data["database_name"], data["database_role"]):
            raise RuntimeError("Refusing mutation: database/role identity differs.")
    return engine


def migrate():
    from alembic import command
    from alembic.config import Config
    engine = verified_engine()
    engine.dispose()
    os.environ["DATABASE_URL"] = configuration().database_url.get_secret_value()
    command.upgrade(Config(str(ROOT / "alembic.ini")), "head")
    print("Demo database migration complete; credentials hidden.")


def reference():
    from sqlalchemy.orm import Session
    from sqlalchemy import select
    from app.models import ReferenceGenome
    from app.services.bowtie2_adapter import validate_reference
    settings = configuration()
    validate_reference(settings.reference_root / "reference.fa", settings.pipeline_bowtie2_index_prefix,
                       settings.pipeline_bowtie2_inspect_executable, RUNTIME / "tmp")
    engine = verified_engine()
    with Session(engine) as db, db.begin():
        row = db.scalar(select(ReferenceGenome).where(ReferenceGenome.path_fasta == "reference.fa"))
        if row is None:
            row = ReferenceGenome(nama_genom="Fixture sintetis 20 kbp - BUKAN Garlic.V2",
                                  versi="seed-20261104", sumber="genopath:synthetic-fixture", path_fasta="reference.fa")
            db.add(row)
            db.flush()
        print("Verified synthetic reference/index; catalog ID:", row.id_reference_genome)
    engine.dispose()


def verify():
    """Additional live checks, restricted to the isolated synthetic demo DB."""
    from uuid import uuid4
    from sqlalchemy import func, select
    from sqlalchemy.orm import sessionmaker
    from app.models import Analysis, Job, ReferenceGenome, User
    from app.schemas.job import JobCreateRequest
    from app.schemas.result import VariantFilters
    from app.services import downloads, jobs, results
    import csv
    import io

    settings, engine = configuration(), verified_engine()
    factory = sessionmaker(engine, expire_on_commit=False)
    with factory() as db:
        previous = db.scalar(select(Job).where(Job.status == "Completed").order_by(Job.id_job.desc()))
        if previous is None or db.get(ReferenceGenome, previous.id_reference_genome).sumber != "genopath:synthetic-fixture":
            raise RuntimeError("A completed synthetic fixture Job is required.")
        owner = previous.id_user
        username = db.get(User, owner).username
        request = JobCreateRequest.model_validate(previous.parameter_pipeline["request"])
        other = db.scalar(select(Job).where(Job.status == "Completed", Job.id_user != owner))
        if other is None:
            raise RuntimeError("A different fixture owner is required.")
        other_owner = other.id_user
        other_request = JobCreateRequest.model_validate(other.parameter_pipeline["request"])

    empty_request = request.model_copy(update={"request_id": str(uuid4()), "parameter_qual": 999.0})
    empty = jobs.create_job(factory, settings, owner, empty_request)
    assert jobs.create_job(factory, settings, owner, empty_request).id_job == empty.id_job
    try:
        jobs.create_job(factory, settings, other_owner, other_request.model_copy(update={"request_id": str(uuid4())}))
        raise AssertionError("Global capacity did not reject a different owner.")
    except jobs.JobConflict as error:
        assert "capacity" in str(error)
    assert jobs.run_job(factory, settings, empty.id_job) == "completed"
    assert results.summary(factory, empty.id_job, owner).counts.total_variants == 0
    stream, size = downloads.selected_vcf(factory, settings, empty.id_job, owner)
    with stream:
        assert not any(not line.startswith(b"#") for line in stream)
    chunks, close = downloads.csv_export(factory, empty.id_job, owner, VariantFilters())
    try:
        assert list(csv.DictReader(io.StringIO(b"".join(chunks).decode()))) == []
    finally:
        close()
    print("PASS PostgreSQL global capacity/replay and real QUAL 999 -> Completed, zero variants, valid empty exports")

    # Intentionally mismatch a tiny reference with the existing tiny index.
    # Keep the failed run and reference as evidence, outside the active catalog.
    negative_name = "negative_" + uuid4().hex + ".fa"
    bad_fasta = settings.reference_root / negative_name
    source = (settings.reference_root / "reference.fa").read_text()
    first_base = source.index("\n") + 1
    replacement = "C" if source[first_base] != "C" else "A"
    bad_fasta.write_text(source[:first_base] + replacement + source[first_base + 1:])
    with factory.begin() as db:
        reference = ReferenceGenome(nama_genom="NEGATIVE TEST: reference/index mismatch (unavailable)",
                                    versi="controlled-negative", sumber="genopath:negative-test", path_fasta=negative_name)
        db.add(reference)
        db.flush()
        bad_reference_id = reference.id_reference_genome
    try:
        bad = jobs.create_job(factory, settings, owner, request.model_copy(update={
            "request_id": str(uuid4()), "id_reference_genome": bad_reference_id,
        }))
        assert jobs.run_job(factory, settings, bad.id_job) == "failed"
        failed = jobs.get_job(factory, bad.id_job, owner)
        assert failed.status == "Failed" and failed.pesan_error == "Workflow execution failed."
        with factory() as db:
            assert db.scalar(select(func.count()).select_from(Analysis).where(Analysis.id_job == bad.id_job)) == 0
            failed_run = settings.pipeline_root / db.get(Job, bad.id_job).parameter_pipeline["run_id"]
        assert (failed_run / ".nextflow.log").is_file()
    finally:
        retained = RUNTIME / "negative-evidence"
        retained.mkdir(exist_ok=True)
        bad_fasta.rename(retained / negative_name)
    print("PASS actual Nextflow reference/index mismatch -> Failed; no Analysis or fake variants")
    private_write(RUNTIME / "evidence/additional-runtime.json", {
        "global_capacity_postgresql": "PASS", "same_uuid_queued_replay": "PASS",
        "empty_qual_999_job": empty.id_job, "failed_reference_mismatch_job": bad.id_job,
        "failed_error": failed.pesan_error, "negative_reference_retained": True,
        "input_kind": "controlled synthetic fixture", "biological_validation": False,
    })
    browser_config = json.loads((RUNTIME / "browser-private.json").read_text())
    browser_config["latest_username"] = username
    private_write(RUNTIME / "browser-private.json", browser_config)
    engine.dispose()


def set_gate_password():
    import sys
    from app.core.security import hash_password
    if not sys.stdin.isatty():
        print("Gunakan terminal interaktif agar input password tetap tersamar.")
        raise RuntimeError("Interactive terminal required.")
    first = getpass.getpass("Password khusus demo (minimal 12 karakter, tidak ditampilkan): ")
    second = getpass.getpass("Ulangi password: ")
    if first != second or not first.strip() or not 12 <= len(first) <= 128:
        raise RuntimeError("Password berbeda atau terlalu pendek; konfigurasi tidak diubah.")
    private_write(RUNTIME / "gate.json", {
        "password_hash": hash_password(first), "session_secret": secrets.token_urlsafe(48),
        "purpose": "approved_demo", "secure_cookie": True,
    })
    import httpx
    try:
        page = httpx.get("http://localhost:3000/")
        csrf = re.search('name="csrf" value="([^"]+)"', page.text).group(1)
        result = httpx.post("http://localhost:3000/_demo/unlock",
                            data={"csrf": csrf, "demo_password": first, "next": "/"},
                            headers={"Cookie": "genopath_demo_csrf=" + csrf, "Origin": "http://localhost:3000"},
                            follow_redirects=False)
        if result.status_code != 303:
            raise RuntimeError
        # Keep only the legitimately issued session for automated HTTPS checks,
        # never the raw password. This private file is ignored by Git.
        session_cookie = result.cookies.get("genopath_demo_access")
        if not session_cookie:
            raise RuntimeError
        private_write(RUNTIME / "gate-check-session.json", {
            "cookie": session_cookie, "revision": result.headers.get("x-demo-gate-revision"),
            "obtained_by": "password verification on loopback",
        })
        print("Password final tersimpan sebagai hash dan login gate lokal PASS. Tidak perlu restart web/tunnel.")
    except Exception:
        print("Hash password final tersimpan privat; uji gate perlu diulang saat web lokal aktif.")


def tunnel():
    import hashlib
    import httpx
    import subprocess
    config = json.loads((RUNTIME / "gate.json").read_text())
    if config.get("purpose") != "approved_demo" or config.get("secure_cookie") is not True:
        raise RuntimeError("Final demo password has not been set.")
    expected = hashlib.sha256(config["session_secret"].encode()).hexdigest()[:16]
    response = httpx.get("http://127.0.0.1:3000/api/jobs")
    if response.status_code != 401 or response.headers.get("x-demo-gate-revision") != expected:
        raise RuntimeError("Public gate preflight failed.")
    binary = ROOT / ".tools/cloudflared"
    release = json.loads((ROOT / ".tools/cloudflared-release.json").read_text())
    if hashlib.sha256(binary.read_bytes()).hexdigest() != release["sha256"].split(":")[1]:
        raise RuntimeError("cloudflared integrity check failed.")
    # Invoke only after the user separately approves public activation.
    subprocess.run([str(binary), "tunnel", "--no-autoupdate", "--url", "http://127.0.0.1:3000",
                    "--protocol", "http2"], env={"HOME": str(RUNTIME / "home"), "PATH": os.defpath}, check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["migrate", "reference", "verify", "api", "web", "password", "tunnel"])
    args = parser.parse_args()
    if args.action == "migrate": return migrate()
    if args.action == "reference": return reference()
    if args.action == "verify": return verify()
    if args.action == "password": return set_gate_password()
    if args.action == "tunnel": return tunnel()
    import uvicorn
    from app.main import create_app
    settings = configuration()
    engine = verified_engine()
    engine.dispose()
    application = create_app(settings)
    port = 8000
    if args.action == "web":
        from app.demo import demo_app
        from app.api.routes.jobs import Owner
        from fastapi import HTTPException
        from fastapi.responses import FileResponse

        @application.get("/demo/reads.fastq.gz", include_in_schema=False)
        def demo_fixture(owner: Owner):
            fixture = settings.reference_root / "reads.fastq.gz"
            if not fixture.is_file() or fixture.resolve() != fixture.absolute() or fixture.stat().st_size > settings.upload_max_bytes:
                raise HTTPException(404, "Demo fixture unavailable.")
            return FileResponse(fixture, media_type="application/gzip", filename="genopath_synthetic_SE.fastq.gz",
                                headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"})

        application = demo_app(application, ROOT / "frontend/dist", json.loads((RUNTIME / "gate.json").read_text()),
                               config_path=RUNTIME / "gate.json")
        port = 3000
    (RUNTIME / ("api.pid" if port == 8000 else "web.pid")).write_text(str(os.getpid()))
    uvicorn.run(application, host="127.0.0.1", port=port, access_log=False, log_level="warning")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # Database exceptions may embed credentials or connection parameters.
        print("Demo runtime failed:", type(error).__name__, "(details suppressed; inspect configuration locally)")
        raise SystemExit(1) from None
