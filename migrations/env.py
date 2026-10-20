from alembic import context
from alembic.util import CommandError
from pydantic import ValidationError
from sqlalchemy.exc import SQLAlchemyError

from app import models
from app.core.config import Settings
from app.database import get_engine


target_metadata = models.Base.metadata


def run_migrations_offline():
    context.configure(
        dialect_name="postgresql",
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        version_table_schema="public",
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    try:
        settings = Settings()
    except ValidationError:
        raise CommandError("Invalid application settings for migrations.") from None

    database_url = settings.database_url
    if database_url is None or not database_url.get_secret_value():
        raise CommandError("DATABASE_URL is required for online migrations.")

    try:
        engine = get_engine(database_url)
        try:
            with engine.connect() as connection:
                context.configure(
                    connection=connection,
                    target_metadata=target_metadata,
                    version_table_schema="public",
                )
                with context.begin_transaction():
                    context.run_migrations()
        finally:
            engine.dispose()
    except (SQLAlchemyError, RuntimeError):
        raise CommandError(
            "Migration failed. Verify PostgreSQL access, the M6 schema, "
            "and the empty-user precondition. Connection details are not displayed."
        ) from None


# Alembic installs its configuration while running a migration command.
if vars(context).get("config") is not None:
    if context.is_offline_mode():
        run_migrations_offline()
    else:
        run_migrations_online()
