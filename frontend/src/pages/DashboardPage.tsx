import { Link } from 'react-router-dom';
import { ArrowUpRight, Plus } from 'lucide-react';
import { useJobPolling } from '../hooks/useJobPolling';
import { useAuth } from '../context/auth';
import { PageHeader, Alert, StatePanel, Button } from '../components/ui/Foundation';
import { JobTable } from '../components/analysis/JobTable';

export function DashboardPage(){
 const {user}=useAuth();const {jobs,error,loading,reload}=useJobPolling();
 return <div><PageHeader title="Dashboard" description={<span>Selamat datang{user?.nama?', '+user.nama:''}. Lanjutkan analisis Anda atau mulai dari sampel baru.</span>} actions={<Link className="gp-link-button" to="/analisis-baru"><Plus size={17}/>Analisis Baru</Link>}/>
 {error&&<Alert>{error}{jobs.length>0&&' Data terakhir ditampilkan; status mungkin sudah berubah.'}<Button variant="ghost" onClick={reload}>Coba muat ulang</Button></Alert>}
 {loading?<StatePanel loading title="Memuat analisis Anda…"/>:<>
 {!error&&<dl className="gp-ledger" aria-label="Ringkasan seluruh analisis akun">{[['Aktif / antrean',jobs.filter(job=>job.status==='Queued'||job.status==='Running').length],['Selesai',jobs.filter(job=>job.status==='Completed').length],['Gagal',jobs.filter(job=>job.status==='Failed').length]].map(([label,count])=><div key={label}><dt>{label}</dt><dd>{count}</dd></div>)}</dl>}
 <div className="gp-section-title"><h2>Analisis terbaru</h2><Link className="gp-data-title text-sm" to="/riwayat">Semua riwayat <ArrowUpRight className="inline" size={16}/></Link></div>
 {jobs.length?<JobTable jobs={jobs.slice(0,3)}/>:!error&&<StatePanel title="Siap untuk analisis pertama?" action={<Link className="gp-link-button" to="/analisis-baru">Mulai Analisis</Link>}>Pilih FASTQ single-end dan tentukan konfigurasi. Analisis hanya dimulai saat Anda menjalankannya.</StatePanel>}
 </>}
 <section className="gp-section mt-10"><h2>Ruang kerja yang dapat ditelusuri</h2><p className="gp-muted gp-dashboard-intro">Berkas, konfigurasi, status, dan hasil tetap terhubung pada analisis yang sama. Buka riwayat untuk meninjau kembali hasil atau mengunduh VCF dan CSV.</p><details className="mt-5 gp-demo-note"><summary className="cursor-pointer">Dataset dan batas demonstrasi</summary><p className="mt-2">Demo memakai FASTQ sintetis dan reference 20 kbp. Batas unggah 10 MiB, satu analisis aktif global. Full Garlic.V2 dan FASTQ 1 GB belum tervalidasi.</p></details></section>
 </div>;
}
