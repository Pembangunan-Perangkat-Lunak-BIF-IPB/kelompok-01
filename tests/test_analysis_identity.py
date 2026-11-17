from uuid import uuid4
import pytest
from pydantic import ValidationError
from sqlalchemy import select
from app.models import Job
from app.schemas.job import JobCreateRequest
from app.services import jobs, downloads
from test_results import case, headers

@pytest.mark.parametrize("name", ["x"*81, "bad\r\nname", "bad\x00name", "name\u202e"])
def test_rejects_unsafe_names(m8_case, name):
    with pytest.raises(ValidationError):
        JobCreateRequest.model_validate({**m8_case.request.model_dump(), "analysis_name": name})

def test_names_numbers_replay_and_failed_sequence(m8_case):
    c=m8_case
    request=JobCreateRequest.model_validate({**c.request.model_dump(), "analysis_name":"  Sampel Bawang A  "})
    one=jobs.create_job(c.factory,c.settings,1,request)
    assert (one.analysis_number,one.analysis_name)==(1,"Sampel Bawang A")
    assert jobs.create_job(c.factory,c.settings,1,request).id_job==one.id_job
    with pytest.raises(jobs.JobConflict):
        jobs.create_job(c.factory,c.settings,1,request.model_copy(update={"analysis_name":"Different"}))
    with c.factory.begin() as db: db.get(Job,one.id_job).status="Failed"
    two=jobs.create_job(c.factory,c.settings,1,request.model_copy(update={"request_id":str(uuid4())}))
    other=jobs.create_job(c.factory,c.settings,2,c.request.model_copy(update={"id_sample":2,"request_id":str(uuid4())}))
    assert two.analysis_number==2 and two.analysis_name==one.analysis_name
    assert (other.analysis_number,other.analysis_name)==(1,"Analisis 1")

def test_legacy_missing_name_preserves_serialized_request_and_replays(m8_case):
    c=m8_case
    assert "analysis_name" not in c.request.model_dump()
    one=jobs.create_job(c.factory,c.settings,1,c.request)
    with c.factory() as db:
        assert "analysis_name" not in db.get(Job,one.id_job).parameter_pipeline["request"]
    assert jobs.create_job(c.factory,c.settings,1,c.request).id_job==one.id_job
    assert JobCreateRequest.model_validate({**c.request.model_dump(),"analysis_name":"   "}).model_dump()==c.request.model_dump()

@pytest.mark.parametrize("name", ["Sampel Bawang A", "同じ名前", '../x\r\n;bad', "x"*80, 'CON <script>" test'])
def test_download_filename_safe_and_server_metadata(case,name):
    with case.factory.begin() as db: db.get(Job,case.identifier).analysis_name=name
    for suffix in ("vcf","csv"):
        response=case.client.get(f"/jobs/{case.identifier}/{suffix}",headers=headers(case))
        assert response.status_code==200
        header=response.headers["content-disposition"]
        assert "GenoPath_Analisis-1_" in header and len(header)<180
        assert "\r" not in header and "\n" not in header and "/" not in header and "\\" not in header
        assert ("filtered.csv" if suffix=="csv" else "selected.vcf") in header
