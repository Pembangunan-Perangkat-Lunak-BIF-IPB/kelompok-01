import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from '../src/pages/DashboardPage';
import { getJobs, getJobResult, type JobItem, type JobResultSummary } from '../src/services/api';
vi.mock('../src/context/auth',()=>({useAuth:()=>({token:'test-token',user:{nama:'Nama dari API'}})}));
vi.mock('../src/services/api',async original=>({...await original<typeof import('../src/services/api')>(),getJobs:vi.fn(),getJobResult:vi.fn()}));
const job:JobItem={id_job:99,id_sample:7,id_reference_genome:1,analysis_number:1,analysis_name:'Sampel dari API',status:'Completed',execution_mode:'nextflow',has_result:true,waktu_mulai:null,waktu_selesai:'2026-11-11T08:00:00Z',pesan_error:null};
const result:JobResultSummary={id_job:99,id_analysis:42,id_sample:7,id_reference_genome:1,status:'Completed',execution_mode:'nextflow',waktu_mulai:null,waktu_selesai:job.waktu_selesai,counts:{total_variants:3,snps:2,indels:1,other:0,unclassified:0},parameters:{parameter_qual:25,parameter_dp:8,require_pass:true,variant_ploidy:2},reference:{id_reference_genome:1,nama_genom:'Reference dari API',versi:'v1',sumber:'genopath:synthetic-fixture'}};
beforeEach(()=>{vi.mocked(getJobs).mockReset();vi.mocked(getJobResult).mockReset().mockResolvedValue(result);});
afterEach(()=>vi.unstubAllGlobals());
const mount=()=>render(<MemoryRouter><DashboardPage/></MemoryRouter>);
it('leads with an actual completed record, provenance and server counts, not a metrics ledger',async()=>{
 vi.mocked(getJobs).mockResolvedValue([job]);mount();
 const region=await screen.findByRole('region',{name:'Hasil terakhir'});
 expect(within(region).getByRole('link',{name:'Sampel dari API'}).getAttribute('href')).toBe('/jobs/99');
 expect(within(region).getByRole('link',{name:'Lihat Hasil'}).getAttribute('href')).toBe('/jobs/99/result');
 await within(region).findByText('3 record varian');expect(within(region).getByText('Reference dari API')).toBeTruthy();
 expect(getJobs).toHaveBeenCalledWith('test-token',expect.any(AbortSignal));expect(getJobResult).toHaveBeenCalledWith(99,'test-token',expect.any(AbortSignal));
 expect(screen.getByText(/Nama dari API/)).toBeTruthy();expect(screen.queryByLabelText('Ringkasan seluruh analisis akun')).toBeNull();
 expect(within(region).getByText(/FORMAT\/DP ≥ 8/)).toBeTruthy();expect(within(region).getByText(/bukan validasi biologis/)).toBeTruthy();
});
it('chooses the latest completion by timestamp rather than API order or global ID',async()=>{
 vi.mocked(getJobs).mockResolvedValue([{...job,id_job:105,analysis_name:'Lebih lama',waktu_selesai:'2026-11-10T08:00:00Z'},job]);mount();
 const region=await screen.findByRole('region',{name:'Hasil terakhir'});expect(within(region).getByRole('link',{name:'Sampel dari API'})).toBeTruthy();
 expect(getJobResult).toHaveBeenCalledWith(99,'test-token',expect.any(AbortSignal));
});
it('exposes real active and failed jobs with monitoring actions, no fictional stage progress',async()=>{
 vi.mocked(getJobs).mockResolvedValue([job,{...job,id_job:100,analysis_name:'Sedang diproses',status:'Running',has_result:false},{...job,id_job:101,analysis_name:'Input bermasalah',status:'Failed',has_result:false,pesan_error:'VCF output failed validation.'}]);mount();
 const area=await screen.findByRole('complementary',{name:'Perlu perhatian'});
 expect(within(area).getByRole('link',{name:'Pantau status'}).getAttribute('href')).toBe('/jobs/100');
 expect(within(area).getByRole('link',{name:'Periksa kegagalan'}).getAttribute('href')).toBe('/jobs/101');
 expect(within(area).getByText('VCF output failed validation.')).toBeTruthy();expect(screen.queryByRole('progressbar')).toBeNull();
});
it('supports a first job still queued without requesting a nonexistent result',async()=>{
 vi.mocked(getJobs).mockResolvedValue([{...job,status:'Queued',has_result:false}]);mount();
 const area=await screen.findByRole('region',{name:'Analisis yang berjalan'});expect(within(area).getByText('Menunggu eksekusi')).toBeTruthy();expect(getJobResult).not.toHaveBeenCalled();
});
it('keeps Completed-without-result distinct from a valid downloadable result',async()=>{
 vi.mocked(getJobs).mockResolvedValue([{...job,has_result:false}]);mount();await screen.findByText(/Job selesai, tetapi hasil belum tersedia/);
 expect(screen.queryByRole('link',{name:'Lihat Hasil'})).toBeNull();expect(getJobResult).not.toHaveBeenCalled();
});
it('distinguishes an empty account from a fetch failure',async()=>{
 vi.mocked(getJobs).mockResolvedValue([]);mount();await screen.findByText('Siap untuk analisis pertama?');expect(screen.queryByRole('alert')).toBeNull();expect(getJobResult).not.toHaveBeenCalled();
});
it('does not present invented empty results after a jobs API failure',async()=>{
 vi.mocked(getJobs).mockRejectedValue(new Error('API unavailable'));mount();await screen.findByRole('alert');expect(screen.queryByText('Siap untuk analisis pertama?')).toBeNull();expect(screen.queryByText(/record varian/)).toBeNull();
});
it('preserves job metadata when the result summary fails, without fake zero counts',async()=>{
 vi.mocked(getJobs).mockResolvedValue([job]);vi.mocked(getJobResult).mockRejectedValue(new Error('Result unavailable'));mount();await screen.findByText(/Result unavailable/);
 expect(screen.getByRole('link',{name:'Sampel dari API'})).toBeTruthy();expect(screen.queryByText('0 record varian')).toBeNull();
});
it('keeps failed-only accounts actionable without claiming a completed result',async()=>{
 vi.mocked(getJobs).mockResolvedValue([{...job,status:'Failed',has_result:false,pesan_error:'Workflow execution failed.'}]);mount();await screen.findByText('Belum ada hasil Completed.');expect(screen.getAllByText('Workflow execution failed.').length).toBeGreaterThan(0);expect(getJobResult).not.toHaveBeenCalled();
});

it('places actionable attention before completed work in mobile DOM and keyboard order',async()=>{
 vi.stubGlobal('matchMedia',vi.fn(()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
 vi.mocked(getJobs).mockResolvedValue([job,{...job,id_job:100,analysis_name:'Aktif',status:'Running',has_result:false}]);mount();
 const attention=await screen.findByRole('complementary',{name:'Perlu perhatian'});const focus=screen.getByRole('region',{name:'Hasil terakhir'});
 expect(attention.compareDocumentPosition(focus)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
it('keeps the quiet no-active state after completed work on mobile',async()=>{
 vi.stubGlobal('matchMedia',vi.fn(()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
 vi.mocked(getJobs).mockResolvedValue([job]);mount();const focus=await screen.findByRole('region',{name:'Hasil terakhir'});const attention=screen.getByRole('complementary',{name:'Perlu perhatian'});
 expect(focus.compareDocumentPosition(attention)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
