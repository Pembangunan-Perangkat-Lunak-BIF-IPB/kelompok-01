import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, downloadJobResult, getJobVariants, submitAnalysis, validateFile } from '../src/services/api';
import { clearDraft, loadDraft, makeParameters, matchesFile, saveDraft } from '../src/services/submissionDraft';
import { pageCsv } from '../src/services/resultExport';
import type { VariantItem } from '../src/services/api';

const values = { reference: '7', ploidy: '1', qual: '17.5', dp: '0', filename: 'reads.fastq.gz' };
const parameters = makeParameters(values, '00000000-0000-4000-8000-000000000001');
const file = new File(['@r\nACGT\n+\nIIII\n'], values.filename, { lastModified: 100 });
afterEach(() => vi.unstubAllGlobals());

describe('submission contract and recovery', () => {
  it('uses one multipart submission with actual parameters and no chained create/start requests', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      request_id: parameters.request_id, submission_status: 'accepted', dispatch_scheduled: true,
      job: { id_job: 8, status: 'Queued' }, sample: { id_sample: 9 }, detail: null,
    }), { status: 202 }));
    vi.stubGlobal('fetch', fetcher);
    await submitAnalysis(file, 'test-token', parameters);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    const parsed = new URL(url, 'http://localhost');
    expect(parsed.pathname).toBe('/api/samples/upload-and-run');
    expect(Object.fromEntries(parsed.searchParams)).toEqual(Object.fromEntries(Object.entries(parameters).map(([k, v]) => [k, String(v)])));
    expect(init.method).toBe('POST');
    expect(init.headers.get('Authorization')).toBe('Bearer test-token');
    expect(init.headers.has('Content-Type')).toBe(false);
    expect([...init.body.keys()]).toEqual(['file']);
  });
  it.each(['sample_stored', 'reconciliation_required'])('preserves structured %s failures', async status => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      request_id: parameters.request_id, submission_status: status, sample: { id_sample: 9 }, job: null,
      dispatch_scheduled: false, detail: 'Do not change UUID.',
    }), { status: 503 })));
    try { await submitAnalysis(file, 'test-token', parameters); expect.fail('Expected partial failure'); }
    catch (error) { expect(error).toBeInstanceOf(ApiError); expect((error as ApiError).submission?.submission_status).toBe(status); }
  });
  it('rejects unconfirmed successful HTTP responses and wrong UUIDs', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      request_id: 'different', submission_status: 'accepted', job: { id_job: 8 },
    }), { status: 202 })));
    await expect(submitAnalysis(file, 'test-token', parameters)).rejects.toMatchObject({ status: 503 });
  });
  it('does not claim success for a queued Job without acknowledged dispatch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      request_id: parameters.request_id, submission_status: 'accepted', dispatch_scheduled: false,
      job: { id_job: 8, status: 'Queued' },
    }), { status: 202 })));
    await expect(submitAnalysis(file, 'test-token', parameters)).rejects.toMatchObject({ status: 503 });
  });
  it('reports network ambiguity without inventing success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network')));
    await expect(submitAnalysis(file, 'test-token', parameters)).rejects.toMatchObject({ status: 0 });
  });
  it('clears expired auth and notifies the provider', async () => {
    localStorage.setItem('access_token', 'test-token');
    const listener = vi.fn(); window.addEventListener('genopath:unauthorized', listener);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
    await expect(getJobVariants(3, {}, 'test-token')).rejects.toMatchObject({ status: 401 });
    expect(localStorage.getItem('access_token')).toBeNull(); expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener('genopath:unauthorized', listener);
  });
  it('sends supported result filters including zero thresholds before pagination', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}')); vi.stubGlobal('fetch', fetcher);
    await getJobVariants(3, { limit: 10, offset: 20, min_qual: 0, max_qual: 42, variant_type: 'unclassified' }, 'test-token');
    const query = new URL(fetcher.mock.calls[0][0], 'http://localhost').searchParams;
    expect(Object.fromEntries(query)).toEqual({ limit: '10', offset: '20', min_qual: '0', max_qual: '42', variant_type: 'unclassified' });
  });
});
describe('file validation and immutable submission draft', () => {
  it.each([{ dp: '1.5' }, { dp: '-1' }, { dp: '2147483648' }, { qual: '' }, { qual: 'Infinity' }, { qual: '-1' }, { reference: '' }, { ploidy: '3' }])('rejects invalid configuration %j', change => {
    expect(() => makeParameters({ ...values, ...change })).toThrow();
  });
  it('keeps identity and parameters across reload and scopes drafts to the account', () => {
    const draft = { parameters, file: { name: file.name, size: file.size, lastModified: file.lastModified }, reconciliation: false };
    saveDraft('one', draft);
    expect(loadDraft('one')).toEqual(draft); expect(loadDraft('two')).toBeNull();
    expect(matchesFile(draft, file)).toBe(true);
    expect(matchesFile(draft, new File(['other'], file.name, { lastModified: 100 }))).toBe(false);
    clearDraft('one'); expect(loadDraft('one')).toBeNull();
  });
  it('does not discard an unreadable pending journal', () => {
    sessionStorage.setItem('genopath:submission:one', 'invalid');
    expect(() => loadDraft('one')).toThrow(/operator/);
    expect(sessionStorage.getItem('genopath:submission:one')).toBe('invalid');
  });
  it('rejects unsupported casing, empty files, and size overflow', () => {
    expect(() => validateFile(new File(['x'], 'reads.FASTQ'))).toThrow();
    expect(() => validateFile(new File([], 'reads.fastq'))).toThrow();
    expect(() => validateFile(file, 1)).toThrow();
  });
});
describe('owned result download contract', () => {
  it('exports server filters without frontend pagination or query credentials', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('CHROM,POS\r\nchr1,42\r\n', { headers: { 'Content-Disposition': 'attachment; filename="GenoPath_Analisis-1_Sampel_filtered.csv"' } }));
    vi.stubGlobal('fetch', fetcher);
    const blob = await downloadJobResult(3, 'csv', 'private-test-token', {
      limit: 10, offset: 20, min_qual: 0, variant_type: 'snp',
    });
    const [url, options] = fetcher.mock.calls[0];
    expect(Object.fromEntries(new URL(url, 'http://localhost').searchParams)).toEqual({ variant_type: 'snp', min_qual: '0' });
    expect(url).not.toContain('private-test-token');
    expect(options.headers.Authorization).toBe('Bearer private-test-token');
    expect(blob.blob.size).toBeGreaterThan(0);
  });
  it('downloads the complete selected VCF independently of table filters', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('##fileformat=VCFv4.2\n', { headers: { 'Content-Disposition': 'attachment; filename="GenoPath_Analisis-1_Sampel_selected.vcf"' } }));
    vi.stubGlobal('fetch', fetcher);
    await downloadJobResult(3, 'vcf', 'private-test-token', { min_qual: 999, offset: 10 });
    expect(fetcher.mock.calls[0][0]).toBe('/api/jobs/3/vcf');
  });
  it.each([401, 404, 409])('rejects HTTP %i instead of creating a pretend file', async status => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: 'Result unavailable.' }), { status })));
    await expect(downloadJobResult(3, 'vcf', 'private-test-token')).rejects.toMatchObject({ status });
  });
});
it('exports only supplied rows with valid CSV escaping, original ALT/GT, nulls, and safe spreadsheet cells', () => {
  const variant: VariantItem = { id_variant: 1, chromosome: '=unsafe,"contig"\nline', position: 42, ref_allele: 'A', alt_allele: 'C,AT',
    qual: null, variant_type: 'other', filter_status: null, info: null,
    genotypes: [{ id_genotype: 1, id_sample: 2, genotype_call: '1|2', dp: null }] };
  const csv = pageCsv([variant]);
  expect(csv).toContain('"C,AT"'); expect(csv).toContain('"1|2"');
  expect(csv).toContain('"' + "'=unsafe," + '""contig""\nline"');
  expect(csv).not.toContain('0/1'); expect(csv).not.toContain('undefined');
});

it('honors server download filenames and rejects unsafe or missing names', async () => {
  const filename = 'GenoPath_Analisis-2_Sampel-Bawang-A_filtered.csv';
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('a,b', { headers: { 'Content-Disposition': 'attachment; filename="' + filename + '"' } })));
  expect((await downloadJobResult(10, 'csv', 'test-token')).filename).toBe(filename);
  for (const disposition of ['', 'attachment; filename="../unsafe.csv"']) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('a,b', { headers: { 'Content-Disposition': disposition } })));
    await expect(downloadJobResult(10, 'csv', 'test-token')).rejects.toMatchObject({ status: 503 });
  }
});
