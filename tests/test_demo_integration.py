"""Checkpoint B HTTP contracts; SQLite and private temporary files only."""

from uuid import uuid4

from fastapi.testclient import TestClient
from app.core.security import create_access_token
from app.database import get_session_factory
from app.models import Job, ReferenceGenome
from app.services import jobs


def make_client(case, app_factory):
    app = app_factory(case.settings)
    app.dependency_overrides[get_session_factory] = lambda: case.factory
    return TestClient(app)


def auth(case, owner=1):
    return {"Authorization": "Bearer " + create_access_token(owner, case.settings)}


def test_job_list_is_authenticated_owned_and_newest_first(m8_case, app_factory):
    case = m8_case
    first = jobs.create_job(case.factory, case.settings, 1, case.request)
    with case.factory.begin() as db:
        db.get(Job, first.id_job).status = "Failed"
    newer = jobs.create_job(case.factory, case.settings, 1, case.request.model_copy(update={"request_id": str(uuid4())}))
    other = case.request.model_copy(update={"id_sample": 2, "request_id": str(uuid4())})
    second = jobs.create_job(case.factory, case.settings, 2, other)
    with make_client(case, app_factory) as client:
        assert client.get("/jobs").status_code == 401
        response = client.get("/jobs", headers=auth(case))
        assert response.status_code == 200
        assert [row["id_job"] for row in response.json()] == [newer.id_job, first.id_job]
        assert response.headers["Cache-Control"] == "private, no-store"
        assert response.json()[0]["status"] == "Queued"
        assert response.json()[0]["execution_mode"] == "synthetic"
        assert response.json()[0]["waktu_mulai"] is None
        assert client.get(f"/jobs/{second.id_job}", headers=auth(case)).status_code == 404
        assert [row["id_job"] for row in client.get("/jobs", headers=auth(case, 2)).json()] == [second.id_job]


def test_options_never_expose_paths_or_missing_reference(m8_case, app_factory):
    case = m8_case
    with case.factory.begin() as db:
        db.add(ReferenceGenome(nama_genom="Unavailable", path_fasta="/not-a-public-reference.fa"))
    with make_client(case, app_factory) as client:
        assert client.get("/jobs/options").status_code == 401
        response = client.get("/jobs/options", headers=auth(case))
        assert response.status_code == 200
        data = response.json()
        assert data["variant_ploidies"] == [1, 2]
        assert data["upload_max_bytes"] == case.settings.upload_max_bytes
        assert [row["id_reference_genome"] for row in data["references"]] == [1]
        assert set(data["references"][0]) == {"id_reference_genome", "nama_genom", "versi", "sumber"}
        assert str(case.tmp) not in response.text
        assert "path_fasta" not in response.text
        assert "not-a-public-reference" not in response.text


def test_disabled_options_are_honest_without_opening_pipeline(m8_case, app_factory):
    case = m8_case
    case.settings.pipeline_enabled = False
    with make_client(case, app_factory) as client:
        response = client.get("/jobs/options", headers=auth(case))
        assert response.status_code == 200
        assert response.json()["pipeline_enabled"] is False
        assert client.get("/jobs", headers=auth(case)).json() == []


def test_invalid_auth_requests_do_not_log_credentials(m8_case, app_factory, capsys):
    with make_client(m8_case, app_factory) as client:
        response = client.post("/auth/login", json={"username": "test", "password": "private-test-marker", "extra": 1})
        assert response.status_code == 422
        output = capsys.readouterr()
        assert "private-test-marker" not in output.out + output.err + response.text
