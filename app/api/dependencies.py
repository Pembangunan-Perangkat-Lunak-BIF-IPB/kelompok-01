from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.api.errors import authentication_error
from app.core.config import Settings
from app.core.security import InvalidAccessTokenError, decode_access_token
from app.database import get_db
from app.models import User


bearer_scheme = HTTPBearer(
    scheme_name="HTTPBearer",
    bearerFormat="JWT",
    description="Access token returned by POST /auth/login (JSON login).",
    auto_error=False,
)


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def _get_token_user_id(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> int:
    if credentials is None:
        raise authentication_error()
    try:
        claims = decode_access_token(credentials.credentials, settings)
    except InvalidAccessTokenError:
        raise authentication_error() from None
    return int(claims["sub"])


def get_current_user(
    id_user: Annotated[int, Depends(_get_token_user_id)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    # Resolve the token dependency before opening a database session.
    user = db.get(User, id_user)
    if user is None:
        raise authentication_error()
    # The returned ORM object includes the role currently stored in the database.
    return user
