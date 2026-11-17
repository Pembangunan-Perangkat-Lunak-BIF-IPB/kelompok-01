"""Temporary server-enforced demo gate around both the SPA and /api."""
import hashlib
import hmac
import html
import ipaddress
import json
from pathlib import Path
import secrets
import time
from urllib.parse import parse_qs

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, RedirectResponse
from starlette.concurrency import run_in_threadpool
from app.core.security import verify_password

COOKIE = "genopath_demo_access"
CSRF_COOKIE = "genopath_demo_csrf"
SESSION_SECONDS = 16 * 60 * 60


class DemoGate:
    def __init__(self, app, password_hash, session_secret, secure_cookie=True, clock=time.time, config_path=None):
        if not password_hash.startswith("$argon2id$") or len(session_secret) < 32:
            raise ValueError("A configured password hash and session key are required.")
        self.app, self.password_hash = app, password_hash
        self.key, self.secure, self.clock = session_secret.encode(), secure_cookie, clock
        self.attempts = {}
        self.config_path = config_path

    def token(self, purpose):
        message = f"{purpose}.{int(self.clock())}.{secrets.token_hex(16)}"
        return message + "." + hmac.new(self.key, message.encode(), hashlib.sha256).hexdigest()

    def valid(self, token, purpose, ttl):
        try:
            kind, timestamp, nonce, signature = token.split(".")
            message = ".".join((kind, timestamp, nonce))
            return (kind == purpose and 0 <= self.clock() - int(timestamp) <= ttl
                    and len(nonce) == 32 and hmac.compare_digest(
                        signature, hmac.new(self.key, message.encode(), hashlib.sha256).hexdigest()))
        except (ValueError, AttributeError):
            return False

    def gate_page(self, request, error="", status=401):
        # Browsers request favicons/assets after the page. Reuse a valid cookie
        # so those requests cannot invalidate the form currently on screen.
        csrf = request.cookies.get(CSRF_COOKIE, "")
        if not self.valid(csrf, "csrf", 600):
            csrf = self.token("csrf")
        target = request.url.path if not request.url.path.startswith("/_demo") else "/"
        page = """<!doctype html><html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Akses demo GenoPath</title>
<style>body{font:16px system-ui;background:#eef2f7;color:#14233b;margin:0;min-height:100vh;display:grid;place-items:center}
main{background:white;border:1px solid #d7dfeb;border-radius:16px;padding:32px;width:min(380px,80vw)}
label{display:block;margin-bottom:8px}input,button{box-sizing:border-box;width:100%;padding:12px;border-radius:8px;border:1px solid #94a3b8;font:inherit}
button{margin-top:16px;background:#1d4ed8;color:white;border:0;cursor:pointer}p{line-height:1.5}.error{color:#9f1239}</style></head>
<body><main><h1>GenoPath</h1><p>Akses demonstrasi terbatas. Masukkan password khusus demo, lalu masuk dengan akun GenoPath.</p>
<p class="error" role="alert">ERROR</p><form method="post" action="/_demo/unlock">
<input type="hidden" name="csrf" value="CSRF"><input type="hidden" name="next" value="TARGET">
<label for="demo-password">Password demo</label><input id="demo-password" name="demo_password" type="password" autocomplete="current-password" required maxlength="128">
<button type="submit">Buka GenoPath</button></form></main></body></html>"""
        page = page.replace("ERROR", html.escape(error)).replace("CSRF", html.escape(csrf, quote=True)).replace("TARGET", html.escape(target, quote=True))
        response = HTMLResponse(page, status_code=status, headers={"Cache-Control": "private, no-store",
                                                                  "X-Content-Type-Options": "nosniff"})
        response.set_cookie(CSRF_COOKIE, csrf, max_age=600, httponly=True, secure=self.secure, samesite="strict")
        return response

    def rate_limited(self, request):
        now = self.clock()
        self.attempts = {key: [stamp for stamp in stamps if now - stamp < 60]
                         for key, stamps in self.attempts.items() if any(now - stamp < 60 for stamp in stamps)}
        peer = request.client.host if request.client else "unknown"
        # Trust the connector's client header only from loopback; also enforce a
        # global ceiling so varying addresses cannot bypass the bound.
        if peer in ("127.0.0.1", "::1"):
            try:
                peer = str(ipaddress.ip_address(request.headers.get("cf-connecting-ip", peer)))
            except ValueError:
                pass
        if len(self.attempts.get(peer, [])) >= 6 or len(self.attempts.get("*", [])) >= 30:
            return True
        self.attempts.setdefault(peer, []).append(now)
        self.attempts.setdefault("*", []).append(now)
        return False

    def reload_configuration(self):
        if self.config_path is None:
            return
        config = json.loads(self.config_path.read_text())
        if (not config["password_hash"].startswith("$argon2id$") or len(config["session_secret"]) < 32
                or config.get("secure_cookie") is not True):
            raise ValueError("Invalid private gate configuration.")
        self.password_hash, self.key = config["password_hash"], config["session_secret"].encode()

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            # No WebSockets are required for the production SPA.
            if scope["type"] == "websocket":
                await send({"type": "websocket.close", "code": 1008})
                return
            return await self.app(scope, receive, send)
        request = Request(scope, receive)
        if self.config_path is not None:
            try:
                self.reload_configuration()
            except (OSError, ValueError, KeyError, TypeError, AttributeError):
                return await JSONResponse({"detail": "Demo gate configuration unavailable."}, status_code=503)(scope, receive, send)
        async def secured_send(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers.extend([
                    (b"x-frame-options", b"DENY"), (b"referrer-policy", b"same-origin"),
                    (b"content-security-policy", b"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"),
                    (b"x-demo-gate-revision", hashlib.sha256(self.key).hexdigest()[:16].encode()),
                ])
                message = {**message, "headers": headers}
            await send(message)
        if request.url.path == "/_demo/unlock" and request.method == "POST":
            raw = bytearray()
            async for chunk in request.stream():
                raw.extend(chunk)
                if len(raw) > 4096:
                    return await JSONResponse({"detail": "Request too large."}, status_code=413)(scope, receive, secured_send)
            try:
                form = parse_qs(raw.decode("utf-8"), max_num_fields=5)
                csrf = form.get("csrf", [""])[0]
                password = form.get("demo_password", [""])[0]
                target = form.get("next", ["/"])[0]
            except (UnicodeError, ValueError):
                return await self.gate_page(request, "Permintaan tidak valid.", 400)(scope, receive, secured_send)
            origin = request.headers.get("origin")
            if (not self.valid(csrf, "csrf", 600) or not hmac.compare_digest(csrf, request.cookies.get(CSRF_COOKIE, ""))
                    or (origin and origin != str(request.base_url).rstrip("/"))):
                return await self.gate_page(request, "Sesi formulir berakhir. Coba kembali.", 403)(scope, receive, secured_send)
            if self.rate_limited(request):
                response = self.gate_page(request, "Terlalu banyak percobaan. Tunggu satu menit.", 429)
                response.headers["Retry-After"] = "60"
                return await response(scope, receive, secured_send)
            original_hash, original_key = self.password_hash, self.key
            verified = len(password) <= 128 and await run_in_threadpool(verify_password, password, original_hash)
            try:
                self.reload_configuration()
            except (OSError, ValueError, KeyError, TypeError, AttributeError):
                verified = False
            if self.key != original_key or self.password_hash != original_hash:
                verified = False
            if not verified:
                return await self.gate_page(request, "Password demo tidak cocok.", 401)(scope, receive, secured_send)
            if not target.startswith("/") or target.startswith("//") or "\\" in target or any(ord(c) < 32 for c in target):
                target = "/"
            response = RedirectResponse(target, status_code=303)
            response.set_cookie(COOKIE, self.token("access"), max_age=SESSION_SECONDS,
                                httponly=True, secure=self.secure, samesite="lax")
            response.delete_cookie(CSRF_COOKIE, secure=self.secure, httponly=True, samesite="strict")
            response.headers["Cache-Control"] = "private, no-store"
            return await response(scope, receive, secured_send)
        if self.valid(request.cookies.get(COOKIE, ""), "access", SESSION_SECONDS):
            return await self.app(scope, receive, secured_send)
        if request.url.path == "/api" or request.url.path.startswith("/api/"):
            response = JSONResponse({"detail": "Demo access required."}, status_code=401,
                                    headers={"Cache-Control": "private, no-store"})
        else:
            response = self.gate_page(request)
        await response(scope, receive, secured_send)


def demo_app(api, dist: Path, config, config_path=None):
    dist = dist.resolve(strict=True)
    application = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    application.mount("/api", api)

    @application.get("/{path:path}")
    def frontend(path: str):
        candidate = dist / path
        try:
            resolved = candidate.resolve(strict=True)
            resolved.relative_to(dist)
            if resolved != candidate.absolute() or not resolved.is_file():
                raise ValueError
        except (OSError, ValueError):
            resolved = dist / "index.html"
        return FileResponse(resolved, headers={"Cache-Control": "private, no-store"})

    application.add_middleware(DemoGate, password_hash=config["password_hash"],
                               session_secret=config["session_secret"], secure_cookie=config.get("secure_cookie", True),
                               config_path=config_path)
    return application
