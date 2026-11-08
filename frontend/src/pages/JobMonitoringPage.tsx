import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Play, 
  CheckCircle2, 
  Dna, 
  Search, 
  AlertTriangle, 
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

  // Fungsi Fetching Data Job dari Backend
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

  // Kalkulasi Metrik Ringkasan Dinamis
  const activeJobsCount = jobs.filter((j) => j.status === 'QUEUED' || j.status === 'RUNNING').length;
  const completedJobsCount = jobs.filter((j) => j.status === 'COMPLETED').length;
  const failedJobsCount = jobs.filter((j) => j.status === 'FAILED').length;

  // Logika Filter & Pencarian (Bebas TS2352)
  const filteredJobs = jobs.filter((job) => {
    const searchLower = searchTerm.toLowerCase();
    const jobIdStr = String(job.id_job ?? job.id ?? '');
    const sampleIdStr = String(job.id_sample ?? job.sample_id ?? '');
    const errorMsg = String((job as unknown as Record<string, unknown>).error_message ?? '');

    const matchesSearch = 
      jobIdStr.toLowerCase().includes(searchLower) ||
      sampleIdStr.toLowerCase().includes(searchLower) ||
      errorMsg.toLowerCase().includes(searchLower);

    const matchesStatus = statusFilter === 'ALL' || job.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-4 px-4">
      
      {/* Banner Peringatan Konkurensi */}
      <div className="glass-card rounded-2xl p-4 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-3 transition-all border border-amber-200/60 dark:border-amber-900/40">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="font-bold">Informasi Eksekusi Pipeline (M8/M9):</strong>
          <br />
          Setiap job FASTQ yang diunggah akan diproses secara bertahap melalui Nextflow (Fastp QC ➔ Bowtie2 Alignment ➔ SAMtools ➔ BCFtools Variant Calling). Status job diperbarui secara otomatis secara real-time.
        </div>
      </div>

      {/* Notifikasi Sukses dari Upload */}
      {notificationState && (
        <div className="p-4 bg-emerald-50/90 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{notificationState}</span>
          </div>
        </div>
      )}

      {/* Header Halaman & Tombol Analisis Baru */}
      <div className="glass-card rounded-2xl p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all">
        <div>
          <div className="text-xs font-mono text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-2">
            <span>GENOPATH DAEMON • MONITORING & STATUS PIPELINE</span>
            {refreshing && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />}
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            Dashboard Pemantauan Job Analisis
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Kelola dan pantau status pipeline variant calling berkas FASTQ Anda secara real-time.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => fetchJobs(false)}
            className="p-2.5 glass-card hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Segarkan Manual"
          >
            <RefreshCcw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          <Link
            to="/analisis-baru"
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-md shadow-blue-500/20 transition-all cursor-pointer shrink-0"
          >
            <Play className="w-4 h-4 fill-current" /> Buat Analisis Baru
          </Link>
        </div>
      </div>

      {/* Grid 3 Ringkasan Metrik Dinamis */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Metrik 1: Job Aktif / Antrean */}
        <div className="glass-card glass-card-hover rounded-2xl p-5 space-y-3">
          <div className="flex justify-between items-center text-xs font-mono text-slate-500 dark:text-slate-400 uppercase font-bold">
            <span>JOB AKTIF & ANTREAN</span>
            <span className={`w-2.5 h-2.5 rounded-full ${activeJobsCount > 0 ? 'bg-amber-400' : 'bg-slate-300 dark:bg-slate-700'}`}></span>
          </div>
          <div>
            <div className="text-3xl font-black text-slate-900 dark:text-slate-100">{activeJobsCount} Job</div>
            <span className="inline-block mt-2 glass-card text-amber-700 dark:text-amber-400 px-2.5 py-1 rounded-full text-xs font-semibold border border-amber-200/60 dark:border-amber-800/60">
              {activeJobsCount > 0 ? 'Sedang Diproses Nextflow' : 'Tidak Ada Job Berjalan'}
            </span>
          </div>
          <div className="pt-2 border-t border-slate-300/40 dark:border-slate-800/60 text-xs font-mono text-slate-500 dark:text-slate-400 flex justify-between">
            <span>Mode: Nextflow SE</span>
            <span>Auto-Polling: 4s</span>
          </div>
        </div>

        {/* Metrik 2: Analisis Selesai */}
        <div className="glass-card glass-card-hover rounded-2xl p-5 space-y-3">
          <div className="flex justify-between items-center text-xs font-mono text-slate-500 dark:text-slate-400 uppercase font-bold">
            <span>ANALISIS SELESAI</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <div className="text-3xl font-black text-slate-900 dark:text-slate-100">{completedJobsCount} Berhasil</div>
            <span className="inline-block mt-2 glass-card text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded-full text-xs font-semibold border border-emerald-200/60 dark:border-emerald-800/60">
              VCF & Varian Tersimpan (M9)
            </span>
          </div>
          <div className="pt-2 border-t border-slate-300/40 dark:border-slate-800/60 text-xs font-mono text-slate-500 dark:text-slate-400 flex justify-between">
            <span>Database: PostgreSQL</span>
            <span>Result API: Siap</span>
          </div>
        </div>

        {/* Metrik 3: Total Submisi & Job Gagal */}
        <div className="glass-card glass-card-hover rounded-2xl p-5 space-y-3">
          <div className="flex justify-between items-center text-xs font-mono text-slate-500 dark:text-slate-400 uppercase font-bold">
            <span>TOTAL JOB SUBMISI</span>
            <Dna className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <div className="text-3xl font-black text-slate-900 dark:text-slate-100">{jobs.length} Total</div>
            <span className={`inline-block mt-2 glass-card px-2.5 py-1 rounded-full text-xs font-semibold border ${
              failedJobsCount > 0 
                ? 'text-rose-700 dark:text-rose-400 border-rose-200/60 dark:border-rose-800/60' 
                : 'text-blue-700 dark:text-blue-400 border-blue-200/60 dark:border-blue-800/60'
            }`}>
              {failedJobsCount > 0 ? `${failedJobsCount} Job Gagal` : '100% Sukses Rate'}
            </span>
          </div>
          <div className="pt-2 border-t border-slate-300/40 dark:border-slate-800/60 text-xs font-mono text-slate-500 dark:text-slate-400 flex justify-between">
            <span>Organisme: A. sativum</span>
            <span>Reference Genome ID: #1</span>
          </div>
        </div>

      </div>

      {/* Bar Filter & Pencarian */}
      <div className="glass-card rounded-2xl p-4 flex flex-col md:flex-row gap-3 justify-between items-center transition-all">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
            <span>Status Job:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="glass-card text-slate-800 dark:text-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="ALL" className="dark:bg-slate-900">Semua Status</option>
              <option value="QUEUED" className="dark:bg-slate-900">Queued (Antrean)</option>
              <option value="RUNNING" className="dark:bg-slate-900">Running (Berjalan)</option>
              <option value="COMPLETED" className="dark:bg-slate-900">Completed (Selesai)</option>
              <option value="FAILED" className="dark:bg-slate-900">Failed (Gagal)</option>
            </select>
          </div>
        </div>

        {/* Input Text Cari */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cari ID Job atau Sample..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full glass-card text-slate-800 dark:text-slate-200 text-xs rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Pesan Error API */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Tabel Riwayat Pekerjaan (Jobs) */}
      <div className="glass-card rounded-2xl overflow-hidden shadow-sm transition-all">
        <div className="px-5 py-4 border-b border-slate-300/40 dark:border-slate-800/60 flex justify-between items-center bg-white/20 dark:bg-slate-800/20">
          <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            Tabel Riwayat Eksekusi Job Backend FastAPI
          </h2>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
            Auto-Polling: 4s
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Mengambil data job dari server...
            </p>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <FileText className="w-8 h-8 text-slate-400 mx-auto opacity-50" />
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {jobs.length === 0 ? 'Belum ada job analisis yang dibuat.' : 'Tidak ada job yang sesuai dengan pencarian/filter.'}
            </p>
            {jobs.length === 0 && (
              <Link
                to="/analisis-baru"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-md mt-2"
              >
                Buat Job Analisis Pertama
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-200/40 dark:bg-slate-800/40 border-b border-slate-300/40 dark:border-slate-800/60 text-slate-600 dark:text-slate-400 font-mono text-xs">
                <tr>
                  <th className="py-3.5 px-5">ID Job</th>
                  <th className="py-3.5 px-5">Sample ID</th>
                  <th className="py-3.5 px-5">Status Pipeline</th>
                  <th className="py-3.5 px-5">Waktu Buat</th>
                  <th className="py-3.5 px-5 text-right">Aksi & Hasil (M9)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/30 dark:divide-slate-800/40 text-slate-700 dark:text-slate-300">
                {filteredJobs.map((job) => {
                  const jobId = job.id_job ?? job.id ?? 0;
                  const sampleId = job.id_sample ?? job.sample_id ?? 0;
                  const errMessage = String((job as unknown as Record<string, unknown>).error_message ?? '');
                  const createdAtFormatted = job.created_at ? new Date(job.created_at).toLocaleString('id-ID') : '-';

                  return (
                    <tr key={jobId} className="hover:bg-white/40 dark:hover:bg-slate-800/40 transition-colors">
                      
                      {/* ID Job */}
                      <td className="py-4 px-5 font-mono font-bold text-blue-600 dark:text-blue-400">
                        #JOB-{jobId}
                      </td>

                      {/* Sample ID */}
                      <td className="py-4 px-5 font-mono text-slate-900 dark:text-slate-100 font-medium">
                        Sample #{sampleId}
                      </td>

                      {/* Badge Status */}
                      <td className="py-4 px-5">
                        {job.status === 'QUEUED' && (
                          <span className="inline-flex items-center gap-1.5 glass-card text-sky-700 dark:text-sky-400 font-semibold px-2.5 py-1 rounded-full text-xs border border-sky-200/60 dark:border-sky-800/60">
                            <Clock className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                            QUEUED (Antrean)
                          </span>
                        )}

                        {job.status === 'RUNNING' && (
                          <span className="inline-flex items-center gap-1.5 glass-card text-amber-700 dark:text-amber-400 font-semibold px-2.5 py-1 rounded-full text-xs border border-amber-200/60 dark:border-amber-800/60">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600 dark:text-amber-400" />
                            RUNNING (Memproses)
                          </span>
                        )}

                        {job.status === 'COMPLETED' && (
                          <span className="inline-flex items-center gap-1.5 glass-card text-emerald-700 dark:text-emerald-400 font-semibold px-2.5 py-1 rounded-full text-xs border border-emerald-200/60 dark:border-emerald-800/60">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            COMPLETED (Selesai)
                          </span>
                        )}

                        {job.status === 'FAILED' && (
                          <span className="inline-flex items-center gap-1.5 glass-card text-rose-700 dark:text-rose-400 font-semibold px-2.5 py-1 rounded-full text-xs border border-rose-200/60 dark:border-rose-800/60" title={errMessage}>
                            <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                            FAILED (Gagal)
                          </span>
                        )}
                      </td>

                      {/* Waktu Pembuatan */}
                      <td className="py-4 px-5 font-mono text-xs text-slate-500 dark:text-slate-400">
                        {createdAtFormatted}
                      </td>

                      {/* Aksi & Navigasi Hasil */}
                      <td className="py-4 px-5 text-right font-medium">
                        {job.status === 'COMPLETED' && (
                          <button
                            type="button"
                            onClick={() => navigate(`/jobs/${jobId}/result`)}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow-sm inline-flex items-center gap-1.5 cursor-pointer transition-all"
                          >
                            <Eye className="w-3.5 h-3.5" /> Lihat Varian & Hasil (M9)
                          </button>
                        )}

                        {(job.status === 'RUNNING' || job.status === 'QUEUED') && (
                          <span className="text-slate-400 dark:text-slate-500 text-xs font-mono italic">
                            Pipeline sedang berjalan...
                          </span>
                        )}

                        {job.status === 'FAILED' && (
                          <Link
                            to="/analisis-baru"
                            className="text-rose-600 dark:text-rose-400 hover:underline font-bold text-xs inline-flex items-center gap-1 cursor-pointer"
                          >
                            <RefreshCcw className="w-3.5 h-3.5" /> Coba Unggah Ulang
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