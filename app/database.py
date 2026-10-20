from collections.abc import Iterator
from functools import lru_cache
from typing import Annotated

from fastapi import Depends, Request
from pydantic import SecretStr
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine, make_url
from sqlalchemy.exc import ArgumentError
from sqlalchemy.orm import Session, declarative_base, sessionmaker

Base = declarative_base()


class DatabaseConfigurationError(RuntimeError):
    """Database configuration is unavailable or unsupported."""


@lru_cache
def get_engine(database_url: SecretStr) -> Engine:
    try:
        url = make_url(database_url.get_secret_value())
    except (ArgumentError, ValueError):
        raise DatabaseConfigurationError("DATABASE_URL is not a valid SQLAlchemy URL.") from None

    if url.drivername != "postgresql+psycopg":
        raise DatabaseConfigurationError("DATABASE_URL must use postgresql+psycopg://.")

    # Creating an engine is lazy; connections are opened when sessions need them.
    return create_engine(url)


def get_session_factory(request: Request) -> sessionmaker[Session]:
    database_url = request.app.state.settings.database_url
    if database_url is None or not database_url.get_secret_value():
        raise DatabaseConfigurationError("DATABASE_URL is required for database endpoints.")

    return sessionmaker(autoflush=False, bind=get_engine(database_url))


def get_db(
    session_factory: Annotated[sessionmaker[Session], Depends(get_session_factory)],
) -> Iterator[Session]:
    db = session_factory()
    try:
        yield db
    finally:
        db.close()
