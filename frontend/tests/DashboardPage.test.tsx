import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from '../src/pages/DashboardPage';
import { getJobs, type JobItem } from '../src/services/api';
vi.mock('../src/context/auth',()=>({useAuth:()=>({token:'test-token',user:{nama:'Nama dari API'}})}));
vi.mock('../src/services/api',async original=>({...await original<typeof import('../src/services/api')>(),getJobs:vi.fn()}));
const job:JobItem={id_job:99,id_sample:7,id_reference_genome:1,analysis_number:1,analysis_name:'Sampel dari API',status:'Completed',execution_mode:'nextflow',has_result:true,waktu_mulai:null,waktu_selesai:null,pesan_error:null};
beforeEach(()=>{ vi.mocked(getJobs).mockReset(); });
it('uses account data for the ledger and actual global IDs for links',async()=>{
 vi.mocked(getJobs).mockResolvedValue([job]);render(<MemoryRouter><DashboardPage/></MemoryRouter>);
 const link=await screen.findByRole('link',{name:'Sampel dari API'});expect(link.getAttribute('href')).toBe('/jobs/99');expect(screen.getByRole('link',{name:'Lihat Hasil'}).getAttribute('href')).toBe('/jobs/99/result');
 expect(getJobs).toHaveBeenCalledWith('test-token',expect.any(AbortSignal));expect(screen.getByText(/Nama dari API/)).toBeTruthy();
 const ledger=screen.getByLabelText('Ringkasan seluruh analisis akun');expect([...ledger.querySelectorAll('dd')].map(x=>x.textContent)).toEqual(['0','1','0']);
});
it('distinguishes an empty account from a fetch failure',async()=>{
 vi.mocked(getJobs).mockResolvedValue([]);render(<MemoryRouter><DashboardPage/></MemoryRouter>);await screen.findByText('Siap untuk analisis pertama?');expect(screen.queryByRole('alert')).toBeNull();
});
it('does not present invented zero counts after an API failure',async()=>{
 vi.mocked(getJobs).mockRejectedValue(new Error('API unavailable'));render(<MemoryRouter><DashboardPage/></MemoryRouter>);await screen.findByRole('alert');expect(screen.queryByLabelText('Ringkasan seluruh analisis akun')).toBeNull();expect(screen.queryByText('Siap untuk analisis pertama?')).toBeNull();
});
