"""Create the three M6 tables in a new database."""

from alembic import op
from alembic.util import CommandError
import sqlalchemy as sa


revision = "0001_m6_baseline"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "user",
        sa.Column("id_user", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("nama", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("role", sa.String(), nullable=False),
        schema="public",
    )
    op.create_index("ix_user_id_user", "user", ["id_user"], schema="public")
    op.create_index("ix_user_email", "user", ["email"], unique=True, schema="public")

    op.create_table(
        "reference_genome",
        sa.Column("id_reference_genome", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("nama_genom", sa.String(), nullable=False),
        sa.Column("versi", sa.String(), nullable=True),
        sa.Column("sumber", sa.String(), nullable=True),
        sa.Column("path_fasta", sa.String(), nullable=False),
        schema="public",
    )
    op.create_index(
        "ix_reference_genome_id_reference_genome",
        "reference_genome",
        ["id_reference_genome"],
        schema="public",
    )

    op.create_table(
        "sample",
        sa.Column("id_sample", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("id_user", sa.Integer(), nullable=False),
        sa.Column("nama_berkas", sa.String(), nullable=False),
        sa.Column("path_penyimpanan", sa.String(), nullable=False),
        sa.Column("ukuran_berkas", sa.BigInteger(), nullable=False),
        sa.Column("waktu_unggah", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["id_user"], ["public.user.id_user"]),
        schema="public",
    )
    op.create_index("ix_sample_id_sample", "sample", ["id_sample"], schema="public")


def downgrade():
    raise CommandError("The M6 baseline cannot be downgraded automatically.")
