import { ContextHelp } from '../components/ContextHelp';
import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Loader2, RefreshCcw, Play, Eye } from 'lucide-react';
import { useAuth } from '../context/auth';
import { getJob, getJobs, type JobItem } from '../services/api';

const time = (value: string | null) => value ? new Date(value).toLocaleString('id-ID') : '—';
export function JobMonitoringPage() {
  const { token } = useAuth();
  const { jobId } = useParams<{ jobId: string }>();
  const location = useLocation();
  const [refresh, setRefresh] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [state, setState] = useState<{ key: string; jobs: JobItem[]; error: string; updated: string }>({ key: '', jobs: [], error: '', updated: '' });
  const key = (jobId ?? 'all') + ':' + refresh;
  const valid = !jobId || (/^[1-9]\d*$/.test(jobId) && Number(jobId) <= 2 ** 31 - 1);
  useEffect(() => {
    if (!token || !valid) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const jobs = jobId ? [await getJob(jobId, token, controller.signal)] : await getJobs(token, controller.signal);
        if (!controller.signal.aborted) setState({ key, jobs, error: '', updated: new Date().toLocaleTimeString('id-ID') });
      } catch (error) {
        if (!controller.signal.aborted) setState(previous => ({
          key, jobs: previous.key === key ? previous.jobs : [], updated: previous.key === key ? previous.updated : '',
          error: error instanceof Error ? error.message : 'Status Job tidak dapat dimuat.',
        }));
      } finally { if (!controller.signal.aborted) timer = setTimeout(poll, 4000); }
    };
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [token, jobId, valid, key]);
  const loading = state.key !== key;
  const jobs = loading ? [] : state.jobs;
  const visible = jobs.filter(job => (status === 'ALL' || job.status === status) &&
    (String(job.id_job).includes(search.trim()) || String(job.id_sample).includes(search.trim())));
  const notification = (location.state as { notification?: string } | null)?.notification;
  const statusClass: Record<string, string> = {
    Queued: 'text-sky-800 dark:text-sky-300', Running: 'text-amber-800 dark:text-amber-300',
    Completed: 'text-emerald-800 dark:text-emerald-300', Failed: 'text-rose-800 dark:text-rose-300',
  };
  if (!valid) return <p role="alert" className="glass-card p-6 rounded-xl">ID Job tidak valid. <Link to="/dashboard" className="underline">Kembali ke dashboard</Link></p>;
  return <div className="space-y-6 max-w-6xl mx-auto py-4">
    {notification && <p role="status" className="glass-card p-4 rounded-xl">{notification}</p>}
    <header className="glass-card rounded-3xl p-6 flex flex-wrap justify-between gap-4">
      <div><h1 className="text-2xl font-black">{jobId ? 'Pemantauan Job #' + jobId : 'Dashboard Job Analisis'}</h1>
        <p className="text-sm mt-2">Pembaruan otomatis setiap 4 detik. {state.updated && !loading ? 'Terakhir diterima: ' + state.updated : ''}<ContextHelp label="Status Job">Queued: menunggu eksekusi. Running: pipeline sedang berjalan. Completed: analisis selesai; buka hasil untuk melihat parameter aktual. Failed: periksa pesan kegagalan sebelum mencoba analisis baru.</ContextHelp></p></div>
      <div className="flex items-center gap-3">
        <button type="button" aria-label="Segarkan status" className="glass-card rounded-xl p-3" onClick={() => setRefresh(value => value + 1)}><RefreshCcw className="w-4 h-4" /></button>
        <Link to="/analisis-baru" className="bg-blue-600 text-white rounded-xl px-4 py-3 text-sm font-bold"><Play className="inline w-4 h-4 mr-1" />Analisis Baru</Link>
      </div>
    </header>
    {jobId && <Link to="/dashboard" className="text-blue-700 dark:text-blue-300 underline">Semua riwayat Job saya</Link>}
    {!loading && state.error && <p role="alert" className="glass-card p-4 rounded-xl text-rose-800 dark:text-rose-300">{state.error}{jobs.length > 0 && ' Data terakhir ditampilkan; status mungkin sudah berubah.'}</p>}
    {!loading && !state.error && <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {[['Aktif / antrean', jobs.filter(job => job.status === 'Queued' || job.status === 'Running').length],
        ['Selesai', jobs.filter(job => job.status === 'Completed').length],
        ['Gagal', jobs.filter(job => job.status === 'Failed').length]].map(([label, count]) =>
        <div key={label} className="glass-card rounded-2xl p-5"><p className="text-sm">{label}</p><p className="text-3xl font-black">{count}</p></div>)}
    </div>}
    {!jobId && <div className="glass-card rounded-2xl p-4 flex flex-wrap gap-4 items-end">
      <div><label htmlFor="job-search" className="block text-sm mb-1">Cari ID Job atau Sample</label>
        <input id="job-search" value={search} onChange={event => setSearch(event.target.value)} className="glass-card rounded-xl px-3 py-2" /></div>
      <div><label htmlFor="job-status" className="block text-sm mb-1">Status</label>
        <select id="job-status" value={status} onChange={event => setStatus(event.target.value)} className="glass-card rounded-xl px-3 py-2">
          <option value="ALL">Semua</option>{['Queued', 'Running', 'Completed', 'Failed'].map(value => <option key={value}>{value}</option>)}
        </select></div>
    </div>}
    <section className="glass-card rounded-2xl overflow-hidden">
      {loading ? <p role="status" className="p-8"><Loader2 className="inline w-5 h-5 animate-spin mr-2" />Memuat status Job…</p> :
        visible.length === 0 ? !state.error && <p className="p-8">{jobs.length ? 'Tidak ada Job sesuai filter.' : 'Belum ada Job analisis.'}</p> :
          <div className="overflow-x-auto"><table className="w-full text-left text-sm">
            <thead><tr className="border-b border-slate-300 dark:border-slate-700">{['Job / Sample', 'Status', 'Mulai / Selesai', 'Aksi'].map(label => <th key={label} scope="col" className="p-4">{label}</th>)}</tr></thead>
            <tbody>{visible.map(job => <tr key={job.id_job} className="border-b border-slate-200 dark:border-slate-800">
              <td className="p-4 font-mono"><Link to={'/jobs/' + job.id_job} className="text-blue-700 dark:text-blue-300 underline">#{job.id_job}</Link><p>Sample #{job.id_sample}</p><p className="text-xs">Mode: {job.execution_mode ?? 'Tidak diketahui'}</p></td>
              <td className="p-4"><strong className={statusClass[job.status]}>{job.status}</strong>
                {job.status === 'Failed' && <p role="status" className="mt-2 max-w-sm">{job.pesan_error || 'Job gagal. Minta operator memeriksa log eksekusi.'}</p>}
                {job.status === 'Queued' && <p className="text-xs mt-2">Menunggu eksekusi; belum berarti pipeline sedang berjalan.</p>}</td>
              <td className="p-4"><p>Mulai: {time(job.waktu_mulai)}</p><p>Selesai: {time(job.waktu_selesai)}</p></td>
              <td className="p-4">{job.status === 'Completed' && job.has_result ?
                <Link className="text-blue-700 dark:text-blue-300 underline" to={'/jobs/' + job.id_job + '/result'}><Eye className="inline w-4 h-4 mr-1" />Lihat Hasil</Link> :
                job.status === 'Failed' ? <Link className="text-blue-700 dark:text-blue-300 underline" to="/analisis-baru">Analisis Baru</Link> :
                job.status === 'Completed' ? 'Hasil belum tersedia' : 'Pantau status'}</td>
            </tr>)}</tbody>
          </table></div>}
    </section>
  </div>;
}
export default JobMonitoringPage;
