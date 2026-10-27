import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Plus, Search, Dna, FileText, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

// Export interface agar bisa digunakan kembali oleh service API / komponen lain
export interface JobItem {
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
  const [statusFilter, setStatusFilter] = useState<string>('Semua');
  const [typeFilter, setTypeFilter] = useState<string>('Semua');

  // Data Dummy Status Job
  const [jobs] = useState<JobItem[]>([
    { id: '#JOB-0941', sampleName: 'Bawang_Putih_Lokal_Tawangmangu_R1.fq', fastqType: 'Single-End', status: 'Running', statusLabel: 'Berjalan: Alignment BWA-MEM2' },
    { id: '#JOB-0938', sampleName: 'Allium_sativum_Cianjur_SE.fastq.gz', fastqType: 'Single-End', status: 'Completed', statusLabel: 'Selesai', vcfReportId: 'JOB-0938' },
    { id: '#JOB-0925', sampleName: 'Garlic_Brebes_Kultivar_Lumbu_Hijau.fq', fastqType: 'Paired-End', status: 'Completed', statusLabel: 'Selesai', vcfReportId: 'JOB-0925' },
    { id: '#JOB-0919', sampleName: 'Sampel_Uji_Coba_Corrupt_Read.fastq', fastqType: 'Single-End', status: 'Failed', statusLabel: 'Gagal: FASTQ Korup' },
    { id: '#JOB-0910', sampleName: 'Allium_sativum_Kupang_Isolat_03.fastq', fastqType: 'Single-End', status: 'Completed', statusLabel: 'Selesai', vcfReportId: 'JOB-0910' },
  ]);

  // Logika Filter
  const filteredJobs = jobs.filter((job) => {
    const matchSearch = job.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        job.sampleName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === 'Semua' || job.status === statusFilter;
    const matchType = typeFilter === 'Semua' || job.fastqType === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  const handleNewAnalysis = () => {
    // Navigasi aman jika rute belum dibuat
    navigate('/analisis-baru');
  };

  const handleViewReport = (reportId?: string) => {
    if (reportId) {
      navigate(`/report/${reportId}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner Peringatan Sistem */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-xs text-amber-900">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <strong className="font-bold block mb-0.5">Peringatan Sistem (Batasan Konkurensi):</strong>
          Hanya 1 proses analisis aktif yang diizinkan per pengguna dalam satu waktu. Server membatasi penggunaan memori FM-index BWA-MEM2 untuk kestabilan server komputasi.
        </div>
      </div>

      {/* Header Dashboard */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-[10px] font-mono font-bold text-blue-600 uppercase tracking-wider">GENOPATH DAEMON • MONITORING & STATUS PIPELINE</span>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">Dashboard Pemantauan Job Analisis</h1>
          <p className="text-xs text-slate-500 mt-1">Kelola dan pantau status pipeline variant calling berkas FASTQ Anda secara real-time.</p>
        </div>
        <button
          onClick={handleNewAnalysis}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-md shadow-blue-500/20 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" /> Buat Analisis Baru
        </button>
      </div>

      {/* Grid Kartu Statistik Metrik */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">JOB AKTIF</span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping"></span>
          </div>
          <h2 className="text-3xl font-black text-slate-900">1 Berjalan</h2>
          <span className="inline-block mt-2 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[11px] font-semibold">
            Sedang Memetakan BWA-MEM2
          </span>
          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between text-[11px] text-slate-400 font-mono">
            <span>Alokasi Thread: 8-Core</span>
            <span>RAM: 14.2 GB</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ANALISIS SELESAI</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <h2 className="text-3xl font-black text-slate-900">4 Berhasil</h2>
          <span className="inline-block mt-2 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[11px] font-semibold">
            Siap Diunduh
          </span>
          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between text-[11px] text-slate-400 font-mono">
            <span>Arsip VCF: 4 Berkas</span>
            <span>Ukuran: 842.1 MB</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">TOTAL VARIAN DITEMUKAN</span>
            <Dna className="w-4 h-4 text-blue-600" />
          </div>
          <h2 className="text-3xl font-black text-slate-900">14.820 Varian</h2>
          <span className="inline-block mt-2 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-[11px] font-semibold">
            Koleksi Seluruh Analisis
          </span>
          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between text-[11px] text-slate-400 font-mono">
            <span>SNP: 11.204</span>
            <span>INDEL: 3.616</span>
          </div>
        </div>
      </div>

      {/* Filter & Bar Pencarian */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-600 text-[11px]">Status Job:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-800 font-medium focus:outline-none focus:border-blue-500"
            >
              <option value="Semua">Semua Status (Aktif, Selesai, Gagal)</option>
              <option value="Running">Berjalan (Running)</option>
              <option value="Completed">Selesai (Completed)</option>
              <option value="Failed">Gagal (Failed)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-600 text-[11px]">Tipe Read:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-800 font-medium focus:outline-none focus:border-blue-500"
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
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-slate-800 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Tabel Riwayat Eksekusi */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-xs text-slate-800 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" /> Tabel Riwayat Eksekusi Pipeline GATK
          </h3>
          <span className="text-[10px] font-mono bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold">
            Auto-Refresh: 10s
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-mono text-slate-500 text-[11px]">
                <th className="p-3.5">ID Job</th>
                <th className="p-3.5">Nama Sampel</th>
                <th className="p-3.5">Tipe FASTQ</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {filteredJobs.length > 0 ? (
                filteredJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-blue-600">{job.id}</td>
                    <td className="p-3.5 font-bold text-slate-800">{job.sampleName}</td>
                    <td className="p-3.5 text-slate-500">{job.fastqType}</td>
                    <td className="p-3.5">
                      {job.status === 'Running' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock className="w-3 h-3 animate-spin" /> {job.statusLabel}
                        </span>
                      )}
                      {job.status === 'Completed' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> {job.statusLabel}
                        </span>
                      )}
                      {job.status === 'Failed' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <AlertCircle className="w-3 h-3" /> {job.statusLabel}
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-right space-x-2">
                      {job.status === 'Completed' && (
                        <>
                          <button
                            onClick={() => handleViewReport(job.vcfReportId)}
                            className="text-blue-600 hover:text-blue-800 font-bold hover:underline"
                          >
                            Lihat Hasil / Report
                          </button>
                          <span className="text-slate-300">|</span>
                          <button className="text-blue-600 hover:text-blue-800 font-bold hover:underline">
                            VCF
                          </button>
                        </>
                      )}
                      {job.status === 'Failed' && (
                        <button className="text-rose-600 hover:text-rose-800 font-bold hover:underline">
                          Lihat Log Error
                        </button>
                      )}
                      {job.status === 'Running' && (
                        <span className="text-slate-400 text-[11px]">Memproses...</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-400 font-mono text-xs">
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