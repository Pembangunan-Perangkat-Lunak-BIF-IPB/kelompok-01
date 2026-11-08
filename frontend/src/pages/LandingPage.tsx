import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, FileUp, Sliders, Cpu, FileCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { TeamSection } from '../components/TeamSection';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleStartAnalysis = () => {
    if (user) {
      navigate('/analisis-baru');
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="space-y-10">
      {/* Hero Section */}
      <section className="max-w-4xl mx-auto pt-4 pb-4 text-center">
        {/* Badge Hero Netral */}
        <div className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900/60 rounded-lg px-3 py-1.5 text-xs font-mono text-blue-800 dark:text-blue-300 mb-4 transition-colors">
          <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400 inline-block"></span>
          Paket A: Pipeline Bioinformatika Nextflow & FastAPI <span className="text-slate-500 dark:text-slate-400">| BUILD: v1.0-STABLE / NEXTFLOW-ASYNC</span>
        </div>

        {/* Judul Utama */}
        <h1 className="text-2xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-3 tracking-tight transition-colors">
          Alat Analisis Variant Calling Bawang Putih Otomatis
        </h1>

        {/* Subtitle */}
        <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 max-w-prose mx-auto mb-6 leading-relaxed [text-wrap:pretty] transition-colors">
          Otomatisasi pemrosesan genomik <em>Allium sativum</em> (Bawang Putih) mulai dari kontrol kualitas FASTQ, pemetaan referensi Garlic.V2, hingga ekstraksi varian teranotasi VCF/CSV berbasis komputasi asinkron berkinerja tinggi.
        </p>

        {/* Tombol Utama */}
        <div className="flex justify-center mb-6">
          <button
            onClick={handleStartAnalysis}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl text-xs font-semibold transition-all shadow-sm cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" /> Mulai Analisis Baru
          </button>
        </div>

        {/* Kartu Spesifikasi */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 max-w-3xl mx-auto text-left flex flex-wrap justify-around text-xs text-slate-700 dark:text-slate-300 gap-3 font-mono shadow-sm transition-colors">
          <div><span className="text-slate-500 dark:text-slate-400 uppercase text-xs font-bold">SPESIFIKASI:</span> Target Spesies: <strong className="text-slate-900 dark:text-slate-100">Allium sativum L.</strong></div>
          <div>Genom Referensi: <strong className="text-slate-900 dark:text-slate-100">Garlic.V2 (AlliumDB)</strong></div>
          <div>Format Input: <strong className="text-slate-900 dark:text-slate-100">FASTQ Single-End & Paired-End (Maks 1 GB)</strong></div>
        </div>
      </section>

      {/* Diagram Alur Eksekusi */}
      <section className="max-w-5xl mx-auto space-y-4">
        <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-2 transition-colors">
          <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full inline-block"></span> Alur Eksekusi Pipeline Otomatis
          </h2>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">DIAGRAM LOGIKA PROSES</span>
        </div>

        {/* Grid 4 Kartu Tahapan */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          {/* Card 01: INPUT */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl space-y-3 flex flex-col justify-between shadow-sm transition-colors">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-blue-600 dark:text-blue-400 font-mono font-bold">
                <span>01. INPUT</span>
                <FileUp className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="font-bold text-xs text-slate-900 dark:text-slate-100">Unggah Data FASTQ</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed [text-wrap:pretty]">
                Validasi berkas Single-End / Paired-End maks 1 GB via REST API multipart upload aman.
              </p>
            </div>
            <span className="text-xs font-mono bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md px-2 py-1 self-start border border-slate-200 dark:border-slate-700">
              CMD: multipart/form-data
            </span>
          </div>

          {/* Card 02: QC & PREPROC */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl space-y-3 flex flex-col justify-between shadow-sm transition-colors">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                <span>02. QC & PREPROC</span>
                <Sliders className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="font-bold text-xs text-slate-900 dark:text-slate-100">Kontrol Kualitas & Trimming</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed [text-wrap:pretty]">
                fastp v0.23: Pemotongan sekuens adapter, eliminasi low-quality reads, evaluasi Q20/Q30.
              </p>
            </div>
            <span className="text-xs font-mono bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md px-2 py-1 self-start border border-slate-200 dark:border-slate-700">
              TOOL: fastp -q 20 -u 30
            </span>
          </div>

          {/* Card 03: ALIGNMENT */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl space-y-3 flex flex-col justify-between shadow-sm transition-colors">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-indigo-600 dark:text-indigo-400 font-mono font-bold">
                <span>03. ALIGNMENT</span>
                <Cpu className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="font-bold text-xs text-slate-900 dark:text-slate-100">Pemetaan Referensi</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed [text-wrap:pretty]">
                BWA-MEM2 & SAMtools: Pemetaan ke Garlic.V2, konversi BAM, coordinate sorting, & pengindeksan.
              </p>
            </div>
            <span className="text-xs font-mono bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md px-2 py-1 self-start border border-slate-200 dark:border-slate-700">
              TOOL: bwa-mem2 & samtools
            </span>
          </div>

          {/* Card 04: CALL & EXPORT */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl space-y-3 flex flex-col justify-between shadow-sm transition-colors">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-amber-600 dark:text-amber-400 font-mono font-bold">
                <span>04. CALL & EXPORT</span>
                <FileCheck className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="font-bold text-xs text-slate-900 dark:text-slate-100">Calling Varian & Ekspor</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed [text-wrap:pretty]">
                BCFtools: Pemanggilan varian genom, filtering QUAL/DP, anotasi lokasi genetik, & ekspor VCF/CSV.
              </p>
            </div>
            <span className="text-xs font-mono bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md px-2 py-1 self-start border border-slate-200 dark:border-slate-700">
              TOOL: bcftools mpileup/call
            </span>
          </div>

        </div>

        {/* Bar Rute Data */}
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-center text-xs font-mono text-slate-700 dark:text-slate-300 gap-2 transition-colors">
          <div>
            RUTE DATA: <span className="font-semibold text-slate-800 dark:text-slate-200">[RAW FASTQ] ➔ [FASTP QC] ➔ [BAM/BAI] ➔ [RAW BCF] ➔ [FILTERED VCF / CSV]</span>
          </div>
          <span className="text-blue-600 dark:text-blue-400 font-bold shrink-0">ENGINE: Nextflow DSL2</span>
        </div>
      </section>

      {/* Tabel Petunjuk SOP Laboratorium */}
      <section className="max-w-5xl mx-auto space-y-3">
        <div className="flex justify-between items-center px-1">
          <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
            Petunjuk Penggunaan Laboratorium
          </h2>
          {/* Badge SOP */}
          <span className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-md text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
            SOP PRAKTIKUM
          </span>
        </div>

        {/* Container Tabel */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm transition-colors">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 font-mono text-slate-600 dark:text-slate-400 text-xs">
                <th className="p-3.5">TAHAP</th>
                <th className="p-3.5">TINDAKAN PRAKTIKAN / PENELITI</th>
                <th className="p-3.5">FORMAT KELUARAN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
              <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                <td className="p-3.5 font-mono font-bold text-blue-600 dark:text-blue-400">01.</td>
                <td className="p-3.5">Buka tab "Analisis Baru", pilih mode Single atau Paired-End. Masukkan nama batch penelitian.</td>
                <td className="p-3.5 font-mono text-slate-600 dark:text-slate-400">JOB_ID (UUIDv4)</td>
              </tr>
              <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                <td className="p-3.5 font-mono font-bold text-blue-600 dark:text-blue-400">02.</td>
                <td className="p-3.5">Unggah berkas FASTQ atau gunakan dataset kontrol Allium sativum dari repository praktikum.</td>
                <td className="p-3.5 font-mono text-slate-600 dark:text-slate-400">.fastq.gz / SRA</td>
              </tr>
              <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                <td className="p-3.5 font-mono font-bold text-blue-600 dark:text-blue-400">03.</td>
                <td className="p-3.5">Atur threshold Q-score minimal (default: Q20) dan batas kedalaman bacaan (DP minimal: 10x).</td>
                <td className="p-3.5 font-mono text-slate-600 dark:text-slate-400">config.json</td>
              </tr>
              <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                <td className="p-3.5 font-mono font-bold text-blue-600 dark:text-blue-400">04.</td>
                <td className="p-3.5">Pantau status eksekusi terminal di "Dashboard Job" hingga status menampilkan COMPLETED.</td>
                <td className="p-3.5 font-mono text-slate-600 dark:text-slate-400">stdout.log</td>
              </tr>
              <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                <td className="p-3.5 font-mono font-bold text-blue-600 dark:text-blue-400">05.</td>
                <td className="p-3.5">Unduh laporan terkompresi atau telusuri tabel SNP/InDel interaktif melalui modul visualisasi.</td>
                <td className="p-3.5 font-mono text-slate-600 dark:text-slate-400">.vcf.gz, .csv, HTML</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 font-mono px-1">
          Data FASTQ yang diunggah disimpan sementara selama 72 jam pada object store internal.
        </p>
      </section>

      {/* Bagian Tim Pengembang Interaktif */}
      <TeamSection />
    </div>
  );
};

export default LandingPage;