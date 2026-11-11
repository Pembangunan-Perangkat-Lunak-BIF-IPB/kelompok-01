import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Plus } from 'lucide-react';
import { useJobPolling } from '../hooks/useJobPolling';
import { PageHeader, Button, Alert, StatePanel } from '../components/ui/Foundation';
import { JobTable } from '../components/analysis/JobTable';

export function HistoryPage(){
 const {jobs,error,updated,loading,reload}=useJobPolling();
 const [search,setSearch]=useState(''),[status,setStatus]=useState('ALL');
 const visible=jobs.filter(job=>(status==='ALL'||job.status===status)&&(String(job.analysis_number??'').includes(search.trim())||(job.analysis_name??'').toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())));
 return <div><PageHeader title="Riwayat analisis" description="Temukan kembali analisis, tinjau status, dan buka hasil milik akun Anda." actions={<><Button variant="secondary" className="gp-icon-button" aria-label="Segarkan status" onClick={reload}><RefreshCw size={17}/></Button><Link className="gp-link-button" to="/analisis-baru"><Plus size={17}/>Analisis Baru</Link></>}/>
 {error&&<Alert>{error}{jobs.length>0&&' Data terakhir ditampilkan; status mungkin sudah berubah.'}</Alert>}
 <div className="gp-filterbar"><div><label htmlFor="job-search">Cari nama atau nomor analisis</label><input className="gp-input" id="job-search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Cari analisis Anda"/></div><div><label htmlFor="job-status">Status</label><select className="gp-input" id="job-status" value={status} onChange={event=>setStatus(event.target.value)}><option value="ALL">Semua</option>{['Queued','Running','Completed','Failed'].map(value=><option key={value}>{value}</option>)}</select></div>{(search||status!=='ALL')&&<Button variant="ghost" onClick={()=>{setSearch('');setStatus('ALL');}}>Reset filter</Button>}</div>
 {loading?<StatePanel loading title="Memuat status Job…"/>:visible.length?<JobTable jobs={visible}/>:!error&&<StatePanel title={jobs.length?'Tidak ada Job sesuai filter.':'Belum ada Job analisis.'} action={jobs.length?<Button variant="secondary" onClick={()=>{setSearch('');setStatus('ALL');}}>Reset filter</Button>:<Link className="gp-link-button" to="/analisis-baru">Mulai analisis pertama</Link>}>Setiap analisis yang Anda kirim akan tersimpan di sini.</StatePanel>}
 {updated&&<p className="gp-row-meta mt-4">Pembaruan otomatis setiap 4 detik. Terakhir diterima: {updated}</p>}
 </div>;
}
