from uuid import uuid4

from fastapi.testclient import TestClient
import pytest
from sqlalchemy import func, select

from app.core.config import Settings
from app.core.security import create_access_token
from app.database import get_session_factory
from app.models import Job, Sample


@pytest.fixture
def client(m8_case, app_factory):
    app = app_factory(m8_case.settings)
    app.dependency_overrides[get_session_factory] = lambda: m8_case.factory
    with TestClient(app) as client:
        yield client


def headers(case, owner=1):
    return {"Authorization": "Bearer " + create_access_token(owner, case.settings)}


def payload(case, **changes):
    return {**case.request.model_dump(mode="json"), **changes}


def test_upload_then_explicit_job_trigger_is_a_real_execution_path(client, m8_case):
    c = m8_case
    uploaded = client.post("/samples/upload", headers=headers(c), files={
        "file": ("synthetic.fastq", b"@r\nACGT\n+\n!!!!\n", "application/octet-stream"),
    })
    assert uploaded.status_code == 201
    assert "id_job" not in uploaded.json()
    with c.factory() as db:
        assert db.scalar(select(func.count()).select_from(Job)) == 0
        assert db.get(Sample, uploaded.json()["id_sample"]).id_user == 1
    created = client.post("/jobs", headers=headers(c), json=payload(c, id_sample=uploaded.json()["id_sample"]))
    assert created.status_code == 201 and created.json()["status"] == "Queued"
    identifier = created.json()["id_job"]
    started = client.post(f"/jobs/{identifier}/start", headers=headers(c))
    assert started.status_code == 202 and started.json()["status"] == "Queued"
    status = client.get(f"/jobs/{identifier}", headers=headers(c))
    assert status.status_code == 200 and status.json()["status"] == "Completed"
    assert status.json()["has_result"] is True
    assert client.post(f"/jobs/{identifier}/start", headers=headers(c)).status_code == 409


def test_job_endpoints_require_authentication(client, m8_case):
    assert client.post("/jobs", json=payload(m8_case)).status_code == 401
    assert client.get("/jobs/1").status_code == 401
    assert client.post("/jobs/1/start").status_code == 401
    assert client.post("/jobs/1/retry").status_code == 401


def test_other_user_cannot_poll_start_or_retry(client, m8_case):
    c = m8_case
    identifier = client.post("/jobs", headers=headers(c), json=payload(c)).json()["id_job"]
    for method, path in [("GET", f"/jobs/{identifier}"), ("POST", f"/jobs/{identifier}/start"),
                         ("POST", f"/jobs/{identifier}/retry")]:
        assert client.request(method, path, headers=headers(c, 2)).status_code == 404


@pytest.mark.parametrize("updates", [
    {"id_sample": 0}, {"id_sample": 2**31}, {"id_reference_genome": 2**31},
    {"parameter_qual": -1}, {"parameter_dp": -1},
    {"request_id": "not-a-uuid"}, {"variant_ploidy": 0}, {"vcf_sample": "unsafe;command"},
    {"execution_mode": "bowtie2"}, {"paired_end": True}, {"command": "arbitrary"},
])
def test_invalid_or_out_of_scope_parameters_are_rejected(client, m8_case, updates):
    assert client.post("/jobs", headers=headers(m8_case), json=payload(m8_case, **updates)).status_code == 422


def test_missing_reference_never_creates_job_or_damages_uploaded_sample(client, m8_case):
    c = m8_case
    assert client.post("/jobs", headers=headers(c), json=payload(c, id_reference_genome=999)).status_code == 422
    with c.factory() as db:
        assert db.scalar(select(func.count()).select_from(Job)) == 0
        assert db.get(Sample, 1) is not None


def test_nextflow_gating_is_explicit_and_status_is_safe(client, m8_case):
    response = client.post("/jobs", headers=headers(m8_case), json=payload(m8_case, execution_mode="nextflow"))
    assert response.status_code == 503
    assert str(m8_case.tmp) not in response.text


def test_api_idempotency_and_openapi_contract(client, m8_case):
    c = m8_case
    first = client.post("/jobs", headers=headers(c), json=payload(c))
    repeated = client.post("/jobs", headers=headers(c), json=payload(c))
    assert first.json()["id_job"] == repeated.json()["id_job"]
    schema = client.get("/openapi.json").json()
    assert schema["paths"]["/jobs"]["post"]["security"] == [{"HTTPBearer": []}]
    properties = schema["components"]["schemas"]["JobCreateRequest"]
    assert properties["additionalProperties"] is False
    assert {"id_reference_genome", "variant_ploidy", "request_id", "parameter_qual", "parameter_dp"} <= set(properties["required"])


def test_execution_defaults_remain_disabled():
    settings = Settings(_env_file=None)
    assert settings.pipeline_enabled is False and settings.pipeline_allow_synthetic is False


@pytest.mark.parametrize("identifier", [0, -1, 2**31])
def test_invalid_job_id_is_rejected_before_query(client, m8_case, identifier):
    assert client.get(f"/jobs/{identifier}", headers=headers(m8_case)).status_code == 422
