import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Play, 
  CheckCircle2, 
  Dna, 
  Search, 
  Loader2, 
  FileText,
  XCircle,
  Clock,
  RefreshCcw,
  Eye,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getJobs, ApiError, type JobItem } from '../services/api';

export const JobMonitoringPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, isAuthenticated } = useAuth();

  // State Data & UI
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // State Filter & Search
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Notifikasi dari redirect
  const notificationState = (location.state as { notification?: string })?.notification;

  // Fungsi Fetching Data Job dari Backend FastAPI
  const fetchJobs = useCallback(async (showLoader = false) => {
    if (!token) return;

    if (showLoader) setLoading(true);
    setRefreshing(true);
    setErrorMessage(null);

    try {
      const data = await getJobs(token);
      setJobs(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Gagal terhubung ke server backend FastAPI.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  // Initial Fetch & Auto-Polling (Setiap 4 Detik)
  useEffect(() => {
    if (isAuthenticated && token) {
      fetchJobs(true);

      const interval = setInterval(() => {
        fetchJobs(false);
      }, 4000);

      return () => clearInterval(interval);
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, token, fetchJobs]);

  // Normalisasi Status Job (Case Insensitive Support)
  const getNormalizedStatus = (status?: string): string => {
    return (status || '').toUpperCase();
  };

  // Kalkulasi Metrik Ringkasan Dinamis
  const activeJobsCount = jobs.filter((j) => {
    const s = getNormalizedStatus(j.status);
    return s === 'QUEUED' || s === 'RUNNING';
  }).length;

  const completedJobsCount = jobs.filter(
    (j) => getNormalizedStatus(j.status) === 'COMPLETED'
  ).length;

  const failedJobsCount = jobs.filter(
    (j) => getNormalizedStatus(j.status) === 'FAILED'
  ).length;

  // Logika Filter & Pencarian
  const filteredJobs = jobs.filter((job) => {
    const statusUpper = getNormalizedStatus(job.status);
    const searchLower = searchTerm.toLowerCase();
    const jobIdStr = String(job.id_job ?? job.job_id ?? job.id ?? '');
    const sampleIdStr = String(job.id_sample ?? job.sample_id ?? '');
    const errorMsg = String((job as unknown as Record<string, unknown>).error_message ?? job.pesan_error ?? '');

    const matchesSearch = 
      jobIdStr.toLowerCase().includes(searchLower) ||
      sampleIdStr.toLowerCase().includes(searchLower) ||
      errorMsg.toLowerCase().includes(searchLower);

    const matchesStatus = statusFilter === 'ALL' || statusUpper === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-4">
      
      {/* Notifikasi Sukses dari Upload */}
      {notificationState && (
        <div className="bg-emerald-500/15 border border-emerald-500/40 backdrop-blur-xl rounded-2xl p-4 text-emerald-950 dark:text-emerald-200 text-sm font-extrabold flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{notificationState}</span>
          </div>
        </div>
      )}

      {/* HEADER HALAMAN & TOMBOL ANALISIS BARU */}
      <div className="bg-white/45 dark:bg-slate-900/55 backdrop-blur-2xl rounded-3xl p-6 md:p-7 border border-white/60 dark:border-slate-800/60 shadow-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="text-xs md:text-sm font-mono text-blue-700 dark:text-blue-400 font-black uppercase tracking-wider mb-1.5 flex items-center gap-2">
            <span>GENOPATH DAEMON • MONITORING & STATUS PIPELINE</span>
            {refreshing && <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />}
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-950 dark:text-white tracking-tight">
            Dashboard Pemantauan Job Analisis
          </h1>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => fetchJobs(false)}
            className="p-3.5 rounded-2xl bg-white/60 dark:bg-slate-800/60 hover:bg-white/90 dark:hover:bg-slate-800 border border-white/80 dark:border-slate-700 text-slate-950 dark:text-slate-100 font-bold transition-all shadow-md cursor-pointer"
            title="Segarkan Manual"
          >
            <RefreshCcw className={`w-5 h-5 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          <Link
            to="/analisis-baru"
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black px-6 py-3.5 rounded-2xl text-sm md:text-base shadow-lg shadow-blue-600/30 backdrop-blur-md transition-all cursor-pointer shrink-0"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>Buat Analisis Baru</span>
          </Link>
        </div>
      </div>

      {/* GRID 3 RINGKASAN METRIK DINAMIS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Metrik 1: Job Aktif / Antrean */}
        <div className="bg-white/45 dark:bg-slate-900/55 backdrop-blur-xl rounded-3xl p-6 border border-white/60 dark:border-slate-800/60 shadow-xl flex flex-col justify-between space-y-4">
          <div className="flex justify-between items-center text-xs md:text-sm font-mono text-slate-900 dark:text-slate-200 uppercase font-black">
            <span>JOB AKTIF & ANTREAN</span>
            <span className={`w-3 h-3 rounded-full ${activeJobsCount > 0 ? 'bg-amber-500 animate-pulse' : 'bg-slate-400 dark:bg-slate-600'}`}></span>
          </div>
          <div>
            <div className="text-4xl md:text-5xl font-black text-slate-950 dark:text-white">{activeJobsCount} Job</div>
            <span className="inline-block mt-3 bg-amber-500/20 text-amber-950 dark:text-amber-300 px-3 py-1.5 rounded-xl text-xs md:text-sm font-extrabold border border-amber-500/40 backdrop-blur-md">
              {activeJobsCount > 0 ? 'Sedang Diproses Pipeline' : 'Tidak Ada Job Berjalan'}
            </span>
          </div>
        </div>

        {/* Metrik 2: Analisis Selesai */}
        <div className="bg-white/45 dark:bg-slate-900/55 backdrop-blur-xl rounded-3xl p-6 border border-white/60 dark:border-slate-800/60 shadow-xl flex flex-col justify-between space-y-4">
          <div className="flex justify-between items-center text-xs md:text-sm font-mono text-slate-900 dark:text-slate-200 uppercase font-black">
            <span>ANALISIS SELESAI</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <div className="text-4xl md:text-5xl font-black text-slate-950 dark:text-white">{completedJobsCount} Berhasil</div>
            <span className="inline-block mt-3 bg-emerald-500/20 text-emerald-950 dark:text-emerald-300 px-3 py-1.5 rounded-xl text-xs md:text-sm font-extrabold border border-emerald-500/40 backdrop-blur-md">
              VCF & Varian Tersimpan
            </span>
          </div>
        </div>

        {/* Metrik 3: Total Submisi & Job Gagal */}
        <div className="bg-white/45 dark:bg-slate-900/55 backdrop-blur-xl rounded-3xl p-6 border border-white/60 dark:border-slate-800/60 shadow-xl flex flex-col justify-between space-y-4">
          <div className="flex justify-between items-center text-xs md:text-sm font-mono text-slate-900 dark:text-slate-200 uppercase font-black">
            <span>TOTAL JOB SUBMISI</span>
            <Dna className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <div className="text-4xl md:text-5xl font-black text-slate-950 dark:text-white">{jobs.length} Total</div>
            <span className={`inline-block mt-3 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs md:text-sm font-extrabold border ${
              failedJobsCount > 0 
                ? 'bg-rose-500/20 text-rose-950 dark:text-rose-300 border-rose-500/40' 
                : 'bg-blue-500/20 text-blue-950 dark:text-blue-300 border-blue-500/40'
            }`}>
              {failedJobsCount > 0 ? `${failedJobsCount} Job Gagal` : '100% Sukses Rate'}
            </span>
          </div>
        </div>

      </div>

      {/* BAR FILTER DAN PENCARIAN */}
      <div className="bg-white/45 dark:bg-slate-900/55 backdrop-blur-xl rounded-2xl p-4 md:p-5 border border-white/60 dark:border-slate-800/60 shadow-xl flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-3 text-sm md:text-base font-black text-slate-950 dark:text-slate-100">
            <span>Status Job:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white/70 dark:bg-slate-800/70 text-slate-950 dark:text-slate-100 rounded-xl px-4 py-2.5 text-xs md:text-sm font-black border border-slate-300/80 dark:border-slate-700/70 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer backdrop-blur-md shadow-sm"
            >
              <option value="ALL" className="bg-white dark:bg-slate-900">Semua Status</option>
              <option value="QUEUED" className="bg-white dark:bg-slate-900">Queued (Antrean)</option>
              <option value="RUNNING" className="bg-white dark:bg-slate-900">Running (Berjalan)</option>
              <option value="COMPLETED" className="bg-white dark:bg-slate-900">Completed (Selesai)</option>
              <option value="FAILED" className="bg-white dark:bg-slate-900">Failed (Gagal)</option>
            </select>
          </div>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="w-5 h-5 text-slate-600 dark:text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Cari ID Job atau Sample..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/70 dark:bg-slate-800/70 text-slate-950 dark:text-slate-100 text-xs md:text-sm font-black rounded-xl pl-10 pr-4 py-2.5 border border-slate-300/80 dark:border-slate-700/70 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-500 dark:placeholder:text-slate-400 backdrop-blur-md shadow-sm font-mono"
          />
        </div>
      </div>

      {/* PESAN ERROR API */}
      {errorMessage && (
        <div className="p-4 bg-rose-500/15 border border-rose-500/40 backdrop-blur-md rounded-2xl text-rose-950 dark:text-rose-200 text-xs md:text-sm font-extrabold flex items-center gap-3 shadow-sm">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* TABEL RIWAYAT EKSEKUSI JOB (TABLE-FIXED & ALIGNMENT FIX) */}
      <div className="bg-white/45 dark:bg-slate-900/55 backdrop-blur-2xl rounded-3xl overflow-hidden border border-white/60 dark:border-slate-800/60 shadow-2xl">
        {/* Header Seksi Kartu */}
        <div className="px-6 py-4 border-b border-slate-200/80 dark:border-slate-800/60 bg-white/60 dark:bg-slate-800/60 backdrop-blur-md">
          <h2 className="text-sm md:text-base font-black text-slate-950 dark:text-slate-100 flex items-center gap-2.5 font-mono">
            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Tabel Riwayat Eksekusi Job Backend FastAPI
          </h2>
        </div>

        {loading ? (
          <div className="p-12 text-center space-y-3 bg-white/45 dark:bg-slate-900/55 backdrop-blur-xl">
            <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin mx-auto" />
            <p className="text-sm font-black text-slate-950 dark:text-white">
              Mengambil data job dari server...
            </p>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="p-12 text-center space-y-3 bg-white/45 dark:bg-slate-900/55 backdrop-blur-xl">
            <FileText className="w-8 h-8 text-slate-600 dark:text-slate-400 mx-auto opacity-70" />
            <p className="text-sm font-black text-slate-950 dark:text-white">
              {jobs.length === 0 ? 'Belum ada job analisis yang dibuat.' : 'Tidak ada job yang sesuai dengan pencarian/filter.'}
            </p>
            {jobs.length === 0 && (
              <Link
                to="/analisis-baru"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs md:text-sm shadow-lg mt-2"
              >
                Buat Job Analisis Pertama
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Properti table-fixed memaksa seluruh kolom persis sejajar */}
            <table className="w-full table-fixed text-left border-collapse font-mono">
              <thead>
                <tr className="bg-slate-200/60 dark:bg-slate-800/70 border-b border-slate-300/70 dark:border-slate-700/60 text-slate-950 dark:text-slate-100 text-xs md:text-sm font-black tracking-wide">
                  <th className="py-4 px-6 w-[16%] align-middle">ID Job</th>
                  <th className="py-4 px-6 w-[22%] align-middle">Sample ID</th>
                  <th className="py-4 px-6 w-[28%] align-middle">Status Pipeline</th>
                  <th className="py-4 px-6 w-[14%] align-middle">Waktu Buat</th>
                  <th className="py-4 px-6 w-[20%] align-middle text-right">Aksi & Hasil</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/50 text-xs md:text-sm">
                {filteredJobs.map((job) => {
                  const jobId = job.id_job ?? job.job_id ?? job.id ?? 0;
                  const sampleId = job.id_sample ?? job.sample_id ?? 0;
                  const statusUpper = getNormalizedStatus(job.status);
                  const errMessage = String((job as unknown as Record<string, unknown>).error_message ?? job.pesan_error ?? '');
                  const createdAtFormatted = job.created_at ? new Date(job.created_at).toLocaleString('id-ID') : '-';

                  return (
                    <tr key={jobId} className="hover:bg-white/70 dark:hover:bg-slate-800/60 transition-colors font-bold align-middle">
                      
                      {/* ID Job */}
                      <td className="py-4 px-6 text-blue-900 dark:text-blue-400 font-black text-sm md:text-base align-middle truncate">
                        #JOB-{jobId}
                      </td>

                      {/* Sample ID */}
                      <td className="py-4 px-6 text-slate-950 dark:text-white font-black text-sm md:text-base align-middle truncate">
                        Sample #{sampleId}
                      </td>

                      {/* Badge Status */}
                      <td className="py-4 px-6 align-middle">
                        {statusUpper === 'QUEUED' && (
                          <span className="inline-flex items-center gap-2 bg-sky-500/20 text-sky-950 dark:text-sky-300 font-black px-3 py-1.5 rounded-xl text-xs md:text-sm border border-sky-500/40 backdrop-blur-md">
                            <Clock className="w-4 h-4 text-sky-700 dark:text-sky-400 shrink-0" />
                            <span>QUEUED (Antrean)</span>
                          </span>
                        )}

                        {statusUpper === 'RUNNING' && (
                          <span className="inline-flex items-center gap-2 bg-amber-500/20 text-amber-950 dark:text-amber-300 font-black px-3 py-1.5 rounded-xl text-xs md:text-sm border border-amber-500/40 backdrop-blur-md">
                            <Loader2 className="w-4 h-4 animate-spin text-amber-700 dark:text-amber-400 shrink-0" />
                            <span>RUNNING (Memproses)</span>
                          </span>
                        )}

                        {statusUpper === 'COMPLETED' && (
                          <span className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-950 dark:text-emerald-300 font-black px-3 py-1.5 rounded-xl text-xs md:text-sm border border-emerald-500/40 backdrop-blur-md">
                            <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                            <span>COMPLETED (Selesai)</span>
                          </span>
                        )}

                        {statusUpper === 'FAILED' && (
                          <span className="inline-flex items-center gap-2 bg-rose-500/20 text-rose-950 dark:text-rose-300 font-black px-3 py-1.5 rounded-xl text-xs md:text-sm border border-rose-500/40 backdrop-blur-md" title={errMessage}>
                            <XCircle className="w-4 h-4 text-rose-700 dark:text-rose-400 shrink-0" />
                            <span>FAILED (Gagal)</span>
                          </span>
                        )}
                      </td>

                      {/* Waktu Pembuatan */}
                      <td className="py-4 px-6 text-slate-800 dark:text-slate-300 font-black text-xs md:text-sm align-middle truncate">
                        {createdAtFormatted}
                      </td>

                      {/* Aksi & Navigasi Hasil */}
                      <td className="py-4 px-6 text-right font-bold align-middle">
                        {statusUpper === 'COMPLETED' && (
                          <button
                            type="button"
                            onClick={() => navigate(`/jobs/${jobId}/result`)}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs md:text-sm px-4 py-2 rounded-xl shadow-md transition-all inline-flex items-center gap-2 cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                            <span>Lihat Varian & Hasil</span>
                          </button>
                        )}

                        {(statusUpper === 'RUNNING' || statusUpper === 'QUEUED') && (
                          <span className="text-slate-700 dark:text-slate-400 text-xs md:text-sm italic font-black">
                            Pipeline berjalan...
                          </span>
                        )}

                        {statusUpper === 'FAILED' && (
                          <Link
                            to="/analisis-baru"
                            className="text-rose-700 dark:text-rose-400 hover:underline font-black text-xs md:text-sm inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <RefreshCcw className="w-4 h-4" />
                            <span>Coba Unggah Ulang</span>
                          </Link>
                        )}
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

export default JobMonitoringPage;