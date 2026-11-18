"""Opt-in live PostgreSQL QA, NEW isolated schemas inside the verified demo DB."""
import os
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
from uuid import uuid4
import runpy
import pytest
from sqlalchemy import text, create_engine, select
from sqlalchemy.orm import sessionmaker
from alembic.migration import MigrationContext
from alembic.operations import Operations
from app.database import Base
from app.models import Job, User, Sample, ReferenceGenome
from app.schemas.job import JobCreateRequest
from app.services import jobs
from scripts.demo_runtime import ROOT, RUNTIME, configuration, verified_engine

pytestmark = pytest.mark.skipif(os.getenv("GENOPATH_IDENTITY_POSTGRES_QA") != "1", reason="Explicit isolated PostgreSQL QA only")

def test_concurrent_allocation_and_legacy_backfill():
    engine=verified_engine()
    schema="identity_qa_"+uuid4().hex
    backfill=schema+"_old"
    with engine.begin() as conn:
        conn.execute(text(f'CREATE SCHEMA "{schema}"'))
        conn.execute(text(f'CREATE SCHEMA "{backfill}"'))
        conn.execute(text(f'CREATE TABLE "{backfill}".job (id_job integer PRIMARY KEY, id_user integer NOT NULL)'))
        conn.execute(text(f'INSERT INTO "{backfill}".job VALUES (9,1),(10,1),(11,2),(13,2)'))
        operations=Operations(MigrationContext.configure(conn))
        class Remapped:
            def execute(self, statement):
                return operations.execute(statement.replace("public.", '"'+backfill+'".'))
            def __getattr__(self, name):
                def call(*args, **kwargs):
                    kwargs["schema"]=backfill
                    return getattr(operations,name)(*args,**kwargs)
                return call
        module=runpy.run_path(str(ROOT/"migrations/versions/0005_analysis_identity.py"))
        module["upgrade"].__globals__["op"]=Remapped()
        module["upgrade"]()
        assert conn.execute(text(f'SELECT id_job, analysis_number FROM "{backfill}".job ORDER BY id_job')).all()==[(9,1),(10,2),(11,1),(13,2)]
    qa=engine.execution_options(schema_translate_map={None:schema})
    Base.metadata.create_all(qa)
    factory=sessionmaker(qa,expire_on_commit=False)
    folder=RUNTIME/schema;folder.mkdir()
    (folder/"reads.fastq").write_text("@r\nACGT\n+\nIIII\n")
    (folder/"ref.fa").write_text(">r\nACGT\n")
    from datetime import datetime
    with factory.begin() as db:
        for i in (1,2):
            db.add(User(id_user=i,username=f"qa{i}",nama="QA",email=f"qa{i}@example.invalid",password_hash="unused",role="user"))
        db.add(ReferenceGenome(id_reference_genome=1,nama_genom="QA only",path_fasta="ref.fa"))
        db.flush()
        for i in (1,2):
            db.add(Sample(id_sample=i,id_user=i,nama_berkas="reads.fastq",path_penyimpanan="reads.fastq",ukuran_berkas=15,waktu_unggah=datetime.now()))
    settings=configuration().model_copy(update={"upload_root":folder,"reference_root":folder,"pipeline_root":folder/"jobs","pipeline_allow_synthetic":True,"pipeline_max_active_jobs":None})
    request=JobCreateRequest(id_sample=1,id_reference_genome=1,request_id=str(uuid4()),vcf_sample="fixture",parameter_qual=30.0,parameter_dp=10,execution_mode="synthetic",variant_ploidy=2,analysis_name="Concurrent QA")
    with ThreadPoolExecutor(max_workers=4) as pool:
        replay=list(pool.map(lambda _:jobs.create_job(factory,settings,1,request),range(4)))
    assert len({j.id_job for j in replay})==1 and all(j.analysis_number==1 for j in replay)
    with factory.begin() as db: db.get(Job,replay[0].id_job).status="Failed"
    def attempt(_):
        try: return jobs.create_job(factory,settings,1,request.model_copy(update={"request_id":str(uuid4())}))
        except jobs.JobConflict: return None
    with ThreadPoolExecutor(max_workers=2) as pool: different=list(pool.map(attempt,range(2)))
    assert sum(j is not None for j in different)==1
    assert next(j for j in different if j).analysis_number==2
    second=jobs.create_job(factory,settings,2,request.model_copy(update={"request_id":str(uuid4()),"id_sample":2}))
    assert second.analysis_number==1
    with factory() as db:
        assert [j.analysis_number for j in db.scalars(select(Job).where(Job.id_user==1).order_by(Job.analysis_number))]==[1,2]
    # Retain isolated QA schemas as evidence. Never drop or alter public data here.
    print("PostgreSQL QA schemas retained:",schema,backfill)
    engine.dispose()
