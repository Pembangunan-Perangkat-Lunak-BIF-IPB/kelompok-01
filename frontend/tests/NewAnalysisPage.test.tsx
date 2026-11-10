import { beforeEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { NewAnalysisPage } from '../src/pages/NewAnalysisPage';
import { ApiError, getJobOptions, submitAnalysis } from '../src/services/api';
import { loadDraft, makeParameters, saveDraft } from '../src/services/submissionDraft';

vi.mock('../src/context/auth', () => ({ useAuth: () => ({ token: 'test-token', user: { username: 'tester' } }) }));
vi.mock('../src/services/api', async importOriginal => ({
  ...await importOriginal<typeof import('../src/services/api')>(),
  getJobOptions: vi.fn(), submitAnalysis: vi.fn(),
}));
const options = { pipeline_enabled: true, alignment_strategy: 'bowtie2', upload_max_bytes: 1_000_000_000, variant_ploidies: [1, 2],
  references: [{ id_reference_genome: 7, nama_genom: 'Reference uji kontrak', versi: 'test', sumber: 'fixture' }] };
const file = new File(['@r\nACGT\n+\nIIII\n'], 'reads.fastq', { lastModified: 123 });
const accepted = (id: string) => ({ request_id: id, submission_status: 'accepted' as const, sample: null,
  job: { id_job: 8, id_sample: 9, id_reference_genome: 7, status: 'Queued' as const, execution_mode: 'nextflow' as const,
    has_result: false, waktu_mulai: null, waktu_selesai: null, pesan_error: null }, dispatch_scheduled: true, detail: null });
beforeEach(() => {
  vi.mocked(getJobOptions).mockReset().mockResolvedValue(options);
  vi.mocked(submitAnalysis).mockReset().mockImplementation(async (_file, _token, parameters) => accepted(parameters.request_id));
});
function mount() {
  return render(<MemoryRouter><Routes>
    <Route path="/" element={<NewAnalysisPage />} />
    <Route path="/jobs/:jobId" element={<h1>Monitoring tujuan</h1>} />
  </Routes></MemoryRouter>);
}
async function configure() {
  const user = userEvent.setup();
  await screen.findByRole('option', { name: /Reference uji/ });
  await user.selectOptions(screen.getByLabelText('Genom reference'), '7');
  await user.selectOptions(screen.getByLabelText('Ploidi untuk variant calling'), '2');
  await user.upload(screen.getByLabelText('Pilih atau seret berkas FASTQ'), file);
  return user;
}
it('selects/configures without POST, submits once, then navigates to the acknowledged Job', async () => {
  let finish!: (value: ReturnType<typeof accepted>) => void;
  vi.mocked(submitAnalysis).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  mount(); const user = await configure();
  expect(submitAnalysis).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: /Pengaturan lanjutan/ }));
  await user.clear(screen.getByLabelText('Minimum QUAL')); await user.type(screen.getByLabelText('Minimum QUAL'), '42.5');
  await user.clear(screen.getByLabelText('Minimum FORMAT/DP')); await user.type(screen.getByLabelText('Minimum FORMAT/DP'), '0');
  const form = screen.getByRole('button', { name: 'Jalankan Analisis' }).closest('form')!;
  act(() => { fireEvent.submit(form); fireEvent.submit(form); });
  await waitFor(() => expect(submitAnalysis).toHaveBeenCalledTimes(1));
  const parameters = vi.mocked(submitAnalysis).mock.calls[0][2];
  expect(parameters).toMatchObject({ id_reference_genome: 7, parameter_qual: 42.5, parameter_dp: 0, variant_ploidy: 2, execution_mode: 'nextflow' });
  expect(loadDraft('tester')?.parameters.request_id).toBe(parameters.request_id);
  await act(async () => finish(accepted(parameters.request_id)));
  await screen.findByRole('heading', { name: 'Monitoring tujuan' });
  expect(loadDraft('tester')).toBeNull();
});
it('locks configuration after an ambiguous failure and retries the exact UUID', async () => {
  vi.mocked(submitAnalysis).mockRejectedValueOnce(new ApiError(0, 'Koneksi terputus.'));
  mount(); const user = await configure();
  await user.click(screen.getByRole('button', { name: 'Jalankan Analisis' }));
  await screen.findByText('Koneksi terputus.');
  expect((screen.getByLabelText('Genom reference') as HTMLSelectElement).matches(':disabled')).toBe(true);
  const id = vi.mocked(submitAnalysis).mock.calls[0][2].request_id;
  await user.click(screen.getByRole('button', { name: 'Kirim ulang submission yang sama' }));
  await screen.findByRole('heading', { name: 'Monitoring tujuan' });
  expect(vi.mocked(submitAnalysis).mock.calls[1][2].request_id).toBe(id);
});
it('restores pending configuration after reload and refuses a different file', async () => {
  const parameters = makeParameters({ reference: '7', ploidy: '1', qual: '22', dp: '4', filename: file.name });
  saveDraft('tester', { parameters, file: { name: file.name, size: file.size, lastModified: file.lastModified }, reconciliation: false });
  mount(); const user = userEvent.setup();
  await screen.findByRole('option', { name: /Reference uji/ });
  const input = screen.getByLabelText(/Pilih kembali FASTQ/);
  await user.upload(input, new File(['different'], 'other.fastq', { lastModified: 123 }));
  await screen.findByText(/Pilih kembali berkas yang sama/);
  expect(submitAnalysis).not.toHaveBeenCalled();
  await user.upload(input, file);
  await user.click(screen.getByRole('button', { name: 'Kirim ulang submission yang sama' }));
  await screen.findByRole('heading', { name: 'Monitoring tujuan' });
  expect(vi.mocked(submitAnalysis).mock.calls[0][2]).toEqual(parameters);
});
it('blocks further upload/retry on reconciliation_required, preserving the journal', async () => {
  vi.mocked(submitAnalysis).mockImplementationOnce(async (_file, _token, parameters) => {
    throw new ApiError(503, 'Perlu rekonsiliasi.', null, { ...accepted(parameters.request_id), job: null, submission_status: 'reconciliation_required' });
  });
  mount(); const user = await configure();
  await user.click(screen.getByRole('button', { name: 'Jalankan Analisis' }));
  await screen.findByText(/Hasil pengiriman memerlukan rekonsiliasi operator/);
  expect((screen.getByRole('button', { name: 'Kirim ulang submission yang sama' }) as HTMLButtonElement).disabled).toBe(true);
  expect(loadDraft('tester')?.reconciliation).toBe(true);
  expect(submitAnalysis).toHaveBeenCalledTimes(1);
});
it('does not send when the recovery journal cannot be persisted', async () => {
  mount(); const user = await configure();
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage unavailable'); });
  await user.click(screen.getByRole('button', { name: 'Jalankan Analisis' }));
  await screen.findByText('Storage unavailable');
  expect(submitAnalysis).not.toHaveBeenCalled();
});
it.each([413, 422])('unlocks a definitive HTTP %s rejection for a corrected submission with a new UUID', async status => {
  vi.mocked(submitAnalysis).mockRejectedValueOnce(new ApiError(status, 'Input ditolak.'));
  mount(); const user = await configure();
  await user.click(screen.getByRole('button', { name: 'Jalankan Analisis' }));
  await screen.findByText('Input ditolak.');
  const firstId = vi.mocked(submitAnalysis).mock.calls[0][2].request_id;
  expect(loadDraft('tester')).toBeNull();
  expect((screen.getByLabelText('Genom reference') as HTMLSelectElement).matches(':disabled')).toBe(false);
  await user.click(screen.getByRole('button', { name: 'Jalankan Analisis' }));
  await screen.findByRole('heading', { name: 'Monitoring tujuan' });
  expect(vi.mocked(submitAnalysis).mock.calls[1][2].request_id).not.toBe(firstId);
});

it('collapses Advanced without losing custom thresholds or posting, and resets explicitly', async () => {
  mount(); const user = await configure();
  const toggle = screen.getByRole('button', { name: /Pengaturan lanjutan/ });
  await user.click(toggle);
  await user.clear(screen.getByLabelText('Minimum QUAL')); await user.type(screen.getByLabelText('Minimum QUAL'), '42');
  await user.clear(screen.getByLabelText('Minimum FORMAT/DP')); await user.type(screen.getByLabelText('Minimum FORMAT/DP'), '7');
  await user.click(toggle);
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  expect(screen.queryByLabelText('Minimum QUAL')).toBeNull();
  expect(screen.getByText(/Konfigurasi khusus/).textContent).toContain('QUAL ≥ 42');
  expect(submitAnalysis).not.toHaveBeenCalled();
  await user.click(toggle);
  expect((screen.getByLabelText('Minimum QUAL') as HTMLInputElement).value).toBe('42');
  await user.click(screen.getByRole('button', { name: /Reset threshold/ }));
  expect((screen.getByLabelText('Minimum QUAL') as HTMLInputElement).value).toBe('30');
  expect((screen.getByLabelText('Minimum FORMAT/DP') as HTMLInputElement).value).toBe('10');
  expect(submitAnalysis).not.toHaveBeenCalled();
});

it('shows field validation and blocks submission before persisting any UUID', async () => {
  mount(); const user = await configure();
  await user.click(screen.getByRole('button', { name: /Pengaturan lanjutan/ }));
  await user.clear(screen.getByLabelText('Minimum FORMAT/DP'));
  await user.type(screen.getByLabelText('Minimum FORMAT/DP'), '1.5');
  expect(screen.getByRole('alert').textContent).toContain('bilangan bulat');
  expect(screen.getByLabelText('Minimum FORMAT/DP').getAttribute('aria-invalid')).toBe('true');
  const submit = screen.getByRole('button', { name: 'Jalankan Analisis' });
  expect((submit as HTMLButtonElement).disabled).toBe(true);
  await user.click(screen.getByRole('button', { name: /Pengaturan lanjutan/ }));
  expect(screen.getByRole('alert').textContent).toContain('Buka pengaturan lanjutan');
  fireEvent.submit(submit.closest('form')!);
  expect(submitAnalysis).not.toHaveBeenCalled();
  expect(loadDraft('tester')).toBeNull();
});

it('submits visible custom summary values even when Advanced is collapsed', async () => {
  mount(); const user = await configure();
  const toggle = screen.getByRole('button', { name: /Pengaturan lanjutan/ });
  await user.click(toggle);
  await user.clear(screen.getByLabelText('Minimum QUAL')); await user.type(screen.getByLabelText('Minimum QUAL'), '25');
  await user.clear(screen.getByLabelText('Minimum FORMAT/DP')); await user.type(screen.getByLabelText('Minimum FORMAT/DP'), '8');
  await user.click(toggle);
  await user.click(screen.getByRole('button', { name: 'Jalankan Analisis' }));
  await screen.findByRole('heading', { name: 'Monitoring tujuan' });
  expect(submitAnalysis).toHaveBeenCalledTimes(1);
  expect(vi.mocked(submitAnalysis).mock.calls[0][2]).toMatchObject({ parameter_qual: 25, parameter_dp: 8 });
});
