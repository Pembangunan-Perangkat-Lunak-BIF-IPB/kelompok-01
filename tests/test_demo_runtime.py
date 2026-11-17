"""Masked setup and private session storage; no network/database/tunnel."""
import json
from types import SimpleNamespace
import sys

import httpx
import pytest
from app.core.security import verify_password
from scripts import demo_runtime as runtime


def test_password_setup_keeps_only_hash_and_issued_session_privately(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(runtime, "RUNTIME", tmp_path)
    monkeypatch.setattr(sys, "stdin", SimpleNamespace(isatty=lambda: True))
    monkeypatch.setattr(runtime.getpass, "getpass", lambda _: "masked-test-password-only")
    monkeypatch.setattr(httpx, "get", lambda _: SimpleNamespace(text='<input name="csrf" value="test-csrf">'))
    monkeypatch.setattr(httpx, "post", lambda *args, **kwargs: SimpleNamespace(
        status_code=303, cookies={"genopath_demo_access": "issued-private-test-session"},
        headers={"x-demo-gate-revision": "test-revision"}))
    runtime.set_gate_password()
    gate = json.loads((tmp_path / "gate.json").read_text())
    assert gate["purpose"] == "approved_demo" and gate["secure_cookie"] is True
    assert verify_password("masked-test-password-only", gate["password_hash"])
    assert (tmp_path / "gate.json").stat().st_mode & 0o777 == 0o600
    session = tmp_path / "gate-check-session.json"
    assert session.stat().st_mode & 0o777 == 0o600
    assert json.loads(session.read_text())["cookie"] == "issued-private-test-session"
    output = capsys.readouterr()
    assert "masked-test-password-only" not in output.out + output.err
    assert "issued-private-test-session" not in output.out + output.err
    assert all("masked-test-password-only" not in path.read_text() for path in tmp_path.iterdir())


def test_password_setup_refuses_noninteractive_input_before_prompt(tmp_path, monkeypatch):
    monkeypatch.setattr(runtime, "RUNTIME", tmp_path)
    monkeypatch.setattr(sys, "stdin", SimpleNamespace(isatty=lambda: False))
    with pytest.raises(RuntimeError, match="Interactive"):
        runtime.set_gate_password()
    assert list(tmp_path.iterdir()) == []


def test_public_launcher_refuses_temporary_validation_password(tmp_path, monkeypatch):
    monkeypatch.setattr(runtime, "RUNTIME", tmp_path)
    (tmp_path / "gate.json").write_text(json.dumps({"purpose": "local_validation_only", "secure_cookie": True}))
    with pytest.raises(RuntimeError, match="Final demo password"):
        runtime.tunnel()
