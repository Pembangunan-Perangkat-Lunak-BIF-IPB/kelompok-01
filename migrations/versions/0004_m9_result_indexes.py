"""Indexes for owned result pagination, filtering, and bounded genotype lookup."""

from alembic import op
from alembic.util import CommandError

revision = "0004_m9_result_indexes"
down_revision = "0003_m8_pipeline"
branch_labels = None
depends_on = None


def upgrade():
    op.create_index("ix_variant_analysis_page", "variant", ["id_analysis", "id_variant"], schema="public")
    op.create_index("ix_variant_analysis_type_qual", "variant", ["id_analysis", "variant_type", "qual"], schema="public")
    op.create_index("ix_genotype_variant_sample", "genotype", ["id_variant", "id_sample"], schema="public")


def downgrade():
    raise CommandError("Automatic M9 downgrade is disabled; review an index rollback plan first.")
