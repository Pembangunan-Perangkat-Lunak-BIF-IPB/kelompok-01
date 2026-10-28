import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Play, 
  CheckCircle2, 
  Dna, 
  Search, 
  AlertTriangle, 
  Loader2, 
  FileText,
  XCircle,
  RotateCcw
} from 'lucide-react';

export const JobMonitoringPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [readFilter, setReadFilter] = useState('ALL');

  // Dummy Data Riwayat Job (Termasuk Sampel Berstatus FAILED)
  const mockJobs = [
    {
      id: '#JOB-0941',
      sampleName: 'Bawang_Putih_Lokal_Tawangmangu_R1.fq',
      type: 'Single-End',
      status: 'RUNNING',
      statusText: 'Berjalan: Alignment BWA-MEM2',
    },
    {
      id: '#JOB-0938',
      sampleName: 'Allium_sativum_Cianjur_SE.fastq.gz',
      type: 'Single-End',
      status: 'COMPLETED',
      statusText: 'Selesai',
    },
    {
      id: '#JOB-0925',
      sampleName: 'Garlic_Brebes_Kultivar_Lumbu_Hijau.fq',
      type: 'Paired-End',
      status: 'COMPLETED',
      statusText: 'Selesai',
    },
    {
      id: '#JOB-0912',
      sampleName: 'Garlic_Sample_Corrupted_Q10.fastq',
      type: 'Single-End',
      status: 'FAILED',
      statusText: 'Gagal: Low Q-Score (< Q20)',
    },
  ];

  // Logika Filter Data
  const filteredJobs = mockJobs.filter((job) => {
    const matchesSearch = 
      job.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.sampleName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = 
      statusFilter === 'ALL' || job.status === statusFilter;
    
    const matchesRead = 
      readFilter === 'ALL' || job.type === readFilter;

    return matchesSearch && matchesStatus && matchesRead;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-4">
      
      {/* Banner Peringatan Konkurensi */}
      <div className="glass-card rounded-2xl p-4 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-3 transition-all border-amber-200/60 dark:border-amber-900/40">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="font-bold">Peringatan Sistem (Batasan Konkurensi):</strong>
          <br />
          Hanya 1 proses analisis aktif yang diizinkan per pengguna dalam satu waktu. Server membatasi penggunaan memori FM-index BWA-MEM2 untuk kestabilan server komputasi.
        </div>
      </div>

      {/* Header Halaman & Tombol Analisis Baru */}
      <div className="glass-card rounded-2xl p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all">
        <div>
          <div className="text-[11px] font-mono text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider mb-1">
            GENOPATH DAEMON • MONITORING & STATUS PIPELINE
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            Dashboard Pemantauan Job Analisis
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Kelola dan pantau status pipeline variant calling berkas FASTQ Anda secara real-time.
          </p>
        </div>

        <Link
          to="/analisis-baru"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-md shadow-blue-500/20 transition-all cursor-pointer shrink-0"
        >
          <Play className="w-4 h-4 fill-current" /> Buat Analisis Baru
        </Link>
      </div>

      {/* Grid 3 Ringkasan Metrik */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Metrik 1: Job Aktif */}
        <div className="glass-card glass-card-hover rounded-2xl p-5 space-y-3">
          <div className="flex justify-between items-center text-[11px] font-mono text-slate-500 dark:text-slate-400 uppercase font-bold">
            <span>JOB AKTIF</span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
          </div>
          <div>
            <div className="text-3xl font-black text-slate-900 dark:text-slate-100">1 Berjalan</div>
            <span className="inline-block mt-2 glass-card text-amber-700 dark:text-amber-400 px-2.5 py-1 rounded-full text-[11px] font-semibold border-amber-200/60 dark:border-amber-800/60">
              Sedang Memetakan BWA-MEM2
            </span>
          </div>
          <div className="pt-2 border-t border-slate-300/40 dark:border-slate-800/60 text-[11px] font-mono text-slate-500 dark:text-slate-400 flex justify-between">
            <span>Alokasi Thread: 8-Core</span>
            <span>RAM: 14.2 GB</span>
          </div>
        </div>

        {/* Metrik 2: Analisis Selesai */}
        <div className="glass-card glass-card-hover rounded-2xl p-5 space-y-3">
          <div className="flex justify-between items-center text-[11px] font-mono text-slate-500 dark:text-slate-400 uppercase font-bold">
            <span>ANALISIS SELESAI</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <div className="text-3xl font-black text-slate-900 dark:text-slate-100">2 Berhasil</div>
            <span className="inline-block mt-2 glass-card text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded-full text-[11px] font-semibold border-emerald-200/60 dark:border-emerald-800/60">
              Siap Diunduh
            </span>
          </div>
          <div className="pt-2 border-t border-slate-300/40 dark:border-slate-800/60 text-[11px] font-mono text-slate-500 dark:text-slate-400 flex justify-between">
            <span>Arsip VCF: 2 Berkas</span>
            <span>Ukuran: 842.1 MB</span>
          </div>
        </div>

        {/* Metrik 3: Total Varian Ditemukan */}
        <div className="glass-card glass-card-hover rounded-2xl p-5 space-y-3">
          <div className="flex justify-between items-center text-[11px] font-mono text-slate-500 dark:text-slate-400 uppercase font-bold">
            <span>TOTAL VARIAN DITEMUKAN</span>
            <Dna className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <div className="text-3xl font-black text-slate-900 dark:text-slate-100">14.820 Varian</div>
            <span className="inline-block mt-2 glass-card text-blue-700 dark:text-blue-400 px-2.5 py-1 rounded-full text-[11px] font-semibold border-blue-200/60 dark:border-blue-800/60">
              Koleksi Seluruh Analisis
            </span>
          </div>
          <div className="pt-2 border-t border-slate-300/40 dark:border-slate-800/60 text-[11px] font-mono text-slate-500 dark:text-slate-400 flex justify-between">
            <span>SNP: 11.204</span>
            <span>INDEL: 3.616</span>
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
              <option value="ALL" className="dark:bg-slate-900">Semua Status (Aktif, Selesai, Gagal)</option>
              <option value="RUNNING" className="dark:bg-slate-900">Berjalan</option>
              <option value="COMPLETED" className="dark:bg-slate-900">Selesai</option>
              <option value="FAILED" className="dark:bg-slate-900">Gagal</option>
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
            <span>Tipe Read:</span>
            <select
              value={readFilter}
              onChange={(e) => setReadFilter(e.target.value)}
              className="glass-card text-slate-800 dark:text-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="ALL" className="dark:bg-slate-900">Semua FASTQ</option>
              <option value="Single-End" className="dark:bg-slate-900">Single-End</option>
              <option value="Paired-End" className="dark:bg-slate-900">Paired-End</option>
            </select>
          </div>
        </div>

        {/* Input Text Cari */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cari ID Job atau Nama Sampel..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full glass-card text-slate-800 dark:text-slate-200 text-xs rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Tabel Riwayat Pekerjaan (Jobs) */}
      <div className="glass-card rounded-2xl overflow-hidden shadow-sm transition-all">
        <div className="px-5 py-4 border-b border-slate-300/40 dark:border-slate-800/60 flex justify-between items-center bg-white/20 dark:bg-slate-800/20">
          <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            Tabel Riwayat Eksekusi Pipeline GATK
          </h2>
          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">Auto-Refresh: 10s</span>
        </div>

        <table className="w-full text-left text-xs">
          <thead className="bg-slate-200/40 dark:bg-slate-800/40 border-b border-slate-300/40 dark:border-slate-800/60 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
            <tr>
              <th className="py-3.5 px-5">ID Job</th>
              <th className="py-3.5 px-5">Nama Sampel</th>
              <th className="py-3.5 px-5">Tipe FASTQ</th>
              <th className="py-3.5 px-5">Status</th>
              <th className="py-3.5 px-5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/30 dark:divide-slate-800/40 text-slate-700 dark:text-slate-300">
            {filteredJobs.map((job) => (
              <tr key={job.id} className="hover:bg-white/40 dark:hover:bg-slate-800/40 transition-colors">
                <td className="py-4 px-5 font-mono font-bold text-blue-600 dark:text-blue-400">
                  {job.id}
                </td>
                <td className="py-4 px-5 font-mono text-slate-900 dark:text-slate-100 font-medium">
                  {job.sampleName}
                </td>
                <td className="py-4 px-5 font-mono text-slate-500 dark:text-slate-400">
                  {job.type}
                </td>
                <td className="py-4 px-5">
                  {job.status === 'RUNNING' && (
                    <span className="inline-flex items-center gap-1.5 glass-card text-amber-700 dark:text-amber-400 font-semibold px-2.5 py-1 rounded-full text-[11px] border-amber-200/60 dark:border-amber-800/60">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600 dark:text-amber-400" />
                      {job.statusText}
                    </span>
                  )}
                  {job.status === 'COMPLETED' && (
                    <span className="inline-flex items-center gap-1.5 glass-card text-emerald-700 dark:text-emerald-400 font-semibold px-2.5 py-1 rounded-full text-[11px] border-emerald-200/60 dark:border-emerald-800/60">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      {job.statusText}
                    </span>
                  )}
                  {job.status === 'FAILED' && (
                    <span className="inline-flex items-center gap-1.5 glass-card text-rose-700 dark:text-rose-400 font-semibold px-2.5 py-1 rounded-full text-[11px] border-rose-200/60 dark:border-rose-800/60">
                      <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                      {job.statusText}
                    </span>
                  )}
                </td>
                <td className="py-4 px-5 text-right font-medium">
                  {job.status === 'COMPLETED' && (
                    <div className="flex justify-end items-center gap-2">
                      <button className="text-blue-600 dark:text-blue-400 hover:underline font-bold text-xs inline-flex items-center gap-1 cursor-pointer">
                        Lihat Hasil / Report
                      </button>
                      <span className="text-slate-300 dark:text-slate-700">|</span>
                      <button className="text-blue-600 dark:text-blue-400 hover:underline font-bold text-xs cursor-pointer">
                        VCF
                      </button>
                    </div>
                  )}
                  {job.status === 'RUNNING' && (
                    <span className="text-slate-400 dark:text-slate-500 text-[11px] italic">
                      Memproses...
                    </span>
                  )}
                  {job.status === 'FAILED' && (
                    <button className="text-rose-600 dark:text-rose-400 hover:underline font-bold text-xs inline-flex items-center gap-1 cursor-pointer">
                      <RotateCcw className="w-3 h-3" /> Ulangi Job
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
};