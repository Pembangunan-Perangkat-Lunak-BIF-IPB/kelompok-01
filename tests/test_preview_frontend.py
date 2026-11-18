"""Preview safety without a database, user data, runner or real network."""
import json
import re
from fastapi.testclient import TestClient
import httpx
from app.core.security import hash_password
from scripts import preview_frontend as preview


def setup_preview(tmp_path, monkeypatch):
    root = tmp_path / 'm11'
    (root / 'frontend/dist').mkdir(parents=True)
    (root / 'frontend/dist/index.html').write_text('<html lang="id">M11 preview</html>')
    m10 = tmp_path / 'm10'
    (m10 / '.runtime').mkdir(parents=True)
    config = m10 / '.runtime/gate.json'
    config.write_text(json.dumps({'purpose': 'approved_demo', 'secure_cookie': True,
        'password_hash': hash_password('synthetic-preview-test-password'), 'session_secret': 'k' * 48}))
    before = config.read_bytes()
    monkeypatch.setattr(preview, 'ROOT', root)
    calls = []
    class Body(httpx.AsyncByteStream):
        def __init__(self, value): self.raw = json.dumps(value).encode()
        async def __aiter__(self): yield self.raw
    def reply(status, value):
        return httpx.Response(status, headers={"content-type": "application/json"}, stream=Body(value))
    def upstream(request):
        calls.append(request)
        if request.headers.get('authorization') != 'Bearer test-jwt':
            return reply(401, {'detail': 'Not authenticated'})
        if request.url.path.endswith('/vcf'):
            return reply(404, {'detail': 'Not found'})
        return reply(200, [{'id_job': 7}])
    original = httpx.AsyncClient
    monkeypatch.setattr(preview.httpx, 'AsyncClient', lambda **kw: original(**kw, transport=httpx.MockTransport(upstream)))
    return preview.preview(m10), calls, config, before


def unlock(client):
    page = client.get('/login')
    csrf = re.search('name="csrf" value="([^"]+)"', page.text).group(1)
    response = client.post('/_demo/unlock', data={'csrf': csrf,
        'demo_password': 'synthetic-preview-test-password', 'next': '/dashboard'}, follow_redirects=False)
    assert response.status_code == 303


def test_preview_gate_denies_static_and_api_without_contacting_backend(tmp_path, monkeypatch):
    app, calls, config, before = setup_preview(tmp_path, monkeypatch)
    with TestClient(app, base_url='https://demo.test') as client:
        assert client.get('/login').status_code == 401
        assert client.get('/api/auth/me').status_code == 401
        assert client.get('/api/jobs/7/vcf').status_code == 401
    assert not calls
    assert config.read_bytes() == before


def test_preview_passes_jwt_checks_to_existing_backend_and_keeps_real_status(tmp_path, monkeypatch):
    app, calls, config, before = setup_preview(tmp_path, monkeypatch)
    with TestClient(app, base_url='https://demo.test') as client:
        unlock(client)
        assert client.get('/dashboard').status_code == 200
        assert client.get('/api/jobs').status_code == 401
        assert client.get('/api/jobs', headers={'Authorization': 'Bearer test-jwt'}).json() == [{'id_job': 7}]
        assert client.get('/api/jobs/7/vcf', headers={'Authorization': 'Bearer test-jwt'}).status_code == 404
    assert all(str(r.url).startswith('http://127.0.0.1:3000/api/') for r in calls)
    assert config.read_bytes() == before
