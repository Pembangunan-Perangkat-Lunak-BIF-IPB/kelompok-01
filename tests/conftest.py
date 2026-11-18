import pytest

from app.core.config import Settings


@pytest.fixture
def app_factory(monkeypatch):
    monkeypatch.setattr(Settings, "model_config", {**Settings.model_config, "env_file": None})
    monkeypatch.delenv("DATABASE_URL", raising=False)

    from app.main import create_app

    return create_app


@pytest.fixture
def m8_case(tmp_path, monkeypatch):
    """SQLite in-memory only, with synthetic private files; never PostgreSQL."""
    import os
    import secrets
    from types import SimpleNamespace
    from uuid import uuid4
    from pydantic import SecretStr
    from sqlalchemy import create_engine, event
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.pool import StaticPool
    from app.database import Base
    from app.models import ReferenceGenome, Sample, User
    from app.schemas.job import JobCreateRequest
    from datetime import datetime

    monkeypatch.setattr(Settings, "model_config", {**Settings.model_config, "env_file": None})
    for name in tuple(os.environ):
        if name == "DATABASE_URL" or name.startswith(("GENOPATH_", "PG")):
            monkeypatch.delenv(name)
    engine = create_engine("sqlite+pysqlite:///:memory:", poolclass=StaticPool,
                           connect_args={"check_same_thread": False})
    event.listen(engine, "connect", lambda connection, _: connection.execute("PRAGMA foreign_keys=ON"))
    Base.metadata.create_all(engine)
    factory = sessionmaker(engine, expire_on_commit=False, autoflush=False)
    uploads, references = tmp_path / "uploads", tmp_path / "references"
    uploads.mkdir()
    references.mkdir()
    for key in ("one.fastq", "two.fastq"):
        (uploads / key).write_text("@synthetic\nACGT\n+\n!!!!\n")
    (references / "tiny.fa").write_text(">synthetic_chr\nACGTACGT\n")
    with factory.begin() as db:
        db.add_all([
            User(id_user=i, username=f"synthetic_{i}", nama="Synthetic", email=f"u{i}@example.invalid",
                 password_hash="unused-test-hash", role="user") for i in (1, 2)
        ])
        db.add(ReferenceGenome(id_reference_genome=1, nama_genom="Synthetic fixture, not an approved genome",
                               path_fasta="tiny.fa", versi="fixture"))
        db.add_all([Sample(id_sample=i, id_user=i, nama_berkas=k, path_penyimpanan=k,
                           ukuran_berkas=25, waktu_unggah=datetime.now())
                    for i, k in [(1, "one.fastq"), (2, "two.fastq")]])
    settings = Settings(_env_file=None, database_url=None, jwt_secret=SecretStr(secrets.token_urlsafe(48)),
                        upload_root=uploads, reference_root=references, pipeline_root=tmp_path / "jobs",
                        pipeline_enabled=True, pipeline_allow_synthetic=True, pipeline_timeout_seconds=10)
    request = JobCreateRequest(id_sample=1, id_reference_genome=1, request_id=str(uuid4()),
                               vcf_sample="fixture_sample", parameter_qual=30.0, parameter_dp=10,
                               execution_mode="synthetic", variant_ploidy=2)
    yield SimpleNamespace(factory=factory, settings=settings, request=request, tmp=tmp_path, engine=engine)
    engine.dispose()
