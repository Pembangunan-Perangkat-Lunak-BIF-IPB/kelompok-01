"""Add usernames and the four M7 tables."""

from alembic import op
from alembic.util import CommandError
import sqlalchemy as sa


revision = "0002_m7_schema"
down_revision = "0001_m6_baseline"
branch_labels = None
depends_on = None


def upgrade():
    op.execute('LOCK TABLE public."user" IN ACCESS EXCLUSIVE MODE')
    op.execute("""
DO $genopath$
BEGIN
    IF EXISTS (SELECT 1 FROM public."user") THEN
        RAISE EXCEPTION 'M7 requires an empty user table; review username backfill first.';
    END IF;
END;
$genopath$
""")
    op.add_column("user", sa.Column("username", sa.String(), nullable=False), schema="public")
    op.create_unique_constraint("uq_user_username", "user", ["username"], schema="public")

    op.create_table(
        "job",
        sa.Column("id_job", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("id_user", sa.Integer(), nullable=False),
        sa.Column("id_sample", sa.Integer(), nullable=False),
        sa.Column("id_reference_genome", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("waktu_mulai", sa.DateTime(), nullable=True),
        sa.Column("waktu_selesai", sa.DateTime(), nullable=True),
        sa.Column("pesan_error", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["id_user"], ["public.user.id_user"]),
        sa.ForeignKeyConstraint(["id_sample"], ["public.sample.id_sample"]),
        sa.ForeignKeyConstraint(
            ["id_reference_genome"], ["public.reference_genome.id_reference_genome"]
        ),
        schema="public",
    )
    op.create_table(
        "analysis",
        sa.Column("id_analysis", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("id_job", sa.Integer(), nullable=False),
        sa.Column("parameter_qual", sa.Float(), nullable=False),
        sa.Column("parameter_dp", sa.Integer(), nullable=False),
        sa.Column("metrik_qc", sa.String(), nullable=True),
        sa.Column("total_varian", sa.Integer(), nullable=True),
        sa.Column("snp_count", sa.Integer(), nullable=True),
        sa.Column("indel_count", sa.Integer(), nullable=True),
        sa.Column("path_vcf", sa.String(), nullable=True),
        sa.Column("path_csv", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["id_job"], ["public.job.id_job"]),
        sa.UniqueConstraint("id_job", name="uq_analysis_id_job"),
        schema="public",
    )
    op.create_table(
        "variant",
        sa.Column("id_variant", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("id_analysis", sa.Integer(), nullable=False),
        sa.Column("chromosome", sa.String(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("ref_allele", sa.String(), nullable=False),
        sa.Column("alt_allele", sa.String(), nullable=False),
        sa.Column("qual", sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(["id_analysis"], ["public.analysis.id_analysis"]),
        schema="public",
    )
    op.create_table(
        "genotype",
        sa.Column("id_genotype", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("id_variant", sa.Integer(), nullable=False),
        sa.Column("id_sample", sa.Integer(), nullable=False),
        sa.Column("genotype_call", sa.String(), nullable=False),
        sa.Column("dp", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["id_variant"], ["public.variant.id_variant"]),
        sa.ForeignKeyConstraint(["id_sample"], ["public.sample.id_sample"]),
        schema="public",
    )


def downgrade():
    raise CommandError("Automatic M7 downgrade is disabled; review a rollback plan first.")
