import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Play, 
  FileInput, 
  Sliders, 
  Dna as DnaIcon, 
  Database, 
  ArrowRight, 
  ChevronDown,
  Workflow,
  BookOpen
} from 'lucide-react';
import { TeamSection } from '../components/TeamSection';

export const LandingPage: React.FC = () => {
  // State Expand / Minimize dengan Animasi Smooth
  const [isFlowExpanded, setIsFlowExpanded] = useState<boolean>(true);
  const [isGuideExpanded, setIsGuideExpanded] = useState<boolean>(true);

  return (
    <div className="space-y-4 md:space-y-5 w-full max-w-6xl mx-auto pb-6">
      
      {/* --- HERO SECTION --- */}
      <section className="text-center space-y-5 pt-2 pb-2">
        {/* Lencana Kapsul Pipeline */}
        <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/30 dark:bg-slate-900/45 text-blue-950 dark:text-blue-300 font-mono text-xs md:text-sm font-black border border-white/50 dark:border-slate-700/60 shadow-lg backdrop-blur-2xl">
          <DnaIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>Pipeline Bioinformatika Allium sativum</span>
        </div>

        {/* Judul Utama dengan Bottom Padding (pb-3) & Leading Snug agar Huruf "g" Tidak Terpotong */}
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-snug pb-3 max-w-4xl mx-auto text-transparent bg-clip-text bg-gradient-to-r from-slate-950 via-blue-950 to-slate-900 dark:from-white dark:via-blue-100 dark:to-slate-200 drop-shadow-[0_2px_12px_rgba(255,255,255,0.9)] dark:drop-shadow-md">
          Alat Analisis Variant Calling Bawang Putih Otomatis
        </h1>

        {/* Subtitle Hero Frosted Glass */}
        <div className="max-w-3xl mx-auto bg-white/30 dark:bg-slate-900/45 backdrop-blur-2xl p-5 rounded-2xl border border-white/50 dark:border-slate-700/60 shadow-xl">
          <p className="text-sm md:text-base text-slate-950 dark:text-slate-100 font-extrabold leading-relaxed">
            Otomatisasi pemrosesan genomik <span className="italic text-blue-700 dark:text-blue-400">Allium sativum</span> (Bawang Putih) mulai dari kontrol kualitas FASTQ, pemetaan referensi Garlic.V2 via Bowtie2, hingga ekstraksi varian ke PostgreSQL dan berkas VCF/CSV.
          </p>
        </div>

        {/* Tombol CTA */}
        <div className="pt-1">
          <Link
            to="/analisis-baru"
            className="inline-flex items-center gap-3 bg-blue-600/90 hover:bg-blue-600 text-white font-black text-base px-8 py-4 rounded-2xl shadow-xl shadow-blue-600/30 backdrop-blur-md hover:scale-105 transition-all cursor-pointer"
          >
            <Play className="w-5 h-5 fill-white" />
            <span>Mulai Analisis Baru</span>
          </Link>
        </div>

        {/* Spesifikasi Grid */}
        <div className="max-w-4xl mx-auto bg-white/40 dark:bg-slate-900/60 backdrop-blur-2xl rounded-2xl p-3.5 border border-white/60 dark:border-slate-700/60 shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-xl bg-white/40 dark:bg-slate-800/50 border border-white/50 dark:border-slate-700/50 flex flex-col justify-center">
              <span className="block text-[11px] font-mono font-black text-blue-900 dark:text-blue-400 uppercase tracking-wider">
                Target Spesies
              </span>
              <span className="text-sm md:text-base font-black text-slate-950 dark:text-white mt-0.5">
                Allium sativum L.
              </span>
            </div>

            <div className="p-3 rounded-xl bg-white/40 dark:bg-slate-800/50 border border-white/50 dark:border-slate-700/50 flex flex-col justify-center">
              <span className="block text-[11px] font-mono font-black text-blue-900 dark:text-blue-400 uppercase tracking-wider">
                Genom Referensi
              </span>
              <span className="text-sm md:text-base font-black text-slate-950 dark:text-white mt-0.5">
                Garlic.V2 (ASM12345v1)
              </span>
            </div>

            <div className="p-3 rounded-xl bg-white/40 dark:bg-slate-800/50 border border-white/50 dark:border-slate-700/50 flex flex-col justify-center">
              <span className="block text-[11px] font-mono font-black text-blue-900 dark:text-blue-400 uppercase tracking-wider">
                Format Input
              </span>
              <span className="text-sm md:text-base font-black text-slate-950 dark:text-white mt-0.5">
                Single-End FASTQ (.fastq / .gz)
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* --- SECTION 1: ALUR EKSEKUSI PIPELINE --- */}
      <section className="space-y-3">
        <button
          type="button"
          onClick={() => setIsFlowExpanded(!isFlowExpanded)}
          className={`mx-auto flex items-center justify-between rounded-2xl bg-white/40 dark:bg-slate-900/60 border border-white/60 dark:border-slate-700/60 shadow-xl backdrop-blur-2xl text-left cursor-pointer transition-all duration-300 hover:bg-white/60 dark:hover:bg-slate-900/80 ${
            isFlowExpanded
              ? 'w-full p-4'
              : 'max-w-2xl px-6 py-3.5 border-blue-500/40 shadow-blue-500/10'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-xl bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-500/30">
              <Workflow className={`transition-all duration-300 ${isFlowExpanded ? 'w-4 h-4' : 'w-5 h-5 text-blue-600 dark:text-blue-300'}`} />
            </div>
            <h2 className={`font-black font-mono tracking-wider text-slate-950 dark:text-white uppercase transition-all duration-300 ${
              isFlowExpanded ? 'text-xs md:text-sm' : 'text-sm md:text-base text-blue-900 dark:text-blue-300 font-extrabold'
            }`}>
              Alur Eksekusi Pipeline Otomatis
            </h2>
          </div>

          <ChevronDown
            className={`text-slate-950 dark:text-slate-100 transition-transform duration-300 ${
              isFlowExpanded ? 'w-4 h-4 rotate-180' : 'w-5 h-5 text-blue-600 dark:text-blue-400'
            }`}
          />
        </button>

        <div
          className={`grid transition-all duration-300 ease-in-out ${
            isFlowExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'
          }`}
        >
          <div className="overflow-hidden space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 01. INPUT */}
              <div className="bg-white/30 dark:bg-slate-900/45 backdrop-blur-2xl p-5 rounded-2xl border border-white/50 dark:border-slate-700/60 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-black text-blue-700 dark:text-blue-400">01. INPUT</span>
                  <FileInput className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="font-black text-base text-slate-950 dark:text-white">Unggah Data FASTQ</h3>
                <p className="text-xs md:text-sm text-slate-950 dark:text-slate-100 leading-relaxed font-extrabold">
                  Validasi berkas Single-End (.fastq / .fastq.gz) maks 1 GB via REST API multipart upload aman.
                </p>
              </div>

              {/* 02. QC */}
              <div className="bg-white/30 dark:bg-slate-900/45 backdrop-blur-2xl p-5 rounded-2xl border border-white/50 dark:border-slate-700/60 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-black text-blue-700 dark:text-blue-400">02. QC & PREPROC</span>
                  <Sliders className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="font-black text-base text-slate-950 dark:text-white">Kontrol Kualitas & Trimming</h3>
                <p className="text-xs md:text-sm text-slate-950 dark:text-slate-100 leading-relaxed font-extrabold">
                  fastp v0.23+: Pemotongan sekuens adapter, eliminasi low-quality reads, evaluasi Q20/Q30.
                </p>
              </div>

              {/* 03. ALIGNMENT */}
              <div className="bg-white/30 dark:bg-slate-900/45 backdrop-blur-2xl p-5 rounded-2xl border border-white/50 dark:border-slate-700/60 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-black text-blue-700 dark:text-blue-400">03. ALIGNMENT</span>
                  <DnaIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="font-black text-base text-slate-950 dark:text-white">Pemetaan Referensi</h3>
                <p className="text-xs md:text-sm text-slate-950 dark:text-slate-100 leading-relaxed font-extrabold">
                  Bowtie2 & SAMtools: Pemetaan ke Garlic.V2 (ASM12345v1), konversi BAM, coordinate sorting, & pengindeksan.
                </p>
              </div>

              {/* 04. CALL & EXPORT */}
              <div className="bg-white/30 dark:bg-slate-900/45 backdrop-blur-2xl p-5 rounded-2xl border border-white/50 dark:border-slate-700/60 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-black text-blue-700 dark:text-blue-400">04. CALL & EXPORT</span>
                  <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="font-black text-base text-slate-950 dark:text-white">Calling Varian & Ingestion</h3>
                <p className="text-xs md:text-sm text-slate-950 dark:text-slate-100 leading-relaxed font-extrabold">
                  BCFtools: Pemanggilan varian (QUAL≥30, DP≥10), ingest DB tb_genomic_variants, & ekspor VCF/CSV.
                </p>
              </div>
            </div>

            {/* Banner Rute Data */}
            <div className="bg-white/30 dark:bg-slate-900/45 backdrop-blur-2xl p-4 rounded-2xl border border-white/50 dark:border-slate-700/60 shadow-xl flex items-center justify-between text-xs md:text-sm font-mono text-slate-950 dark:text-slate-100">
              <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start w-full">
                <span className="font-black text-slate-950 dark:text-white">RUTE DATA:</span>
                <span className="px-2.5 py-1 rounded-lg bg-white/40 dark:bg-slate-800/60 font-black text-slate-950 dark:text-slate-100 backdrop-blur-md border border-white/40 dark:border-slate-700/50">[RAW FASTQ]</span>
                <ArrowRight className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="px-2.5 py-1 rounded-lg bg-white/40 dark:bg-slate-800/60 font-black text-slate-950 dark:text-slate-100 backdrop-blur-md border border-white/40 dark:border-slate-700/50">[FASTP QC]</span>
                <ArrowRight className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="px-2.5 py-1 rounded-lg bg-white/40 dark:bg-slate-800/60 font-black text-slate-950 dark:text-slate-100 backdrop-blur-md border border-white/40 dark:border-slate-700/50">[BOWTIE2 BAM/BAI]</span>
                <ArrowRight className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="px-2.5 py-1 rounded-lg bg-white/40 dark:bg-slate-800/60 font-black text-slate-950 dark:text-slate-100 backdrop-blur-md border border-white/40 dark:border-slate-700/50">[BCFTOOLS VCF]</span>
                <ArrowRight className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-950 dark:text-emerald-300 font-black border border-emerald-500/40 backdrop-blur-md">DB POSTGRESQL</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- SECTION 2: PETUNJUK LABORATORIUM --- */}
      <section className="space-y-3">
        <button
          type="button"
          onClick={() => setIsGuideExpanded(!isGuideExpanded)}
          className={`mx-auto flex items-center justify-between rounded-2xl bg-white/40 dark:bg-slate-900/60 border border-white/60 dark:border-slate-700/60 shadow-xl backdrop-blur-2xl text-left cursor-pointer transition-all duration-300 hover:bg-white/60 dark:hover:bg-slate-900/80 ${
            isGuideExpanded
              ? 'w-full p-4'
              : 'max-w-2xl px-6 py-3.5 border-emerald-500/40 shadow-emerald-500/10'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
              <BookOpen className={`transition-all duration-300 ${isGuideExpanded ? 'w-4 h-4' : 'w-5 h-5 text-emerald-600 dark:text-emerald-300'}`} />
            </div>
            <h2 className={`font-black font-mono tracking-wider text-slate-950 dark:text-white uppercase transition-all duration-300 ${
              isGuideExpanded ? 'text-xs md:text-sm' : 'text-sm md:text-base text-emerald-900 dark:text-emerald-300 font-extrabold'
            }`}>
              Petunjuk Penggunaan Laboratorium
            </h2>
          </div>

          <ChevronDown
            className={`text-slate-950 dark:text-slate-100 transition-transform duration-300 ${
              isGuideExpanded ? 'w-4 h-4 rotate-180' : 'w-5 h-5 text-emerald-600 dark:text-emerald-400'
            }`}
          />
        </button>

        <div
          className={`grid transition-all duration-300 ease-in-out ${
            isGuideExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'
          }`}
        >
          <div className="overflow-hidden bg-white/30 dark:bg-slate-900/45 backdrop-blur-2xl rounded-2xl border border-white/50 dark:border-slate-700/60 shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs md:text-sm font-mono">
                <thead>
                  <tr className="bg-white/50 dark:bg-slate-800/70 text-slate-950 dark:text-white border-b border-white/50 dark:border-slate-700/60 backdrop-blur-md">
                    <th className="py-3.5 px-5 font-black">TAHAP</th>
                    <th className="py-3.5 px-5 font-black">TINDAKAN PRAKTIKAN / PENELITI</th>
                    <th className="py-3.5 px-5 font-black">FORMAT KELUARAN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/30 dark:divide-slate-800/50 text-slate-950 dark:text-slate-100 font-extrabold">
                  <tr className="hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3.5 px-5 font-black text-blue-700 dark:text-blue-400">01.</td>
                    <td className="py-3.5 px-5">Buka menu "Analisis Baru". Unggah berkas Single-End FASTQ (.fastq / .fastq.gz).</td>
                    <td className="py-3.5 px-5 text-slate-950 dark:text-white font-black">id_sample & request_id (UUIDv4)</td>
                  </tr>
                  <tr className="hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3.5 px-5 font-black text-blue-700 dark:text-blue-400">02.</td>
                    <td className="py-3.5 px-5">Sistem memverifikasi ukuran berkas (maks 1 GB) dan mengonfirmasi pembuatan Job analisis di backend FastAPI.</td>
                    <td className="py-3.5 px-5 text-slate-950 dark:text-white font-black">id_job (Status: QUEUED)</td>
                  </tr>
                  <tr className="hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3.5 px-5 font-black text-blue-700 dark:text-blue-400">03.</td>
                    <td className="py-3.5 px-5">Pengaturan parameter eksekusi pipeline: Threshold QUAL minimal (default: 30.0), Kedalaman Baca (DP minimal: 10x), & Mode Eksekusi (synthetic / nextflow).</td>
                    <td className="py-3.5 px-5 text-slate-950 dark:text-white font-black">parameter_pipeline (JSON)</td>
                  </tr>
                  <tr className="hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3.5 px-5 font-black text-blue-700 dark:text-blue-400">04.</td>
                    <td className="py-3.5 px-5">Pantau status eksekusi real-time pada "Dashboard Job" hingga status menunjukkan COMPLETED.</td>
                    <td className="py-3.5 px-5 text-emerald-700 dark:text-emerald-300 font-black">status: COMPLETED / FAILED</td>
                  </tr>
                  <tr className="hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3.5 px-5 font-black text-blue-700 dark:text-blue-400">05.</td>
                    <td className="py-3.5 px-5">Buka "Laporan Analisis Varian" untuk mengunduh VCF (.vcf.gz), ekspor CSV, atau telusuri tabel varian PostgreSQL.</td>
                    <td className="py-3.5 px-5 text-slate-950 dark:text-white font-black">Laporan Varian & File Download</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* --- SECTION 3: INTEGRASI TEAM SECTION --- */}
      <TeamSection />

    </div>
  );
};

export default LandingPage;