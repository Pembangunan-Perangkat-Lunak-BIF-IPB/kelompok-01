import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Plus, Search, Dna, FileText, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

interface JobItem {
  id: string;
  sampleName: string;
  fastqType: 'Single-End' | 'Paired-End';
  status: 'Running' | 'Completed' | 'Failed';
  statusLabel: string;
  vcfReportId?: string;
}

export const JobMonitoringPage: React.FC = () => {
  const navigate = useNavigate();

  // State Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Semua');
  const [typeFilter, setTypeFilter] = useState('Semua');

  // Data Dummy Sesuai Antarmuka
  const [jobs] = useState<JobItem[]>([
    { id: '#JOB-0941', sampleName: 'Bawang_Putih_Lokal_Tawangmangu_R1.fq', fastqType: 'Single-End', status: 'Running', statusLabel: 'Berjalan: Alignment BWA-MEM2' },
    { id: '#JOB-0938', sampleName: 'Allium_sativum_Cianjur_SE.fastq.gz', fastqType: 'Single-End', status: 'Completed', statusLabel: 'Selesai', vcfReportId: 'JOB-0938' },
    { id: '#JOB-0925', sampleName: 'Garlic_Brebes_Kultivar_Lumbu_Hijau.fq', fastqType: 'Paired-End', status: 'Completed', statusLabel: 'Selesai', vcfReportId: 'JOB-0925' },
    { id: '#JOB-0919', sampleName: 'Sampel_Uji_Coba_Corrupt_Read.fastq', fastqType: 'Single-End', status: 'Failed', statusLabel: 'Gagal: FASTQ Korup' },
    { id: '#JOB-0910', sampleName: 'Allium_sativum_Kupang_Isolat_03.fastq', fastqType: 'Single-End', status: 'Completed', statusLabel: 'Selesai', vcfReportId: 'JOB-0910' },
  ]);

  // Logika Filter Data
  const filteredJobs = jobs.filter((job) => {
    const matchSearch = job.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        job.sampleName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === 'Semua' || job.status === statusFilter;
    const matchType = typeFilter === 'Semua' || job.fastqType === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  return (
    <div className="space-y-6">
      {/* Banner Peringatan Sistem */}
      <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl p-4 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="max-w-prose [text-wrap:pretty]">
          <strong className="font-bold block mb-0.5">Peringatan Sistem (Batasan Konkurensi):</strong>
          Hanya 1 proses analisis aktif yang diizinkan per pengguna dalam satu waktu. Server membatasi penggunaan memori FM-index BWA-MEM2 untuk kestabilan server komputasi.
        </div>
      </div>

      {/* Header Dashboard */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-colors">
        <div>
          <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">
            GENOPATH DAEMON • MONITORING & STATUS PIPELINE
          </span>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1 tracking-tight">
            Dashboard Pemantauan Job Analisis
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-prose [text-wrap:pretty]">
            Kelola dan pantau status pipeline variant calling berkas FASTQ Anda secara real-time.
          </p>
        </div>
        <button
          onClick={() => navigate('/analisis-baru')}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2.5 rounded-lg text-xs shadow-sm transition-all shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Buat Analisis Baru
        </button>
      </div>

      {/* Grid Kartu Statistik Metrik */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Kartu 1 */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm transition-colors">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">JOB AKTIF</span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">1 Berjalan</h2>
          <span className="inline-block mt-2 px-2.5 py-1 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60 rounded-md text-xs font-medium">
            Sedang Memetakan BWA-MEM2
          </span>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between text-xs text-slate-500 dark:text-slate-400 font-mono">
            <span>Alokasi Thread: 8-Core</span>
            <span>RAM: 14.2 GB</span>
          </div>
        </div>

        {/* Kartu 2 */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm transition-colors">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">ANALISIS SELESAI</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">4 Berhasil</h2>
          <span className="inline-block mt-2 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60 rounded-md text-xs font-medium">
            Siap Diunduh
          </span>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between text-xs text-slate-500 dark:text-slate-400 font-mono">
            <span>Arsip VCF: 4 Berkas</span>
            <span>Ukuran: 842.1 MB</span>
          </div>
        </div>

        {/* Kartu 3 */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm transition-colors">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">TOTAL VARIAN DITEMUKAN</span>
            <Dna className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">14.820 Varian</h2>
          <span className="inline-block mt-2 px-2.5 py-1 bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60 rounded-md text-xs font-medium">
            Koleksi Seluruh Analisis
          </span>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between text-xs text-slate-500 dark:text-slate-400 font-mono">
            <span>SNP: 11.204</span>
            <span>INDEL: 3.616</span>
          </div>
        </div>
      </div>

      {/* Filter & Bar Pencarian */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3 text-xs transition-colors">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <label htmlFor="status-filter" className="font-semibold text-slate-700 dark:text-slate-300 text-xs">
              Status Job:
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:border-blue-500"
            >
              <option value="Semua">Semua Status (Aktif, Selesai, Gagal)</option>
              <option value="Running">Berjalan (Running)</option>
              <option value="Completed">Selesai (Completed)</option>
              <option value="Failed">Gagal (Failed)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="type-filter" className="font-semibold text-slate-700 dark:text-slate-300 text-xs">
              Tipe Read:
            </label>
            <select
              id="type-filter"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:border-blue-500"
            >
              <option value="Semua">Semua FASTQ</option>
              <option value="Single-End">Single-End</option>
              <option value="Paired-End">Paired-End</option>
            </select>
          </div>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari ID Job atau Nama Sampel..."
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Tabel Riwayat Eksekusi */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm transition-colors">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <h3 className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Tabel Riwayat Eksekusi Pipeline GATK
          </h3>
          <span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded font-semibold border border-slate-200 dark:border-slate-700">
            Auto-Refresh: 10s
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 font-mono text-slate-600 dark:text-slate-400 text-xs">
                <th className="p-3.5">ID Job</th>
                <th className="p-3.5">Nama Sampel</th>
                <th className="p-3.5">Tipe FASTQ</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200 font-medium">
              {filteredJobs.length > 0 ? (
                filteredJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-blue-600 dark:text-blue-400">{job.id}</td>
                    <td className="p-3.5 font-semibold text-slate-900 dark:text-slate-100">{job.sampleName}</td>
                    <td className="p-3.5 text-slate-600 dark:text-slate-400">{job.fastqType}</td>
                    <td className="p-3.5">
                      {job.status === 'Running' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60">
                          <Clock className="w-3.5 h-3.5 animate-spin" /> {job.statusLabel}
                        </span>
                      )}
                      {job.status === 'Completed' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60">
                          <CheckCircle2 className="w-3.5 h-3.5" /> {job.statusLabel}
                        </span>
                      )}
                      {job.status === 'Failed' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60">
                          <AlertCircle className="w-3.5 h-3.5" /> {job.statusLabel}
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-right space-x-2">
                      {job.status === 'Completed' && (
                        <>
                          <button
                            onClick={() => navigate(`/report/${job.vcfReportId}`)}
                            className="text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
                          >
                            Lihat Hasil / Report
                          </button>
                          <span className="text-slate-300 dark:text-slate-700">|</span>
                          <button className="text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer">
                            VCF
                          </button>
                        </>
                      )}
                      {job.status === 'Failed' && (
                        <button className="text-rose-600 dark:text-rose-400 hover:underline font-semibold cursor-pointer">
                          Lihat Log Error
                        </button>
                      )}
                      {job.status === 'Running' && (
                        <span className="text-slate-500 dark:text-slate-400 text-xs">Memproses...</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-500 dark:text-slate-400 font-mono text-xs">
                    Tidak ada job yang sesuai dengan filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default JobMonitoringPage;