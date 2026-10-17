import pytest
from sqlalchemy import (
    BigInteger,
    DateTime,
    Float,
    Integer,
    String,
    Text,
    UniqueConstraint,
    inspect,
)
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import configure_mappers
from sqlalchemy.schema import CreateTable

from app.database import Base
from app.models import Analysis, Genotype, Job, ReferenceGenome, Sample, User, Variant


MODELS = (User, ReferenceGenome, Sample, Job, Analysis, Variant, Genotype)

M7_COLUMNS = {
    Job: {
        "id_job": (Integer, False),
        "id_user": (Integer, False),
        "id_sample": (Integer, False),
        "id_reference_genome": (Integer, False),
        "status": (String, False),
        "waktu_mulai": (DateTime, True),
        "waktu_selesai": (DateTime, True),
        "pesan_error": (Text, True),
    },
    Analysis: {
        "id_analysis": (Integer, False),
        "id_job": (Integer, False),
        "parameter_qual": (Float, False),
        "parameter_dp": (Integer, False),
        "metrik_qc": (String, True),
        "total_varian": (Integer, True),
        "snp_count": (Integer, True),
        "indel_count": (Integer, True),
        "path_vcf": (String, True),
        "path_csv": (String, True),
    },
    Variant: {
        "id_variant": (Integer, False),
        "id_analysis": (Integer, False),
        "chromosome": (String, False),
        "position": (Integer, False),
        "ref_allele": (String, False),
        "alt_allele": (String, False),
        "qual": (Float, True),
    },
    Genotype: {
        "id_genotype": (Integer, False),
        "id_variant": (Integer, False),
        "id_sample": (Integer, False),
        "genotype_call": (String, False),
        "dp": (Integer, True),
    },
}


def test_seven_models_share_base_and_metadata():
    assert set(Base.metadata.tables) == {
        "user", "reference_genome", "sample", "job", "analysis", "variant", "genotype"
    }
    assert {mapper.class_ for mapper in Base.registry.mappers} == set(MODELS)
    for model in MODELS:
        assert model.metadata is Base.metadata
        assert model.__table__.metadata is Base.metadata


@pytest.mark.parametrize("model", M7_COLUMNS, ids=lambda model: model.__name__)
def test_m7_column_types_and_nullability_match_erd(model):
    columns = M7_COLUMNS[model]
    table = model.__table__
    assert set(table.columns.keys()) == set(columns)
    for name, (column_type, nullable) in columns.items():
        column = table.c[name]
        assert type(column.type) is column_type, name
        assert column.nullable is nullable, name


@pytest.mark.parametrize(
    "model,key",
    [
        (Job, "id_job"),
        (Analysis, "id_analysis"),
        (Variant, "id_variant"),
        (Genotype, "id_genotype"),
    ],
)
def test_m7_primary_keys(model, key):
    table = model.__table__
    assert list(table.primary_key.columns.keys()) == [key]
    assert table.autoincrement_column is table.c[key]


@pytest.mark.parametrize(
    "model,targets",
    [
        (Sample, {"id_user": "user.id_user"}),
        (Job, {
            "id_user": "user.id_user",
            "id_sample": "sample.id_sample",
            "id_reference_genome": "reference_genome.id_reference_genome",
        }),
        (Analysis, {"id_job": "job.id_job"}),
        (Variant, {"id_analysis": "analysis.id_analysis"}),
        (Genotype, {"id_variant": "variant.id_variant", "id_sample": "sample.id_sample"}),
    ],
)
def test_foreign_keys_resolve_to_shared_metadata(model, targets):
    foreign_keys = model.__table__.foreign_keys
    assert {key.parent.name: key.target_fullname for key in foreign_keys} == targets
    for key in foreign_keys:
        assert key.column.table.metadata is Base.metadata
        assert key.parent.nullable is False


def test_analysis_has_unique_job_foreign_key():
    constraints = [
        constraint
        for constraint in Analysis.__table__.constraints
        if isinstance(constraint, UniqueConstraint)
        and list(constraint.columns.keys()) == ["id_job"]
    ]
    assert len(constraints) == 1
    assert constraints[0].name == "uq_analysis_id_job"


def test_username_is_required_and_unique_without_a_default():
    column = User.__table__.c.username
    assert type(column.type) is String
    assert column.nullable is False
    assert column.default is None
    assert column.server_default is None
    constraints = [
        constraint
        for constraint in User.__table__.constraints
        if isinstance(constraint, UniqueConstraint)
        and list(constraint.columns.keys()) == ["username"]
    ]
    assert len(constraints) == 1
    assert constraints[0].name == "uq_user_username"


def test_email_keeps_its_existing_unique_index():
    indexes = [index for index in User.__table__.indexes if index.unique]
    assert [(index.name, list(index.columns.keys())) for index in indexes] == [
        ("ix_user_email", ["email"])
    ]
    assert not any(
        isinstance(constraint, UniqueConstraint)
        and list(constraint.columns.keys()) == ["email"]
        for constraint in User.__table__.constraints
    )


@pytest.mark.parametrize(
    "parent,collection,child,scalar,uselist",
    [
        (User, "samples", Sample, "owner", True),
        (User, "jobs", Job, "owner", True),
        (Sample, "jobs", Job, "sample", True),
        (ReferenceGenome, "jobs", Job, "reference_genome", True),
        (Job, "analysis", Analysis, "job", False),
        (Analysis, "variants", Variant, "analysis", True),
        (Variant, "genotypes", Genotype, "variant", True),
        (Sample, "genotypes", Genotype, "sample", True),
    ],
)
def test_bidirectional_relationships_and_cardinality(parent, collection, child, scalar, uselist):
    configure_mappers()
    parent_relation = inspect(parent).relationships[collection]
    child_relation = inspect(child).relationships[scalar]

    assert parent_relation.mapper.class_ is child
    assert parent_relation.back_populates == scalar
    assert parent_relation.uselist is uselist
    assert child_relation.mapper.class_ is parent
    assert child_relation.back_populates == collection
    assert child_relation.uselist is False


def test_relationships_link_objects_without_database_access():
    user = User()
    sample = Sample(owner=user)
    reference = ReferenceGenome()
    job = Job(owner=user, sample=sample, reference_genome=reference)
    analysis = Analysis(job=job)
    variant = Variant(analysis=analysis)
    genotype = Genotype(variant=variant, sample=sample)

    assert user.samples == [sample]
    assert user.jobs == [job]
    assert sample.jobs == [job]
    assert reference.jobs == [job]
    assert job.analysis is analysis
    assert analysis.variants == [variant]
    assert variant.genotypes == [genotype]
    assert sample.genotypes == [genotype]


@pytest.mark.parametrize("model", MODELS, ids=lambda model: model.__name__)
def test_schema_does_not_introduce_defaults_or_delete_cascades(model):
    for column in model.__table__.columns:
        assert column.default is None
        assert column.server_default is None
        if isinstance(column.type, String):
            assert column.type.length is None
    for foreign_key in model.__table__.foreign_keys:
        assert foreign_key.ondelete is None
        assert foreign_key.onupdate is None
    for relation in inspect(model).relationships:
        assert "delete" not in relation.cascade
        assert "delete-orphan" not in relation.cascade


def test_m6_columns_are_preserved_pending_migration_review():
    assert {
        "id_user", "nama", "email", "password_hash", "role"
    } <= set(User.__table__.columns.keys())
    assert {
        "id_reference_genome", "nama_genom", "versi", "sumber", "path_fasta"
    } <= set(ReferenceGenome.__table__.columns.keys())
    assert {
        "id_sample", "id_user", "nama_berkas", "path_penyimpanan", "ukuran_berkas", "waktu_unggah"
    } <= set(Sample.__table__.columns.keys())
    assert type(Sample.__table__.c.ukuran_berkas.type) is BigInteger


@pytest.mark.parametrize("model", MODELS, ids=lambda model: model.__name__)
def test_tables_compile_for_postgresql_without_execution(model):
    statement = str(CreateTable(model.__table__).compile(dialect=postgresql.dialect()))
    assert "CREATE TABLE" in statement
