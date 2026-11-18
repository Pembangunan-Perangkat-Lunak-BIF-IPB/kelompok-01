"""Persistent owned analysis identity, additive backfill, no biological changes."""
from alembic import op
from alembic.util import CommandError
import sqlalchemy as sa

revision = "0005_analysis_identity"
down_revision = "0004_m9_result_indexes"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("LOCK TABLE public.job IN ACCESS EXCLUSIVE MODE")
    op.add_column("job", sa.Column("analysis_number", sa.Integer(), nullable=True), schema="public")
    op.add_column("job", sa.Column("analysis_name", sa.String(80), nullable=True), schema="public")
    # Global PK is immutable and provides a total, stable historical order.
    op.execute("""WITH ranked AS (
        SELECT id_job, row_number() OVER (PARTITION BY id_user ORDER BY id_job) AS n
        FROM public.job
    ) UPDATE public.job AS j SET analysis_number = ranked.n,
        analysis_name = 'Analisis ' || ranked.n::text
      FROM ranked WHERE j.id_job = ranked.id_job""")
    op.alter_column("job", "analysis_number", nullable=False, schema="public")
    op.alter_column("job", "analysis_name", nullable=False, schema="public")
    op.create_unique_constraint("uq_job_owner_number", "job", ["id_user", "analysis_number"], schema="public")
    op.create_check_constraint("ck_job_analysis_number_positive", "job", "analysis_number > 0", schema="public")


def downgrade():
    raise CommandError("Automatic identity downgrade is disabled; review data preservation first.")
