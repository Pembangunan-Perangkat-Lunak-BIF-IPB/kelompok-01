"""Gate covers pages/assets and every API route; no actual server/database."""
import json
import re

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest
from app.core.security import hash_password
from app.demo import COOKIE, DemoGate, demo_app
from app.models import Job
from app.services import jobs
from uuid import uuid4


@pytest.fixture
def gate(tmp_path):
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("<h1>Protected GenoPath SPA</h1>")
    (dist / "asset.js").write_text("/* protected script */")
    api = FastAPI()
    @api.api_route("/{path:path}", methods=["GET", "POST"])
    def protected(path: str):
        return {"protected_api": path}
    config = {"password_hash": hash_password("local-test-password-only"), "session_secret": "k" * 48}
    return TestClient(demo_app(api, dist, config), base_url="https://demo.test")


def unlock(client, password="local-test-password-only", **changes):
    page = client.get("/jobs/17/result")
    csrf = re.search('name="csrf" value="([^"]+)"', page.text).group(1)
    return client.post("/_demo/unlock", data={"demo_password": password, "csrf": csrf, "next": "/jobs/17/result", **changes},
                       follow_redirects=False)


@pytest.mark.parametrize("path", ["/", "/jobs/17/result", "/asset.js", "/api/auth/login", "/api/auth/register",
                                 "/api/samples/upload-and-run", "/api/jobs/17/start", "/api/jobs/17/csv", "/api/jobs/17/vcf"])
def test_gate_denies_pages_assets_and_direct_api_without_password(gate, path):
    response = gate.post(path) if path.startswith("/api/auth") or path.endswith("/start") else gate.get(path)
    assert response.status_code == 401
    assert "Protected GenoPath" not in response.text
    assert "protected_api" not in response.text


def test_wrong_password_then_correct_password_and_cookie_properties(gate):
    assert unlock(gate, "wrong-password").status_code == 401
    response = unlock(gate)
    assert response.status_code == 303
    cookie = response.headers.get_list("set-cookie")[0]
    assert "HttpOnly" in cookie and "Secure" in cookie and "SameSite=lax" in cookie
    assert "local-test-password" not in cookie
    assert response.headers["location"] == "/jobs/17/result"
    assert gate.get("/jobs/17/result").status_code == 200
    assert gate.get("/asset.js").status_code == 200
    assert gate.post("/api/auth/login").json() == {"protected_api": "auth/login"}


def test_tampered_cookie_and_csrf_are_rejected(gate):
    assert gate.post("/_demo/unlock", data={"demo_password": "local-test-password-only", "csrf": "invented"}).status_code == 403
    gate.cookies.set(COOKIE, "access.1.forged.signature")
    assert gate.get("/api/jobs/1/result").status_code == 401


def test_browser_favicon_request_does_not_invalidate_visible_password_form(gate):
    form = gate.get("/login")
    csrf = re.search('name="csrf" value="([^"]+)"', form.text).group(1)
    gate.get("/favicon.ico")
    assert gate.post("/_demo/unlock", data={"demo_password": "local-test-password-only", "csrf": csrf},
                     follow_redirects=False).status_code == 303


def test_wrong_password_is_rate_limited_and_never_logged(gate, capsys):
    for _ in range(6):
        assert unlock(gate, "private-wrong-password-marker").status_code == 401
    response = unlock(gate)
    assert response.status_code == 429
    assert response.headers["retry-after"] == "60"
    captured = capsys.readouterr()
    assert "private-wrong-password-marker" not in captured.out + captured.err + response.text


def test_redirect_cannot_leave_origin(gate):
    assert unlock(gate, next="//attacker.invalid").headers["location"] == "/"


def test_authenticated_spa_cannot_read_files_outside_dist_or_follow_symlinks(gate, tmp_path):
    (tmp_path / "private.json").write_text("private-file-outside-spa")
    (tmp_path / "dist/escape.json").symlink_to(tmp_path / "private.json")
    assert unlock(gate).status_code == 303
    for path in ("/escape.json", "/%2e%2e/private.json", "/.runtime/private.json"):
        response = gate.get(path)
        assert "private-file-outside-spa" not in response.text
        assert "Protected GenoPath SPA" in response.text


def test_signed_sessions_expire_and_password_configuration_is_required():
    gate = DemoGate(None, hash_password("local-test-password-only"), "s" * 48, clock=lambda: 100)
    token = gate.token("access")
    assert gate.valid(token, "access", 60)
    gate.clock = lambda: 161
    assert not gate.valid(token, "access", 60)
    with pytest.raises(ValueError):
        DemoGate(None, "", "")


def test_private_password_rotation_invalidates_old_sessions_and_fails_closed(gate, tmp_path):
    app = gate.app
    middleware = app.user_middleware[0]
    original = dict(middleware.kwargs)
    config_path = tmp_path / "gate.json"
    config = {key: original[key] for key in ("password_hash", "session_secret", "secure_cookie")}
    config_path.write_text(json.dumps(config))
    middleware.kwargs["config_path"] = config_path
    with TestClient(app, base_url="https://demo.test") as client:
        assert unlock(client).status_code == 303
        assert client.get("/api/jobs").status_code == 200
        config.update(password_hash=hash_password("rotated-test-password-only"), session_secret="r" * 48)
        config_path.write_text(json.dumps(config))
        assert client.get("/api/jobs").status_code == 401
        assert unlock(client).status_code == 401
        assert unlock(client, "rotated-test-password-only").status_code == 303
        assert client.get("/api/jobs").status_code == 200
        config_path.write_text("{}")
        assert client.get("/api/jobs").status_code == 503


def test_demo_global_capacity_blocks_other_owner_but_allows_idempotent_replay(m8_case):
    case = m8_case
    case.settings.pipeline_max_active_jobs = 1
    original = jobs.create_job(case.factory, case.settings, 1, case.request)
    assert jobs.create_job(case.factory, case.settings, 1, case.request).id_job == original.id_job
    other = case.request.model_copy(update={"id_sample": 2, "request_id": str(uuid4())})
    with pytest.raises(jobs.JobConflict, match="capacity"):
        jobs.create_job(case.factory, case.settings, 2, other)
    with case.factory.begin() as db:
        db.get(Job, original.id_job).status = "Failed"
    assert jobs.create_job(case.factory, case.settings, 2, other).status == "Queued"
