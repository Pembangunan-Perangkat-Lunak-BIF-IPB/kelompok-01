"""Result API against isolated SQLite and synthetic VCF, never PostgreSQL."""

from uuid import uuid4
import time
import jwt

from fastapi.testclient import TestClient
import pytest
from sqlalchemy import event, select
from sqlalchemy.exc import OperationalError

from app.core.security import create_access_token
from app.database import get_session_factory
from app.models import Analysis, Genotype, Job, Variant
from app.schemas.result import ResultSummary, VariantPage, VariantQuery
from app.services import jobs, results
from app.services.pipeline import PipelineResult


class VcfFixture:
    def __init__(self, empty=False):
        self.empty = empty

    def execute(self, plan):
        plan.outdir.mkdir(parents=True)
        path = plan.outdir / 'result.vcf'
        header = ('##fileformat=VCFv4.2\n'
                  '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tfixture_sample\n')
        records = ''.join(
            f'fixture_chr\t{pos}\t.\tA\t{alt}\t{qual}\tPASS\tDP=999;FLAG\tGT:DP\t{gt}:20\n'
            for pos, alt, qual, gt in [(1, 'C', 10, '1|1'), (2, 'AT', 30, '0/1'),
                                       (3, 'C,AT', 60, '1|2'), (4, 'G', 90, './.')]
        )
        path.write_text(header + ('' if self.empty else records))
        return PipelineResult(path, {'synthetic': True})


@pytest.fixture
def case(m8_case, app_factory):
    c = m8_case
    request = c.request.model_copy(update={'parameter_qual': 0.0, 'parameter_dp': 0})
    queued = jobs.create_job(c.factory, c.settings, 1, request)
    assert jobs.run_job(c.factory, c.settings, queued.id_job, VcfFixture()) == 'completed'
    c.identifier = queued.id_job
    application = app_factory(c.settings)
    application.dependency_overrides[get_session_factory] = lambda: c.factory
    with TestClient(application) as client:
        c.client = client
        yield c


def headers(c, owner=1):
    return {'Authorization': 'Bearer ' + create_access_token(owner, c.settings)}


def get(c, suffix='result', **params):
    return c.client.get(f'/jobs/{c.identifier}/{suffix}', headers=headers(c), params=params)


def test_summary_counts_parameters_and_utc_are_public_and_consistent(case):
    response = get(case)
    assert response.status_code == 200
    data = response.json()
    assert data['counts'] == {'total_variants': 4, 'snps': 2, 'indels': 1, 'other': 1, 'unclassified': 0}
    assert data['parameters'] == {'parameter_qual': 0.0, 'parameter_dp': 0, 'require_pass': True, 'variant_ploidy': 2}
    assert data['execution_mode'] == 'synthetic' and data['status'] == 'Completed'
    assert data['id_sample'] == 1 and data['id_reference_genome'] == 1
    assert data['waktu_mulai'].endswith('Z') and data['waktu_selesai'].endswith('Z')
    assert data['counts']['total_variants'] == get(case, 'variants').json()['total']


def test_variant_page_retains_multiallelic_gt_missing_calls_and_info(case):
    response = get(case, 'variants')
    assert response.status_code == 200
    data = response.json()
    assert (data['total'], data['returned'], data['limit'], data['offset']) == (4, 4, 50, 0)
    assert data['has_more'] is False and data['next_offset'] is None
    mixed = data['items'][2]
    assert mixed['alt_allele'] == 'C,AT' and mixed['variant_type'] == 'other'
    assert mixed['info'] == {'DP': '999', 'FLAG': None}
    assert mixed['genotypes'][0]['genotype_call'] == '1|2'
    assert mixed['genotypes'][0]['dp'] == 20
    assert data['items'][3]['genotypes'][0]['genotype_call'] == './.'


@pytest.mark.parametrize('query,positions', [
    ({'variant_type': 'snp'}, [1, 4]), ({'variant_type': 'indel'}, [2]),
    ({'variant_type': 'other'}, [3]), ({'min_qual': 30}, [2, 3, 4]),
    ({'max_qual': 30}, [1, 2]), ({'min_qual': 30, 'max_qual': 60}, [2, 3]),
    ({'variant_type': 'snp', 'min_qual': 30}, [4]), ({'min_qual': 91}, []),
    ({'variant_type': 'unclassified'}, []),
])
def test_inclusive_sql_filters_and_filtered_total(case, query, positions):
    data = get(case, 'variants', **query).json()
    assert data['total'] == data['returned'] == len(positions)
    assert [row['position'] for row in data['items']] == positions
    for key, value in query.items():
        assert data['filters'][key] == value
    assert get(case).json()['counts']['total_variants'] == 4


def test_filtered_pagination_is_stable_and_does_not_skip_or_duplicate_rows(case):
    identifiers = []
    for offset in range(3):
        data = get(case, 'variants', limit=1, offset=offset, min_qual=30).json()
        assert (data['total'], data['returned']) == (3, 1)
        assert data['has_more'] is (offset < 2)
        assert data['next_offset'] == (offset + 1 if offset < 2 else None)
        identifiers.append(data['items'][0]['id_variant'])
    assert identifiers == sorted(set(identifiers))
    assert identifiers == [row['id_variant'] for row in get(case, 'variants', min_qual=30).json()['items']]


@pytest.mark.parametrize('offset', [4, 9, 2**31 - 1])
def test_offset_at_or_beyond_end_is_an_empty_page_with_actual_total(case, offset):
    data = get(case, 'variants', limit=1, offset=offset).json()
    assert data['total'] == 4 and data['items'] == [] and data['returned'] == 0
    assert data['has_more'] is False and data['next_offset'] is None


def test_empty_completed_analysis_returns_zero_counts_and_empty_page(case):
    c = case
    request = c.request.model_copy(update={'request_id': str(uuid4())})
    queued = jobs.create_job(c.factory, c.settings, 1, request)
    assert jobs.run_job(c.factory, c.settings, queued.id_job, VcfFixture(empty=True)) == 'completed'
    c.identifier = queued.id_job
    summary = get(c).json()['counts']
    assert all(value == 0 for value in summary.values())
    page = get(c, 'variants').json()
    assert page['total'] == page['returned'] == 0 and page['items'] == []


@pytest.mark.parametrize('suffix', ['result', 'variants'])
@pytest.mark.parametrize('status', ['Queued', 'Running', 'Failed', 'Completed'])
def test_non_owner_gets_same_404_as_missing_job_for_any_status(case, suffix, status):
    with case.factory.begin() as db:
        db.get(Job, case.identifier).status = status
    hidden = case.client.get(f'/jobs/{case.identifier}/{suffix}', headers=headers(case, 2))
    missing = case.client.get(f'/jobs/9999/{suffix}', headers=headers(case, 2))
    assert hidden.status_code == missing.status_code == 404
    assert hidden.json() == missing.json()


@pytest.mark.parametrize('status', ['Queued', 'Running', 'Failed'])
@pytest.mark.parametrize('suffix', ['result', 'variants'])
def test_owner_cannot_read_results_before_completion(case, status, suffix):
    with case.factory.begin() as db:
        db.get(Job, case.identifier).status = status
    assert get(case, suffix).status_code == 409


def test_completed_job_without_analysis_is_not_ready(case):
    job = jobs.create_job(case.factory, case.settings, 1, case.request.model_copy(update={'request_id': str(uuid4())}))
    with case.factory.begin() as db:
        db.get(Job, job.id_job).status = 'Completed'
    case.identifier = job.id_job
    assert get(case).status_code == get(case, 'variants').status_code == 409


@pytest.mark.parametrize('query', [
    {'limit': 0}, {'limit': 501}, {'limit': -1}, {'limit': '1.5'}, {'limit': 'bad'},
    {'offset': -1}, {'offset': 2**31}, {'offset': 'bad'}, {'min_qual': -1},
    {'max_qual': -1}, {'min_qual': 'NaN'}, {'max_qual': 'inf'},
    {'min_qual': 60, 'max_qual': 30}, {'variant_type': 'SNP'}, {'variant_type': 'snp;DROP'},
    {'sort': 'position'}, {'id_user': 2},
])
def test_invalid_query_is_rejected_without_reflecting_input(case, query):
    response = get(case, 'variants', **query)
    assert response.status_code == 422
    assert 'DROP' not in response.text


@pytest.mark.parametrize('identifier', [0, -1, 2**31])
@pytest.mark.parametrize('suffix', ['result', 'variants'])
def test_invalid_job_identifier(case, identifier, suffix):
    assert case.client.get(f'/jobs/{identifier}/{suffix}', headers=headers(case)).status_code == 422


@pytest.mark.parametrize('suffix', ['result', 'variants'])
def test_missing_invalid_or_expired_jwt_cannot_query_results(case, suffix):
    calls = []
    def observe(*args):
        calls.append(True)
    event.listen(case.engine, 'before_cursor_execute', observe)
    try:
        expired = jwt.encode({'sub': '1', 'iat': int(time.time()) - 10, 'exp': int(time.time()) - 1},
                             case.settings.jwt_secret.get_secret_value(), algorithm='HS256')
        for supplied in ({}, {'Authorization': 'Bearer invalid'}, {'Authorization': 'Bearer ' + expired}):
            response = case.client.get(f'/jobs/{case.identifier}/{suffix}', headers=supplied)
            assert response.status_code == 401
            assert response.headers['www-authenticate'] == 'Bearer'
    finally:
        event.remove(case.engine, 'before_cursor_execute', observe)
    assert calls == []


def test_other_sample_genotypes_are_never_returned_or_counted_as_variants(case):
    with case.factory.begin() as db:
        identifier = db.scalar(select(Variant.id_variant).order_by(Variant.id_variant))
        db.add_all([Genotype(id_variant=identifier, id_sample=2, genotype_call='private-other-sample', dp=900),
                    Genotype(id_variant=identifier, id_sample=1, genotype_call='1/1', dp=22)])
    response = get(case, 'variants', limit=1)
    assert response.json()['total'] == 4
    assert len(response.json()['items'][0]['genotypes']) == 2
    assert 'private-other-sample' not in response.text
    assert {g['id_sample'] for g in response.json()['items'][0]['genotypes']} == {1}


def test_missing_genotype_does_not_remove_variant_from_page(case):
    with case.factory.begin() as db:
        genotype = db.scalar(select(Genotype).order_by(Genotype.id_genotype))
        db.delete(genotype)
    page = get(case, 'variants', limit=1).json()
    assert page['items'][0]['genotypes'] == [] and page['total'] == 4


def test_counts_use_actual_rows_and_unknown_legacy_types_are_explicit(case):
    with case.factory.begin() as db:
        rows = db.scalars(select(Variant).order_by(Variant.id_variant)).all()
        rows[0].variant_type, rows[0].qual = None, None
        rows[3].variant_type = 'legacy-unknown'
        db.scalar(select(Analysis)).total_varian = 999
    counts = get(case).json()['counts']
    assert counts == {'total_variants': 4, 'snps': 0, 'indels': 1, 'other': 1, 'unclassified': 2}
    assert get(case, 'variants', variant_type='unclassified').json()['total'] == 2
    assert get(case, 'variants', variant_type='unclassified', min_qual=0).json()['total'] == 1


def test_execution_metadata_and_storage_paths_never_leak(case):
    with case.factory.begin() as db:
        job = db.get(Job, case.identifier)
        job.parameter_pipeline = {'request': {'execution_mode': 'synthetic', 'variant_ploidy': True},
                                  'private_marker': '/private_marker/token'}
        analysis = db.scalar(select(Analysis))
        analysis.metrik_qc = '{"private_marker":"hidden"}'
        analysis.path_vcf = '/private_marker/result.vcf'
    for suffix in ['result', 'variants']:
        response = get(case, suffix)
        assert 'private_marker' not in response.text
        assert response.headers['cache-control'] == 'private, no-store'
        assert response.headers['pragma'] == 'no-cache'
    assert get(case).json()['parameters']['variant_ploidy'] is None


def test_queries_are_select_only_bounded_and_constant_in_page_size(case):
    statements = []
    def record(connection, cursor, statement, parameters, context, executemany):
        statements.append(statement)
    event.listen(case.engine, 'before_cursor_execute', record)
    try:
        for limit in (1, 4):
            statements.clear()
            page = results.variants(case.factory, case.identifier, 1,
                                    VariantQuery(limit=limit, min_qual=0))
            assert page.returned == limit
            assert len(statements) == 4
            assert all(s.lstrip().upper().startswith('SELECT') for s in statements)
            assert 'LIMIT' in statements[2] and 'OFFSET' in statements[2]
            assert 'ORDER BY variant.id_variant' in statements[2]
            assert 'variant.qual >=' in statements[1] and 'variant.qual >=' in statements[2]
            assert 'genotype.id_sample =' in statements[3] and ' IN (' in statements[3]
    finally:
        event.remove(case.engine, 'before_cursor_execute', record)


def test_database_errors_are_sanitized(case, monkeypatch):
    def unavailable(*args):
        raise OperationalError('private-sql-marker', {}, RuntimeError('private-driver-marker'))
    monkeypatch.setattr(results, 'owned_result', unavailable)
    for suffix in ['result', 'variants']:
        response = get(case, suffix)
        assert response.status_code == 503 and response.json() == {'detail': 'Service unavailable.'}
        assert 'private-' not in response.text


def test_openapi_documents_result_contract_and_bearer(case):
    schema = case.client.get('/openapi.json').json()
    for path in ['/jobs/{id_job}/result', '/jobs/{id_job}/variants']:
        assert schema['paths'][path]['get']['security'] == [{'HTTPBearer': []}]
        assert {'200', '401', '404', '409', '422', '503'} <= set(schema['paths'][path]['get']['responses'])
    parameters = {p['name']: p['schema'] for p in schema['paths']['/jobs/{id_job}/variants']['get']['parameters']}
    assert parameters['limit']['maximum'] == 500
    assert parameters['offset']['maximum'] == 2**31 - 1


def test_openapi_examples_keep_required_null_fields_and_validate_as_real_responses(case):
    schema = case.client.get('/openapi.json').json()
    for model in (ResultSummary, VariantPage):
        for example in schema['components']['schemas'][model.__name__]['examples']:
            assert model.model_validate(example).model_dump(mode='json') == example
    example = schema['components']['schemas']['VariantPage']['examples'][0]
    assert 'next_offset' in example and example['next_offset'] is None
