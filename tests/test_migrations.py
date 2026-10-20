import ast
import io
from pathlib import Path
import runpy
from types import SimpleNamespace
from unittest.mock import Mock
import tomllib

import pytest
from pydantic import SecretStr
from sqlalchemy import UniqueConstraint
from sqlalchemy.exc import SQLAlchemyError

from app.database import Base


ROOT = Path(__file__).resolve().parents[1]
BASELINE = ROOT / "migrations/versions/0001_m6_baseline.py"
M7 = ROOT / "migrations/versions/0002_m7_schema.py"


def revision_tree(path):
    return ast.parse(path.read_text(), filename=str(path))


def upgrade_calls(path):
    tree = revision_tree(path)
    upgrade = next(
        node for node in tree.body
        if isinstance(node, ast.FunctionDef) and node.name == "upgrade"
    )
    return [
        node.value for node in upgrade.body
        if isinstance(node, ast.Expr) and isinstance(node.value, ast.Call)
    ]


def assert_m7_sql_contract(sql):
    assert "$genopath$;;" not in sql
    assert sql.count("$genopath$;") == 1
    assert 'LOCK TABLE public."user" IN ACCESS EXCLUSIVE MODE;' in sql
    assert 'IF EXISTS (SELECT 1 FROM public."user") THEN' in sql
    assert "RAISE EXCEPTION" in sql
    for table, column in [("user", "username"), ("analysis", "id_job")]:
        constraints = [
            constraint for constraint in Base.metadata.tables[table].constraints
            if isinstance(constraint, UniqueConstraint)
            and list(constraint.columns.keys()) == [column]
        ]
        assert len(constraints) == 1
        declaration = f"CONSTRAINT {constraints[0].name} UNIQUE ({column})"
        assert sql.count(declaration) == 1


def test_revision_chain_is_explicit_and_linear():
    for path, revision, parent in [
        (BASELINE, "0001_m6_baseline", None),
        (M7, "0002_m7_schema", "0001_m6_baseline"),
    ]:
        assignments = {
            node.targets[0].id: ast.literal_eval(node.value)
            for node in revision_tree(path).body if isinstance(node, ast.Assign)
        }
        assert assignments["revision"] == revision
        assert assignments["down_revision"] == parent
        assert assignments["branch_labels"] is None
        assert assignments["depends_on"] is None


def test_revision_table_order_respects_dependencies():
    for path, expected in [
        (BASELINE, ["user", "reference_genome", "sample"]),
        (M7, ["job", "analysis", "variant", "genotype"]),
    ]:
        calls = upgrade_calls(path)
        assert [
            ast.literal_eval(call.args[0]) for call in calls
            if isinstance(call.func, ast.Attribute) and call.func.attr == "create_table"
        ] == expected
        for node in ast.walk(revision_tree(path)):
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
                assert not node.func.attr.startswith("drop_")


def test_username_guard_precedes_schema_changes():
    calls = upgrade_calls(M7)
    assert [call.func.attr for call in calls[:4]] == [
        "execute", "execute", "add_column", "create_unique_constraint"
    ]
    assert ast.literal_eval(calls[0].args[0]) == (
        'LOCK TABLE public."user" IN ACCESS EXCLUSIVE MODE'
    )
    guard = ast.literal_eval(calls[1].args[0])
    assert 'IF EXISTS (SELECT 1 FROM public."user")' in guard
    assert "RAISE EXCEPTION" in guard
    assert "username backfill" in guard


def test_baseline_keeps_one_email_unique_index():
    calls = upgrade_calls(BASELINE)
    indexes = [call for call in calls if call.func.attr == "create_index"]
    email_indexes = [call for call in indexes
                     if ast.literal_eval(call.args[0]) == "ix_user_email"]
    assert len(email_indexes) == 1
    assert ast.literal_eval(email_indexes[0].args[2]) == ["email"]
    assert any(keyword.arg == "unique" and ast.literal_eval(keyword.value) is True
               for keyword in email_indexes[0].keywords)
    assert all(call.func.attr != "create_unique_constraint" for call in calls)
    for call in upgrade_calls(M7):
        if call.func.attr in {"create_index", "create_unique_constraint"}:
            assert "email" not in ast.literal_eval(call.args[2])


def test_alembic_dependency_manifests_match():
    project = tomllib.loads((ROOT / "pyproject.toml").read_text())
    dependencies = project["project"]["dependencies"]
    assert dependencies == (ROOT / "requirements.txt").read_text().splitlines()
    assert len([item for item in dependencies if item.startswith("alembic")]) == 1


@pytest.fixture
def alembic_api():
    return pytest.importorskip("alembic", minversion="1.16")


@pytest.fixture
def offline_config(alembic_api, monkeypatch):
    from alembic.config import Config

    def forbidden(*args, **kwargs):
        raise AssertionError("Offline migration must not read settings or connect")

    monkeypatch.setattr("app.core.config.Settings", forbidden)
    monkeypatch.setattr("app.database.get_engine", forbidden)
    monkeypatch.setattr("sqlalchemy.engine.Engine.connect", forbidden)
    config = Config(str(ROOT / "alembic.ini"))
    config.output_buffer = io.StringIO()
    return config


def test_migration_modules_import_without_side_effects(alembic_api, monkeypatch):
    forbidden = Mock(side_effect=AssertionError("Unexpected migration side effect"))
    monkeypatch.setattr("app.core.config.Settings", forbidden)
    monkeypatch.setattr("app.database.get_engine", forbidden)
    monkeypatch.setattr("alembic.op.create_table", forbidden)
    monkeypatch.setattr(Base.metadata, "create_all", forbidden)

    environment = runpy.run_path(str(ROOT / "migrations/env.py"))
    runpy.run_path(str(BASELINE))
    runpy.run_path(str(M7))

    assert environment["target_metadata"] is Base.metadata
    assert len(Base.metadata.tables) == 7
    forbidden.assert_not_called()


def test_alembic_resolves_one_head(offline_config):
    from alembic.script import ScriptDirectory

    scripts = ScriptDirectory.from_config(offline_config)
    assert scripts.get_heads() == ["0002_m7_schema"]
    assert [item.revision for item in scripts.walk_revisions()] == [
        "0002_m7_schema", "0001_m6_baseline"
    ]


def test_new_database_sql_is_generated_offline(offline_config):
    from alembic import command

    command.upgrade(offline_config, "head", sql=True)
    sql = offline_config.output_buffer.getvalue()
    assert_m7_sql_contract(sql)
    assert 'CREATE TABLE public."user"' in sql
    assert "CREATE TABLE public.reference_genome" in sql
    assert "CREATE TABLE public.sample" in sql
    assert sql.count("CREATE UNIQUE INDEX ix_user_email") == 1
    assert "UNIQUE (email)" not in sql
    assert "UNIQUE (username)" in sql
    assert "UNIQUE (id_job)" in sql
    assert "CHECK (" not in sql
    assert "ON DELETE CASCADE" not in sql
    assert sql.index("LOCK TABLE") < sql.index("DO $genopath$")
    assert sql.index("DO $genopath$") < sql.index("ADD COLUMN username")
    positions = [sql.index(f"CREATE TABLE public.{name}")
                 for name in ["job", "analysis", "variant", "genotype"]]
    assert positions == sorted(positions)


def test_existing_m6_range_sql_does_not_recreate_m6(offline_config):
    from alembic import command

    command.upgrade(offline_config, "0001_m6_baseline:head", sql=True)
    sql = offline_config.output_buffer.getvalue()
    assert_m7_sql_contract(sql)
    assert 'ALTER TABLE public."user" ADD COLUMN username VARCHAR NOT NULL' in sql
    assert 'CREATE TABLE public."user"' not in sql
    assert "CREATE TABLE public.sample" not in sql
    assert "CREATE TABLE public.reference_genome" not in sql
    assert "ix_user_email" not in sql


def test_explicit_revision_columns_match_orm(offline_config, monkeypatch):
    from alembic import command, op

    create_table = op.create_table
    created = {}

    def capture_table(name, *args, **kwargs):
        table = create_table(name, *args, **kwargs)
        created[name] = table
        return table

    monkeypatch.setattr(op, "create_table", capture_table)
    command.upgrade(offline_config, "head", sql=True)

    assert set(created) == set(Base.metadata.tables)
    for name, table in created.items():
        expected = Base.metadata.tables[name]
        expected_columns = set(expected.columns.keys())
        if name == "user":
            expected_columns.remove("username")
        assert set(table.columns.keys()) == expected_columns
        assert list(table.primary_key.columns.keys()) == list(expected.primary_key.columns.keys())
        for column in table.columns:
            reference = expected.c[column.name]
            assert type(column.type) is type(reference.type)
            assert column.nullable is reference.nullable
            assert column.default is None
            assert column.server_default is None
        assert {key.target_fullname.removeprefix("public.") for key in table.foreign_keys} == {
            key.target_fullname for key in expected.foreign_keys
        }
    assert any(
        isinstance(constraint, UniqueConstraint)
        and list(constraint.columns.keys()) == ["id_job"]
        for constraint in created["analysis"].constraints
    )


@pytest.mark.parametrize("path", [BASELINE, M7], ids=["m6", "m7"])
def test_downgrade_requires_separate_review(alembic_api, path):
    from alembic.util import CommandError

    revision = runpy.run_path(str(path))
    with pytest.raises(CommandError):
        revision["downgrade"]()


def test_online_errors_hide_connection_details(alembic_api, monkeypatch):
    from alembic.util import CommandError

    environment = runpy.run_path(str(ROOT / "migrations/env.py"))
    migrate = environment["run_migrations_online"]
    engine = Mock()
    engine.connect.side_effect = SQLAlchemyError("internal connection detail")
    monkeypatch.setitem(migrate.__globals__, "get_engine", lambda url: engine)
    monkeypatch.setitem(migrate.__globals__, "Settings", lambda: SimpleNamespace(
        database_url=SecretStr("postgresql+psycopg://")
    ))

    with pytest.raises(CommandError) as error:
        migrate()

    assert "internal connection detail" not in str(error.value)
    assert error.value.__suppress_context__ is True
    engine.dispose.assert_called_once_with()
