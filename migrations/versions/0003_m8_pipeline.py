"""Add execution configuration and lossless VCF record metadata for M8."""

from alembic import op
from alembic.util import CommandError
import sqlalchemy as sa

revision = "0003_m8_pipeline"
down_revision = "0002_m7_schema"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("job", sa.Column("parameter_pipeline", sa.JSON(), nullable=True), schema="public")
    op.add_column("analysis", sa.Column("other_count", sa.Integer(), nullable=True), schema="public")
    op.add_column("variant", sa.Column("variant_type", sa.String(), nullable=True), schema="public")
    op.add_column("variant", sa.Column("filter_status", sa.String(), nullable=True), schema="public")
    op.add_column("variant", sa.Column("info", sa.JSON(), nullable=True), schema="public")


def downgrade():
    raise CommandError("Automatic M8 downgrade is disabled; review a rollback plan first.")
