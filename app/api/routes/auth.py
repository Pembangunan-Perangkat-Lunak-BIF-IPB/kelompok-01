from functools import lru_cache
import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies import get_settings, get_current_user
from app.api.errors import authentication_error
from app.core.config import Settings
from app.core.security import create_access_token, hash_password, verify_password
from app.database import get_db
from app.models import User
from app.schemas.auth import (
    ProfileResponse, ErrorResponse, LoginRequest, RegisterRequest, RegisterResponse, TokenResponse,
)


router = APIRouter(prefix="/auth", tags=["auth"])


@lru_cache(maxsize=1)
def _dummy_password_hash() -> str:
    # Lazy, process-local dummy hash; never persisted and never an account.
    return hash_password(secrets.token_urlsafe(32))


def _account_unique_conflict(error: IntegrityError) -> bool:
    # Match the existing PostgreSQL username constraint / email unique index.
    # Other integrity failures are service errors, not evidence of a duplicate.
    return (
        getattr(error.orig, "sqlstate", None) == "23505"
        and getattr(getattr(error.orig, "diag", None), "constraint_name", None)
        in {"uq_user_username", "ix_user_email"}
    )


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=201,
    responses={
        409: {"model": ErrorResponse, "description": "Username or email already registered."},
        503: {"model": ErrorResponse, "description": "Service unavailable."},
    },
    summary="Register a regular user with JSON",
    description=(
        "Prepared for local MVP/demo use; public deployment registration policy is not decided. "
        "The server assigns role user. No token is issued; use POST /auth/login afterwards."
    ),
)
def register(
    registration: RegisterRequest,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
) -> RegisterResponse:
    try:
        duplicate = db.scalar(select(User.id_user).where(or_(
            User.username == registration.username,
            func.lower(User.email) == registration.email,
        )))
        if duplicate is not None:
            raise HTTPException(409, "Username or email already registered.")
        user = User(
            username=registration.username, nama=registration.nama, email=registration.email,
            password_hash=hash_password(registration.password.get_secret_value()), role="user",
        )
        db.add(user)
        db.flush()
        # Snapshot before commit so ORM expiry cannot cause a post-commit read.
        result = RegisterResponse.model_validate(user)
        db.commit()
    except IntegrityError as error:
        db.rollback()
        if _account_unique_conflict(error):
            raise HTTPException(409, "Username or email already registered.") from None
        raise
    except Exception:
        db.rollback()
        raise
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
    return result


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


@router.get("/me", response_model=ProfileResponse, responses={401: {"model": ErrorResponse}},
            summary="Read only the authenticated account's persistent profile")
def me(current_user: Annotated[User, Depends(get_current_user)], response: Response) -> ProfileResponse:
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["Pragma"] = "no-cache"
    return ProfileResponse.model_validate(current_user)
