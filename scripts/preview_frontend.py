"""Loopback-only M11 frontend preview using the unchanged M10 gate and API.

Never starts a database or pipeline runner. No secrets on the command line.
"""
import argparse
import getpass
import json
import os
from pathlib import Path
import re

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse
from starlette.background import BackgroundTask

from app.demo import demo_app

ROOT = Path(__file__).resolve().parents[1]
UPSTREAM = "http://127.0.0.1:3000"
HOP = {"host", "connection", "keep-alive", "transfer-encoding", "upgrade", "proxy-authenticate", "proxy-authorization", "te", "trailer"}


def preview(m10_root: Path):
    gate_path = m10_root / ".runtime/gate.json"
    config = json.loads(gate_path.read_text())
    if config.get("purpose") != "approved_demo" or config.get("secure_cookie") is not True:
        raise RuntimeError("Existing final demo gate is required.")
    api = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

    @api.api_route("/{path:path}", methods=["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
    async def proxy(request: Request, path: str):
        # The destination is fixed, never derived from a user supplied URL.
        target = UPSTREAM + "/api/" + path
        if request.url.query:
            target += "?" + request.url.query
        client = httpx.AsyncClient(timeout=60, follow_redirects=False, trust_env=False)
        try:
            outgoing = client.build_request(request.method, target,
                headers={k: v for k, v in request.headers.items() if k.lower() not in HOP}, content=request.stream())
            response = await client.send(outgoing, stream=True)
        except httpx.HTTPError:
            await client.aclose()
            return JSONResponse({"detail": "Backend M10 belum dapat dijangkau."}, status_code=503)

        async def close():
            await response.aclose()
            await client.aclose()

        return StreamingResponse(response.aiter_raw(), status_code=response.status_code,
            headers={k: v for k, v in response.headers.items() if k.lower() not in HOP}, background=BackgroundTask(close))

    return demo_app(api, ROOT / "frontend/dist", config, config_path=gate_path)


def unlock(port: int):
    """Obtain a genuine gate session after masked user entry; never change the gate."""
    base = f"http://localhost:{port}"
    with httpx.Client(follow_redirects=False, timeout=20, trust_env=False) as client:
        response = client.get(base + "/login")
        match = re.search(r'name="csrf" value="([^"]+)"', response.text)
        if response.status_code != 401 or not match:
            raise RuntimeError("Gate form is unavailable.")
        csrf = match.group(1)
        password = getpass.getpass("Password demo existing (tersamar, tidak diubah): ")
        response = client.post(base + "/_demo/unlock", data={"csrf": csrf, "demo_password": password, "next": "/"},
            headers={"Origin": base, "Cookie": "genopath_demo_csrf=" + csrf})
        password = ""
        cookie = response.cookies.get("genopath_demo_access")
        if response.status_code != 303 or not cookie:
            raise RuntimeError("Gate rejected the password; configuration unchanged.")
        check = client.get(base + "/login", headers={"Cookie": "genopath_demo_access=" + cookie})
        if check.status_code != 200:
            raise RuntimeError("Issued session could not be verified.")
        target = ROOT / ".runtime/browser-gate-session.json"
        target.parent.mkdir(exist_ok=True, mode=0o700)
        fd = os.open(target, os.O_CREAT | os.O_TRUNC | os.O_WRONLY, 0o600)
        with os.fdopen(fd, "w") as output:
            json.dump({"cookie": cookie, "issued_by": "masked user verification", "port": port}, output)
        print("Gate M11 PASS. Sesi pengujian tersimpan privat; password/config M10 tidak diubah.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--m10-root", type=Path, default=ROOT.parent / "genopath-demo-20261110")
    parser.add_argument("--port", type=int, default=3001)
    parser.add_argument("--unlock", action="store_true")
    args = parser.parse_args()
    if args.unlock:
        if not __import__("sys").stdin.isatty():
            raise RuntimeError("Masked interactive terminal required.")
        unlock(args.port)
    else:
        import uvicorn
        uvicorn.run(preview(args.m10_root.resolve(strict=True)), host="127.0.0.1", port=args.port, access_log=False, log_level="warning")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("Preview:", type(error).__name__, "(detail sensitif tidak dicetak)")
        raise SystemExit(1) from None
