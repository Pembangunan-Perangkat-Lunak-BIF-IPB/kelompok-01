from functools import lru_cache
import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_settings
from app.api.errors import authentication_error
from app.core.config import Settings
from app.core.security import create_access_token, hash_password, verify_password
from app.database import get_db
from app.models import User
from app.schemas.auth import ErrorResponse, LoginRequest, TokenResponse


router = APIRouter(prefix="/auth", tags=["auth"])


@lru_cache(maxsize=1)
def _dummy_password_hash() -> str:
    # Lazy, process-local dummy hash; never persisted and never an account.
    return hash_password(secrets.token_urlsafe(32))


@router.post(
    "/login",
    response_model=TokenResponse,
    responses={
        401: {"model": ErrorResponse, "description": "Authentication failed."},
        503: {"model": ErrorResponse, "description": "Service unavailable."},
    },
    summary="Log in with username and password as JSON",
)
def login(
    credentials: LoginRequest,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> TokenResponse:
    user = db.scalar(select(User).where(User.username == credentials.username))
    stored_hash = user.password_hash if user is not None else _dummy_password_hash()
    password_matches = verify_password(credentials.password.get_secret_value(), stored_hash)
    if user is None or not password_matches:
        raise authentication_error()
    token = create_access_token(user.id_user, settings)
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
    return TokenResponse(access_token=token)
