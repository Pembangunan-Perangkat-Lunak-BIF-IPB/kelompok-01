"""Single-origin gate protects the built SPA and the mounted API."""
import json
import re

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.security import hash_password
from app.demo_runtime import create_demo_app


def private_config(path, password="private-test-gate-password"):
    path.write_text(json.dumps({
        "password_hash": hash_password(password),
        "session_secret": "s" * 64,
        "purpose": "approved_demo",
        "secure_cookie": True,
    }))
    path.chmod(0o600)
    return password


def test_gate_wraps_spa_assets_and_api_with_one_origin(tmp_path):
    config_path = tmp_path / "gate.json"
    password = private_config(config_path)
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("<h1>GenoPath SPA</h1>")
    (dist / "assets.js").write_text("window.loaded = true")
    api = FastAPI()

    @api.get("/health")
    def health():
        return {"status": "ok"}

    application = create_demo_app(
        settings=Settings(_env_file=None), api=api, dist=dist, config_path=config_path,
    )
    with TestClient(application, base_url="https://demo.test") as client:
        page = client.get("/jobs/17/result")
        assert page.status_code == 401
        assert "Akses demonstrasi terbatas" in page.text
        assert client.get("/assets.js").status_code == 401
        assert client.get("/api/health").status_code == 401

        csrf = re.search('name="csrf" value="([^"]+)"', page.text).group(1)
        unlocked = client.post("/_demo/unlock", data={
            "demo_password": password, "csrf": csrf, "next": "/jobs/17/result",
        }, headers={"Origin": "https://demo.test"}, follow_redirects=False)
        assert unlocked.status_code == 303
        session_cookie = unlocked.headers.get_list("set-cookie")[0]
        assert "HttpOnly" in session_cookie and "Secure" in session_cookie and "SameSite=lax" in session_cookie
        assert client.get("/jobs/17/result").status_code == 200
        assert "window.loaded = true" in client.get("/assets.js").text
        assert client.get("/api/health").json() == {"status": "ok"}


def test_demo_gate_config_must_be_private_and_regular(tmp_path):
    from app.demo import read_demo_gate_config

    config_path = tmp_path / "gate.json"
    private_config(config_path)
    config_path.chmod(0o644)
    try:
        read_demo_gate_config(config_path)
        raise AssertionError("World-readable gate file was accepted")
    except ValueError as error:
        assert "unavailable" in str(error)

    config_path.unlink()
    target = tmp_path / "real.json"
    private_config(target)
    config_path.symlink_to(target)
    try:
        read_demo_gate_config(config_path)
        raise AssertionError("Symlink gate file was accepted")
    except ValueError as error:
        assert "unavailable" in str(error)
