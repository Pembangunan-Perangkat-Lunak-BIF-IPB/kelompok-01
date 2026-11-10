"""Profile API with isolated SQLite; no production database."""
from fastapi.testclient import TestClient
from app.database import get_session_factory
from app.core.security import create_access_token

def test_profile_comes_from_database_and_is_scoped_to_jwt(m8_case, app_factory):
    c=m8_case
    app=app_factory(c.settings)
    app.dependency_overrides[get_session_factory]=lambda:c.factory
    with TestClient(app) as client:
        tokens=[]
        for username,name in [('profile_a','Ayu Pratama'),('profile_b','Bima Saputra')]:
            assert client.post('/auth/register',json={'username':username,'nama':name,'email':username+'@example.invalid','password':'profile-test-password-only'}).status_code==201
            def login():
                response=client.post('/auth/login',json={'username':username,'password':'profile-test-password-only'})
                assert response.status_code==200
                return response.json()['access_token']
            token=login()
            for current in [token,login()]:
                response=client.get('/auth/me',headers={'Authorization':'Bearer '+current})
                assert response.status_code==200
                assert response.json()['nama']==name and response.json()['username']==username
                assert set(response.json())=={'id_user','username','nama'}
                assert 'no-store' in response.headers['cache-control']
            tokens.append(token)
        assert client.get('/auth/me',headers={'Authorization':'Bearer '+tokens[0]},params={'id_user':4}).json()['nama']=='Ayu Pratama'
        for headers in [{},{'Authorization':'Bearer invalid'},{'Authorization':'Bearer '+create_access_token(999,c.settings)}]:
            denied=client.get('/auth/me',headers=headers)
            assert denied.status_code==401 and 'Pratama' not in denied.text and 'Saputra' not in denied.text
