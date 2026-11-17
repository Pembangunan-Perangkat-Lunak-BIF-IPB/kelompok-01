import { Link } from 'react-router-dom';
import { ArrowUpRight, Plus, RefreshCw } from 'lucide-react';
import { useNarrowWorkspace } from '../hooks/useNarrowWorkspace';
import { useJobPolling } from '../hooks/useJobPolling';
import { useAuth } from '../context/auth';
import { PageHeader, Alert, StatePanel, Button } from '../components/ui/Foundation';
import { AnalysisRecord, AnalysisProvenance } from '../components/analysis/AnalysisRecord';
import { ResultOverview } from '../components/analysis/ResultOverview';
import type { JobItem } from '../services/api';

const latestFirst = (a: JobItem, b: JobItem) => {
  const end = (job: JobItem) => job.waktu_selesai ? new Date(job.waktu_selesai).getTime() : 0;
  return end(b) - end(a) || b.id_job - a.id_job;
};
export function DashboardPage() {
  const { user } = useAuth();
  const { jobs, error, loading, updated, reload } = useJobPolling();
  const active = jobs.filter(job => job.status === 'Running' || job.status === 'Queued');
  const failed = jobs.filter(job => job.status === 'Failed').sort((a,b) => b.id_job-a.id_job);
  const completed = jobs.filter(job => job.status === 'Completed').sort(latestFirst);
  const focus = completed[0] ?? active[0];
  const others = jobs.filter(job => job.id_job !== focus?.id_job).slice(0,4);
  const narrow = useNarrowWorkspace();
  const attentionFirst = narrow && (active.length > 0 || failed.length > 0);
  const attention = <aside key="attention" className="gp-attention" aria-labelledby="attention-title"><h2 id="attention-title">Perlu perhatian</h2>
          {active.length > 0 ? <section aria-label="Analisis aktif"><h3>{active.length} analisis aktif</h3>{active.map(job=><AnalysisRecord compact key={job.id_job} job={job}/>)}</section> : <p className="gp-quiet-state">Tidak ada Job aktif. Anda dapat menyiapkan analisis berikutnya.</p>}
          {failed.length > 0 && <section aria-label="Analisis gagal"><h3>{failed.length} analisis gagal</h3>{failed.slice(0,2).map(job=><AnalysisRecord compact key={job.id_job} job={job}/>)}</section>}
          {failed.length > 2 && <Link className="gp-data-title" to="/riwayat">Tinjau seluruh kegagalan di Riwayat</Link>}
          <p className="gp-attention-help">Status berasal dari Job, bukan estimasi progress per tahap.</p>
        </aside>;
  return <div className="gp-dashboard">
    <PageHeader title="Dashboard" description={<span>{user?.nama ? user.nama + ', ' : ''}analisis dan hasil Anda tetap terhubung di sini.</span>} actions={<><Button variant="secondary" className="gp-icon-button" aria-label="Segarkan Dashboard" onClick={reload}><RefreshCw size={17}/></Button><Link className="gp-link-button" to="/analisis-baru"><Plus size={17} aria-hidden="true"/>Analisis Baru</Link></>}/>
    {error && <Alert>{error}{jobs.length > 0 && ' Data terakhir ditampilkan; status mungkin sudah berubah.'}<Button variant="ghost" onClick={reload}>Coba muat ulang</Button></Alert>}
    {loading ? <StatePanel loading title="Memuat analisis Anda…"/> : <>
      {jobs.length > 0 && <div className="gp-research-grid">
        {attentionFirst && attention}
        <section key="focus" className="gp-analysis-focus" aria-labelledby="focus-title"><div className="gp-section-heading"><h2 id="focus-title">{completed.length ? 'Hasil terakhir' : active.length ? 'Analisis yang berjalan' : 'Hasil analisis'}</h2>{updated && <span className="gp-updated">Diperbarui {updated}</span>}</div>
          {focus ? <><AnalysisRecord job={focus}/>{focus.status === 'Completed' && (focus.has_result ? <ResultOverview key={focus.id_job} jobId={focus.id_job}/> : <p className="gp-biological-note">Job selesai, tetapi hasil belum tersedia. Periksa detail analisis.</p>)}<AnalysisProvenance job={focus}/></> : <div className="gp-no-result"><h3>Belum ada hasil Completed.</h3><p>Periksa penyebab kegagalan sebelum mengirim analisis baru.</p><Link className="gp-data-title" to="/analisis-baru">Siapkan Analisis Baru <ArrowUpRight size={16} aria-hidden="true"/></Link></div>}
        </section>
        {!attentionFirst && attention}

      </div>}
      {!jobs.length && !error && <section className="gp-first-analysis"><div><h2>Siap untuk analisis pertama?</h2><p>Hubungkan FASTQ single-end dengan reference yang tersedia. Konfigurasi tetap dapat Anda periksa sebelum menjalankan analisis.</p><Link className="gp-link-button" to="/analisis-baru">Mulai Analisis</Link></div><ol aria-label="Persiapan analisis pertama"><li><strong>FASTQ single-end</strong><span>Pilih berkas sampel Anda.</span></li><li><strong>Reference dan seleksi</strong><span>Tentukan reference, ploidi, QUAL dan FORMAT/DP.</span></li><li><strong>Monitoring dan hasil</strong><span>Pantau Job, lalu tinjau varian dan unduh VCF/CSV.</span></li></ol></section>}
      {others.length > 0 && <section className="gp-recent-records" aria-labelledby="recent-title"><div className="gp-section-heading"><h2 id="recent-title">Analisis lain</h2><Link className="gp-data-title" to="/riwayat">Semua riwayat <ArrowUpRight size={16} aria-hidden="true"/></Link></div>{others.map(job=><AnalysisRecord compact key={job.id_job} job={job}/>)}</section>}
    </>}
    <details className="gp-runtime-details"><summary>Dataset dan batas demonstrasi</summary><p>Demo memakai FASTQ sintetis dan reference 20 kbp. Batas unggah 10 MiB, satu analisis aktif global. Full Garlic.V2 dan FASTQ 1 GB belum tervalidasi.</p></details>
  </div>;
}
