import { Link, useLocation, useParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { ContextHelp } from '../components/ContextHelp';
import { Alert, Button, PageHeader, StatePanel } from '../components/ui/Foundation';
import { JobTable } from '../components/analysis/JobTable';
import { useJobPolling } from '../hooks/useJobPolling';
import { HistoryPage } from './HistoryPage';

function JobDetail({jobId}:{jobId:string}){
 const {jobs,error,updated,loading,valid,reload}=useJobPolling(jobId);const {state}=useLocation();
 const notification=(state as {notification?:string}|null)?.notification;
 if(!valid)return <Alert>ID Job tidak valid. <Link to="/riwayat">Kembali ke riwayat</Link></Alert>;
 return <div><Link className="gp-data-title text-sm" to="/riwayat">Semua riwayat analisis saya</Link>
 <PageHeader title={jobs[0]?.analysis_name??'Pemantauan analisis'} description={<>{jobs[0]?.analysis_number&&<>Analisis #{jobs[0].analysis_number} · </>}Pembaruan otomatis setiap 4 detik. {updated&&'Terakhir diterima: '+updated}<ContextHelp label="Status Job">Queued: menunggu eksekusi. Running: pipeline sedang berjalan. Completed: analisis selesai; buka hasil untuk melihat parameter aktual. Failed: periksa pesan kegagalan sebelum mencoba analisis baru.</ContextHelp></>} actions={<Button variant="secondary" className="gp-icon-button" aria-label="Segarkan status" onClick={reload}><RefreshCw size={17}/></Button>}/>
 {notification&&<Alert tone="info">{notification}</Alert>}{error&&<Alert>{error}{jobs.length>0&&' Data terakhir ditampilkan; status mungkin sudah berubah.'}</Alert>}
 {loading?<StatePanel loading title="Memuat status Job…"/>:jobs.length>0&&<JobTable jobs={jobs}/>}
 </div>;
}
export function JobMonitoringPage(){const {jobId}=useParams<{jobId:string}>();return jobId?<JobDetail jobId={jobId}/>:<HistoryPage/>;}
export default JobMonitoringPage;
