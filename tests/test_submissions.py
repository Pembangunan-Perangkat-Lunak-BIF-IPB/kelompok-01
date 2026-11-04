import json
from pathlib import Path
import subprocess
import sys
from unittest.mock import Mock
from uuid import uuid4

from fastapi.testclient import TestClient
import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import OperationalError

from app.core.security import create_access_token
from app.database import get_session_factory
from app.models import Analysis, Job, Sample, Variant
from app.services import jobs, submissions
from app.services.submission_record import SubmissionBusy, SubmissionRecord


FASTQ = b"@read\nACGT\n+\nIIII\n"
PATH = "/samples/upload-and-run"


@pytest.fixture
def case(m8_case, app_factory):
    c = m8_case
    c.app = app_factory(c.settings)
    c.app.dependency_overrides[get_session_factory] = lambda: c.factory
    c.params = {**c.request.model_dump(exclude={"id_sample"}), "alignment_strategy": "synthetic-no-alignment"}
    c.headers = {"Authorization": "Bearer " + create_access_token(1, c.settings)}
    with TestClient(c.app) as client:
        c.client = client
        yield c


def submit(c, data=FASTQ, **changes):
    return c.client.post(PATH, headers=c.headers, params={**c.params, **changes},
                         files={"file": ("reads.fastq", data, "application/octet-stream")})


def count(c, model):
    with c.factory() as db:
        return db.scalar(select(func.count()).select_from(model))


def test_one_submission_uploads_and_dispatches_without_start(case):
    response = submit(case)
    assert response.status_code == 202
    body = response.json()
    assert body["submission_status"] == "accepted" and body["dispatch_scheduled"] is True
    assert body["job"]["status"] == "Queued"
    assert body["sample"]["id_sample"] == body["job"]["id_sample"]
    job_id = body["job"]["id_job"]
    status = case.client.get(f"/jobs/{job_id}", headers=case.headers).json()
    assert status["status"] == "Completed" and status["has_result"]
    assert (count(case, Sample), count(case, Job), count(case, Analysis), count(case, Variant)) == (3, 1, 1, 3)
    assert case.client.get(f"/jobs/{job_id}/result", headers=case.headers).status_code == 200


def test_replay_reuses_sample_job_and_completed_artifact(case):
    first = submit(case).json()
    with case.factory() as db:
        analysis = db.scalar(select(Analysis))
        selected = case.settings.pipeline_root / analysis.path_vcf
        before = selected.read_bytes()
    replay = submit(case)
    assert replay.status_code == 202
    body = replay.json()
    assert body["submission_status"] == "replayed" and body["dispatch_scheduled"] is False
    assert body["job"]["id_job"] == first["job"]["id_job"] and body["job"]["status"] == "Completed"
    assert body["sample"] == first["sample"] and selected.read_bytes() == before
    assert (count(case, Sample), count(case, Job), count(case, Analysis)) == (3, 1, 1)


@pytest.mark.parametrize("change", [{"parameter_dp": 11}, {"vcf_sample": "different"}, {"alignment_strategy": "other"}])
def test_uuid_cannot_change_parameters(case, change):
    submit(case)
    assert submit(case, **change).status_code == 409
    assert count(case, Sample) == 3 and count(case, Job) == 1


def test_uuid_cannot_change_file(case):
    submit(case)
    assert submit(case, data=FASTQ.replace(b"ACGT", b"TGCA")).status_code == 409
    assert count(case, Sample) == 3 and count(case, Job) == 1


@pytest.mark.parametrize("changes", [
    {"id_reference_genome": 999}, {"parameter_qual": -1}, {"parameter_dp": -1},
    {"request_id": "invalid"}, {"vcf_sample": "bad;sample"}, {"variant_ploidy": 0},
    {"alignment_strategy": "bowtie2"}, {"extra": "forbidden"}, {"execution_mode": "unknown"},
])
def test_invalid_configuration_never_persists_sample_or_job(case, changes):
    assert submit(case, **changes).status_code == 422
    assert count(case, Sample) == 2 and count(case, Job) == 0


def test_all_parameters_are_explicit_and_m7_body_stays_file_only(case):
    params = dict(case.params)
    del params["require_pass"]
    assert case.client.post(PATH, headers=case.headers, params=params, files={"file": ("reads.fastq", FASTQ)}).status_code == 422
    schema = case.client.get("/openapi.json").json()
    required = {p["name"] for p in schema["paths"][PATH]["post"]["parameters"] if p.get("required")}
    assert set(case.params) <= required
    assert schema["paths"][PATH]["post"]["security"] == [{"HTTPBearer": []}]
    documented = schema["paths"][PATH]["post"]["responses"]
    assert {"202", "400", "401", "409", "413", "415", "422", "503"} <= set(documented)
    for status in ("409", "503"):
        assert {item["$ref"].rsplit("/", 1)[-1] for item in
                documented[status]["content"]["application/json"]["schema"]["anyOf"]} == {
                    "SubmissionResponse", "ErrorResponse"}
    response = case.client.post("/samples/upload", headers=case.headers, files={"file": ("reads.fastq", FASTQ)})
    assert response.status_code == 201 and "job" not in response.json()
    assert count(case, Job) == 0


@pytest.mark.parametrize("data", [b"invalid", b"@x\nACGT\n+\nI\n"])
def test_invalid_fastq_creates_no_sample_or_job(case, data):
    assert submit(case, data).status_code == 422
    assert count(case, Sample) == 2 and count(case, Job) == 0
    assert submit(case).status_code == 409  # Rejected UUID stays terminal.


def test_unauthenticated_submission_has_no_storage_effect(case):
    r = case.client.post(PATH, params=case.params, files={"file": ("reads.fastq", FASTQ)})
    assert r.status_code == 401
    assert not (case.settings.pipeline_root / ".submissions").exists()
    assert count(case, Sample) == 2 and count(case, Job) == 0


def test_active_job_precedes_upload(case):
    jobs.create_job(case.factory, case.settings, 1, case.request)
    assert submit(case, request_id=str(uuid4())).status_code == 409
    assert count(case, Sample) == 2 and count(case, Job) == 1


def test_missing_gate_creates_nothing(case):
    case.settings.pipeline_enabled = False
    assert submit(case).status_code == 503
    assert count(case, Sample) == 2 and count(case, Job) == 0


def test_job_failure_retains_sample_and_safe_retry_uses_it(case, monkeypatch):
    original = jobs.create_job
    monkeypatch.setattr(jobs, "create_job", Mock(side_effect=jobs.JobConflict("active race")))
    partial = submit(case)
    assert partial.status_code == 409
    body = partial.json()
    assert body["submission_status"] == "sample_stored" and body["job"] is None
    assert not body["dispatch_scheduled"] and count(case, Sample) == 3
    monkeypatch.setattr(jobs, "create_job", original)
    retry = submit(case)
    assert retry.status_code == 202 and retry.json()["sample"] == body["sample"]
    assert count(case, Sample) == 3 and count(case, Job) == 1


def test_pending_replay_never_switches_to_a_different_aligner(case, monkeypatch):
    original = jobs.create_job
    case.settings.pipeline_alignment_strategy = "bowtie2"
    for name in ("alignment_adapter", "nextflow_executable", "fastp_executable",
                 "samtools_executable", "bcftools_executable"):
        setattr(case.settings, "pipeline_" + name, Path("/bin/true"))
    monkeypatch.setattr(jobs, "create_job", Mock(side_effect=jobs.JobConflict("active race")))
    assert submit(case, execution_mode="nextflow", alignment_strategy="bowtie2").status_code == 409
    monkeypatch.setattr(jobs, "create_job", original)
    case.settings.pipeline_alignment_strategy = "different-operator-strategy"
    assert submit(case, execution_mode="nextflow", alignment_strategy="bowtie2").status_code == 422
    assert count(case, Sample) == 3 and count(case, Job) == 0


def test_ambiguous_upload_commit_blocks_blind_repeat(case, monkeypatch):
    original = submissions.persist_upload

    async def ambiguous(*args, **kwargs):
        await original(*args, **kwargs)
        raise OperationalError("private-driver-marker", {}, RuntimeError("unknown commit"))

    monkeypatch.setattr(submissions, "persist_upload", ambiguous)
    first = submit(case)
    assert first.status_code == 503 and first.json()["submission_status"] == "reconciliation_required"
    replay = submit(case)
    assert replay.status_code == 503 and replay.json()["submission_status"] == "reconciliation_required"
    assert count(case, Sample) == 3 and count(case, Job) == 0
    assert "private-driver-marker" not in replay.text


def test_queued_replay_can_recover_dispatch_and_claim_only_once(case, monkeypatch):
    original = jobs.run_job
    monkeypatch.setattr(jobs, "run_job", lambda *args: "dispatch_interrupted")
    first = submit(case).json()
    assert count(case, Analysis) == 0
    monkeypatch.setattr(jobs, "run_job", original)
    second = submit(case)
    assert second.status_code == 202 and second.json()["dispatch_scheduled"]
    assert second.json()["job"]["id_job"] == first["job"]["id_job"]
    assert count(case, Analysis) == 1 and count(case, Sample) == 3


def test_receipt_lock_excludes_another_open_and_releases(tmp_path):
    request_id = str(uuid4())
    first = SubmissionRecord(tmp_path, 1, request_id)
    try:
        with pytest.raises(SubmissionBusy):
            SubmissionRecord(tmp_path, 1, request_id)
    finally:
        first.close()
    second = SubmissionRecord(tmp_path, 1, request_id)
    second.close()


def test_receipt_lock_is_shared_across_processes(tmp_path):
    request_id = str(uuid4())
    held = SubmissionRecord(tmp_path, 1, request_id)
    code = """
import sys
from pathlib import Path
sys.path.insert(0,sys.argv[1])
from app.services.submission_record import SubmissionRecord, SubmissionBusy
try:
    SubmissionRecord(Path(sys.argv[2]),1,sys.argv[3])
except SubmissionBusy:
    raise SystemExit(0)
raise SystemExit(1)
"""
    try:
        result = subprocess.run([sys.executable, "-I", "-B", "-c", code,
                                 str(Path(__file__).resolve().parents[1]), str(tmp_path), request_id],
                                env={}, capture_output=True, timeout=15)
        assert result.returncode == 0
    finally:
        held.close()


def test_receipt_write_failure_after_upload_does_not_repeat_commit(case, monkeypatch):
    original = SubmissionRecord.write

    def fail_after_commit(record, data):
        if data["phase"] == "sample_stored":
            raise OSError("controlled receipt write failure")
        return original(record, data)

    monkeypatch.setattr(SubmissionRecord, "write", fail_after_commit)
    assert submit(case).status_code == 503
    monkeypatch.setattr(SubmissionRecord, "write", original)
    replay = submit(case)
    assert replay.status_code == 503 and replay.json()["submission_status"] == "reconciliation_required"
    assert count(case, Sample) == 3 and count(case, Job) == 0


def test_receipt_directory_symlink_is_refused(case, tmp_path):
    outside = tmp_path / "foreign"
    outside.mkdir()
    case.settings.pipeline_root.mkdir()
    (case.settings.pipeline_root / ".submissions").symlink_to(outside, target_is_directory=True)
    assert submit(case).status_code == 503
    assert not list(outside.iterdir()) and count(case, Sample) == 2 and count(case, Job) == 0


@pytest.mark.parametrize("data", ["broken JSON", '{"version":1}', '{"version":2}'])
def test_corrupt_receipt_fails_closed_without_repair(tmp_path, data):
    request_id = str(uuid4())
    record = SubmissionRecord(tmp_path, 1, request_id)
    name = record.name
    record.close()
    path = tmp_path / ".submissions" / name
    path.write_text(data)
    path.chmod(0o600)
    with pytest.raises(ValueError):
        SubmissionRecord(tmp_path, 1, request_id)
    assert path.read_text() == data
