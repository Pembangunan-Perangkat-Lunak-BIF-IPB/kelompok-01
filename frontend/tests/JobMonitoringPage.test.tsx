import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { JobMonitoringPage } from '../src/pages/JobMonitoringPage';
import { ApiError, getJob, getJobs, type JobItem } from '../src/services/api';

vi.mock('../src/context/auth', () => ({ useAuth: () => ({ token: 'test-token' }) }));
vi.mock('../src/services/api', async importOriginal => ({
  ...await importOriginal<typeof import('../src/services/api')>(), getJob: vi.fn(), getJobs: vi.fn(),
}));
const job: JobItem = { analysis_name: "Sampel Bawang A", analysis_number: 1, id_job: 8, id_sample: 9, id_reference_genome: 7, status: 'Queued', execution_mode: 'nextflow',
  waktu_mulai: null, waktu_selesai: null, pesan_error: null, has_result: false };
beforeEach(() => { vi.mocked(getJob).mockReset().mockResolvedValue(job); vi.mocked(getJobs).mockReset().mockResolvedValue([job]); });
function mount(path = '/jobs/8') {
  render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/jobs/:jobId" element={<JobMonitoringPage />} />
    <Route path="/dashboard" element={<JobMonitoringPage />} /></Routes></MemoryRouter>);
}
it('polls the selected Job endpoint and accurately distinguishes Queued from Running', async () => {
  mount(); await screen.findByText('Queued');
  expect(getJob).toHaveBeenCalledWith('8', 'test-token', expect.any(AbortSignal));
  expect(getJobs).not.toHaveBeenCalled();
  expect(screen.getByText(/belum berarti pipeline sedang berjalan/)).toBeTruthy();
  expect(screen.queryByRole('link', { name: 'Lihat Hasil' })).toBeNull();
});
it('shows failure reason in readable content', async () => {
  vi.mocked(getJob).mockResolvedValue({ ...job, status: 'Failed', pesan_error: 'Workflow execution failed.' });
  mount(); await screen.findByText('Workflow execution failed.');
});
it('offers result navigation only for Completed with a persisted result', async () => {
  vi.mocked(getJob).mockResolvedValue({ ...job, status: 'Completed', has_result: true });
  mount(); const link = await screen.findByRole('link', { name: 'Lihat Hasil' });
  expect(link.getAttribute('href')).toBe('/jobs/8/result');
});
it('does not present a fetch error as empty history', async () => {
  vi.mocked(getJobs).mockRejectedValue(new ApiError(503, 'Server unavailable.'));
  mount('/dashboard'); await screen.findByRole('alert');
  expect(screen.queryByText('Belum ada Job analisis.')).toBeNull();
});
