import { beforeEach, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { JobResultPage } from '../src/pages/JobResultPage';
import { ApiError, getJobResult, getJobVariants, type JobResultSummary, type JobVariantsResponse, type VariantItem } from '../src/services/api';

vi.mock('../src/context/auth', () => ({ useAuth: () => ({ token: 'test-token' }) }));
vi.mock('../src/services/api', async importOriginal => ({
  ...await importOriginal<typeof import('../src/services/api')>(),
  getJobResult: vi.fn(), getJobVariants: vi.fn(),
}));
const variant: VariantItem = { id_variant: 1, chromosome: 'contig-contract', position: 42, ref_allele: 'A', alt_allele: 'C,AT',
  qual: null, variant_type: 'other', filter_status: null, info: null,
  genotypes: [{ id_genotype: 1, id_sample: 9, genotype_call: '1|2', dp: null }] };
const summary: JobResultSummary = { id_job: 8, id_analysis: 2, id_sample: 9, id_reference_genome: 7,
  status: 'Completed', execution_mode: 'nextflow', waktu_mulai: null, waktu_selesai: null,
  parameters: { parameter_qual: 17.5, parameter_dp: 0, variant_ploidy: 1, require_pass: true },
  counts: { total_variants: 11, snps: 10, indels: 0, other: 1, unclassified: 0 } };
const page = (items = [variant], changes = {}): JobVariantsResponse => ({
  id_job: 8, id_analysis: 2, items, total: 11, limit: 10, offset: 0, returned: items.length,
  has_more: true, next_offset: 10, filters: { variant_type: null, min_qual: null, max_qual: null }, ...changes,
});
beforeEach(() => {
  vi.mocked(getJobResult).mockReset().mockResolvedValue(summary);
  vi.mocked(getJobVariants).mockReset().mockResolvedValue(page());
});
function mount() {
  return render(<MemoryRouter initialEntries={['/jobs/8/result']}><Routes>
    <Route path="/jobs/:jobId/result" element={<JobResultPage />} />
  </Routes></MemoryRouter>);
}
it('renders actual parameters, nullable values, original multiallelic ALT/GT and honest export scope', async () => {
  mount();
  await screen.findByText('C,AT');
  expect(screen.getByText('1|2')).toBeTruthy();
  expect(screen.getByText(/Sample #9/)).toBeTruthy();
  expect(screen.getByText(/Reference ID: #7/)).toBeTruthy();
  expect(screen.getByText(/QUAL ≥ 17.5; FORMAT\/DP ≥ 0/)).toBeTruthy();
  expect(screen.queryByText(/Heterozygous/)).toBeNull();
  expect(screen.queryByText('98.4%')).toBeNull();
  expect(screen.queryByText('2.41')).toBeNull();
  expect(screen.queryByText('27.8x')).toBeNull();
  expect(screen.queryByText(/VERIFIED-OK|ASM12345/)).toBeNull();
  expect((screen.getByRole('button', { name: /Unduh VCF/ }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole('button', { name: 'Ekspor halaman ini (CSV)' })).toBeTruthy();
  expect(screen.getByText(/CSV hanya memuat halaman tabel/)).toBeTruthy();
});
it('does not invent a genotype or type for missing legacy values', async () => {
  vi.mocked(getJobVariants).mockResolvedValue(page([{ ...variant, variant_type: null, genotypes: [] }]));
  mount(); await screen.findByText('C,AT');
  expect(screen.queryByText('0/1')).toBeNull();
  expect(screen.queryByText(/Heterozygous/)).toBeNull();
});
it('distinguishes unavailable results from a successful empty result', async () => {
  vi.mocked(getJobResult).mockRejectedValue(new ApiError(409, 'Hasil belum tersedia.'));
  vi.mocked(getJobVariants).mockRejectedValue(new ApiError(409, 'Hasil belum tersedia.'));
  mount(); await screen.findAllByText('Hasil belum tersedia.');
  expect(screen.queryByText('Total record varian')).toBeNull();
  expect(screen.queryByText(/Tidak ada record yang cocok/)).toBeNull();
  expect((screen.getByRole('button', { name: 'Ekspor halaman ini (CSV)' }) as HTMLButtonElement).disabled).toBe(true);
});
it('keeps synthetic execution visibly labelled', async () => {
  vi.mocked(getJobResult).mockResolvedValue({ ...summary, execution_mode: 'synthetic' });
  mount(); await screen.findByText(/DATA SINTETIS/);
});
it('pages on the server and resets offset when a supported filter is applied', async () => {
  vi.mocked(getJobVariants).mockImplementation(async (_id, params) => params.offset === 10 ?
    page([{ ...variant, id_variant: 2, chromosome: 'last-page' }], { offset: 10, has_more: false, next_offset: null }) : page());
  mount(); const user = userEvent.setup(); await screen.findByText('C,AT');
  await user.click(screen.getByRole('button', { name: 'Selanjutnya' }));
  await screen.findByText('last-page');
  expect((screen.getByRole('button', { name: 'Selanjutnya' }) as HTMLButtonElement).disabled).toBe(true);
  await user.selectOptions(screen.getByLabelText('Tipe varian'), 'other');
  await user.type(screen.getByLabelText('QUAL minimum'), '17.5');
  await user.click(screen.getByRole('button', { name: 'Terapkan filter' }));
  await waitFor(() => expect(vi.mocked(getJobVariants).mock.lastCall?.[1]).toMatchObject({ offset: 0, min_qual: 17.5, variant_type: 'other' }));
  expect(screen.queryByPlaceholderText(/Cari kromosom/)).toBeNull();
});
it('ignores an older filter response that finishes after the latest request', async () => {
  let oldResolve!: (value: JobVariantsResponse) => void;
  vi.mocked(getJobVariants).mockImplementation(async (_id, params) => {
    if (params.variant_type === 'snp') return new Promise(resolve => { oldResolve = resolve; });
    if (params.variant_type === 'indel') return page([{ ...variant, chromosome: 'current-result' }]);
    return page();
  });
  mount(); const user = userEvent.setup(); await screen.findByText('C,AT');
  await user.selectOptions(screen.getByLabelText('Tipe varian'), 'snp');
  await user.click(screen.getByRole('button', { name: 'Terapkan filter' }));
  await user.selectOptions(screen.getByLabelText('Tipe varian'), 'indel');
  await user.click(screen.getByRole('button', { name: 'Terapkan filter' }));
  await screen.findByText('current-result');
  await act(async () => oldResolve(page([{ ...variant, chromosome: 'obsolete-result' }])));
  expect(screen.queryByText('obsolete-result')).toBeNull();
  expect(screen.getByText('current-result')).toBeTruthy();
});
