"""Register the E. coli biological demo and per-reference Bowtie2 metadata."""

from alembic import op
from alembic.util import CommandError
import sqlalchemy as sa


revision = "0006_ecoli_biological_demo"
down_revision = "0005_analysis_identity"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("reference_genome", sa.Column("accession", sa.String(), nullable=True), schema="public")
    op.add_column("reference_genome", sa.Column("strain", sa.String(), nullable=True), schema="public")
    op.add_column("reference_genome", sa.Column("is_demo", sa.Boolean(), nullable=True), schema="public")
    op.add_column("reference_genome", sa.Column("path_bowtie2_index", sa.String(), nullable=True), schema="public")
    op.execute("""
        INSERT INTO public.reference_genome
            (nama_genom, versi, sumber, path_fasta, accession, strain, is_demo, path_bowtie2_index)
        SELECT
            'Escherichia coli K-12 MG1655',
            'NC_000913.3 / GCF_000005845.2 ASM584v2',
            'NCBI RefSeq; demo dataset SRR522156',
            'ecoli-k12-mg1655/reference/NC_000913.3.fna',
            'NC_000913.3',
            'K-12 MG1655',
            TRUE,
            'ecoli-k12-mg1655/index/NC_000913.3'
        WHERE NOT EXISTS (
            SELECT 1 FROM public.reference_genome WHERE accession = 'NC_000913.3'
        )
    """)


def downgrade():
    raise CommandError("Automatic E. coli demo downgrade is disabled; preserve existing Jobs and data.")
