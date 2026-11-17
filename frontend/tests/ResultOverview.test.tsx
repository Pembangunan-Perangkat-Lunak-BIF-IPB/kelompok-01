import { beforeEach, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { ResultOverview } from '../src/components/analysis/ResultOverview';
import { getJobResult, type JobResultSummary } from '../src/services/api';
const auth=vi.hoisted(()=>({token:'account-a'}));
vi.mock('../src/context/auth',()=>({useAuth:()=>auth}));
vi.mock('../src/services/api',async original=>({...await original<typeof import('../src/services/api')>(),getJobResult:vi.fn()}));
const result=(total:number):JobResultSummary=>({id_job:1,id_analysis:1,id_sample:1,id_reference_genome:1,status:'Completed',execution_mode:'nextflow',waktu_mulai:null,waktu_selesai:null,counts:{total_variants:total,snps:total,indels:0,other:0,unclassified:0},parameters:{parameter_qual:30,parameter_dp:10,require_pass:null,variant_ploidy:null}});
beforeEach(()=>{auth.token='account-a';vi.mocked(getJobResult).mockReset();});
it('aborts and suppresses an old account response after account context changes',async()=>{
 let resolveOld!:(value:JobResultSummary)=>void;
 vi.mocked(getJobResult).mockImplementationOnce(()=>new Promise(resolve=>{resolveOld=resolve;})).mockResolvedValueOnce(result(2));
 const view=render(<ResultOverview jobId={1}/>);const oldSignal=vi.mocked(getJobResult).mock.calls[0][2];
 auth.token='account-b';view.rerender(<ResultOverview jobId={1}/>);
 await screen.findByText('2 record varian');await act(async()=>resolveOld(result(99)));
 expect(oldSignal?.aborted).toBe(true);expect(screen.queryByText('99 record varian')).toBeNull();
});
it('shows true zero results and unavailable metadata without inventing defaults',async()=>{
 vi.mocked(getJobResult).mockResolvedValue(result(0));render(<ResultOverview jobId={1}/>);await screen.findByText('0 record varian');expect(screen.getByText(/Ploidi: Tidak tersedia/)).toBeTruthy();expect(screen.getByText(/FILTER tidak tersedia/)).toBeTruthy();
});
