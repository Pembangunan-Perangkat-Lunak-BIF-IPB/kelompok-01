import { ContextHelp } from '../components/ContextHelp';
import React from 'react';
import { Link } from 'react-router-dom';
import { Play, FileInput, Sliders, Dna as DnaIcon, Database } from 'lucide-react';
import { TeamSection } from '../components/TeamSection';

export const LandingPage: React.FC = () => {
  return (
    <div className="space-y-12">

      {/* --- HERO SECTION --- */}
      <section className="text-center space-y-6 pt-2">
        {/* Badge Status Pipeline Frosted */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/30 dark:bg-slate-900/45 text-blue-900 dark:text-blue-300 font-mono text-xs font-black border border-white/50 dark:border-slate-700/60 shadow-lg backdrop-blur-2xl">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 dark:bg-blue-400 animate-ping" />
          <span>Pipeline Bioinformatika Allium sativum</span>
          <span className="text-slate-400 dark:text-slate-600">|</span>
          <span className="text-slate-950 dark:text-slate-100">Analisis varian DNA</span>
        </div>

        {/* Judul Utama High-Contrast */}
        <h1 className="text-4xl md:text-5xl font-black text-slate-950 dark:text-white tracking-tight leading-tight max-w-4xl mx-auto drop-shadow-md">
          Alat Analisis Variant Calling Bawang Putih Otomatis
        </h1>

        {/* Subtitle Hero Frosted Glass */}
        <div className="max-w-2xl mx-auto bg-white/30 dark:bg-slate-900/45 backdrop-blur-2xl p-4.5 rounded-2xl border border-white/50 dark:border-slate-700/60 shadow-xl">
          <p className="text-xs md:text-sm text-slate-950 dark:text-slate-100 font-extrabold leading-relaxed">
            Analisis FASTQ single-end untuk menemukan varian DNA bawang putih, dari unggah hingga hasil yang dapat diunduh.<ContextHelp label="Alur analisis">fastp memeriksa kualitas read, Bowtie2 memetakan read ke reference, SAMtools memproses alignment, dan BCFtools memanggil varian. Reference serta parameter seleksi dipilih sebelum analisis.</ContextHelp>
          </p>
        </div>

        {/* Tombol CTA */}
        <div className="pt-1">
          <Link
            to="/analisis-baru"
            className="inline-flex items-center gap-2.5 bg-blue-600/90 hover:bg-blue-600 text-white font-extrabold text-sm px-6 py-3.5 rounded-2xl shadow-xl shadow-blue-600/30 backdrop-blur-md hover:scale-105 transition-all cursor-pointer"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Mulai Analisis Baru</span>
          </Link>
        </div>

        {/* Ringkasan Spesifikasi Frosted Glass */}
        <div className="max-w-3xl mx-auto bg-white/30 dark:bg-slate-900/45 backdrop-blur-2xl rounded-2xl p-4 border border-white/50 dark:border-slate-700/60 shadow-xl text-xs font-mono text-slate-950 dark:text-slate-100 flex flex-col sm:flex-row justify-around gap-3 text-center sm:text-left font-extrabold">
          <div>
            <span className="text-slate-800 dark:text-slate-400 font-black block sm:inline">SPESIFIKASI: </span>
            <span>Target Spesies: <strong className="text-blue-900 dark:text-blue-300 font-black">Allium sativum L.</strong></span>
          </div>
          <div className="hidden sm:block text-slate-400 dark:text-slate-600">|</div>
          <div>
            <span>Genom Referensi: <strong className="text-blue-900 dark:text-blue-300 font-black">Dipilih dari reference tersedia pada server</strong></span>
          </div>
          <div className="hidden sm:block text-slate-400 dark:text-slate-600">|</div>
          <div>
            <span>Format Input: <strong className="text-blue-900 dark:text-blue-300 font-black">Single-end FASTQ kecil untuk demo; target final hingga 1 GB</strong></span>
          </div>
        </div>
      </section>

      {/* --- ALUR EKSEKUSI PIPELINE (4 KARTU FROSTED GLASS) --- */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/30 dark:bg-slate-900/45 border border-white/50 dark:border-slate-700/60 shadow-lg backdrop-blur-2xl">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
            <h2 className="text-xs font-black font-mono tracking-wider text-slate-950 dark:text-slate-100 uppercase">
              Proses analisis
            </h2>
          </div>
          <span className="px-3 py-1 rounded-xl bg-white/30 dark:bg-slate-900/45 text-slate-950 dark:text-slate-200 text-[11px] font-mono font-black border border-white/50 dark:border-slate-700/60 shadow-lg backdrop-blur-2xl">
            Dari FASTQ ke varian
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 01. INPUT */}
          <div className="bg-white/30 dark:bg-slate-900/45 backdrop-blur-2xl p-5 rounded-2xl border border-white/50 dark:border-slate-700/60 shadow-xl space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-black text-blue-700 dark:text-blue-400">01. INPUT</span>
                <FileInput className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-black text-sm text-slate-950 dark:text-white">Unggah Data FASTQ</h3>
              <p className="text-xs text-slate-950 dark:text-slate-200 leading-relaxed font-extrabold">
                Validasi FASTQ single-end (.fastq / .fastq.gz). Batas unggah demo ditampilkan pada formulir analisis.
              </p>
            </div>

          </div>

          {/* 02. QC */}
          <div className="bg-white/30 dark:bg-slate-900/45 backdrop-blur-2xl p-5 rounded-2xl border border-white/50 dark:border-slate-700/60 shadow-xl space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-black text-blue-700 dark:text-blue-400">02. QC & PREPROC</span>
                <Sliders className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-black text-sm text-slate-950 dark:text-white">Kontrol Kualitas & Trimming</h3>
              <p className="text-xs text-slate-950 dark:text-slate-200 leading-relaxed font-extrabold">
                fastp: Pemotongan sekuens adapter, eliminasi low-quality reads, evaluasi Q20/Q30.
              </p>
            </div>

          </div>

          {/* 03. ALIGNMENT */}
          <div className="bg-white/30 dark:bg-slate-900/45 backdrop-blur-2xl p-5 rounded-2xl border border-white/50 dark:border-slate-700/60 shadow-xl space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-black text-blue-700 dark:text-blue-400">03. ALIGNMENT</span>
                <DnaIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-black text-sm text-slate-950 dark:text-white">Pemetaan Referensi</h3>
              <p className="text-xs text-slate-950 dark:text-slate-200 leading-relaxed font-extrabold">
                Bowtie2 & SAMtools: Pemetaan ke reference terpilih, konversi BAM, sorting, dan indexing CSI.
              </p>
            </div>

          </div>

          {/* 04. CALL & EXPORT */}
          <div className="bg-white/30 dark:bg-slate-900/45 backdrop-blur-2xl p-5 rounded-2xl border border-white/50 dark:border-slate-700/60 shadow-xl space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-black text-blue-700 dark:text-blue-400">04. CALL & EXPORT</span>
                <Database className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-black text-sm text-slate-950 dark:text-white">Identifikasi varian</h3>
              <p className="text-xs text-slate-950 dark:text-slate-200 leading-relaxed font-extrabold">
                Varian dipilih sesuai konfigurasi, lalu disimpan agar hasil dapat ditinjau dan diunduh.
              </p>
            </div>

          </div>
        </div>

      </section>
      <details className="glass-card rounded-2xl p-5">
        <summary className="font-semibold cursor-pointer">Panduan dan batas demo</summary>
        <div className="mt-3 space-y-2 text-sm">
          <p>Beri nama analisis, pilih FASTQ, reference dan ploidi, lalu jalankan. Pantau status dan unduh hasil setelah selesai.</p>
          <p>Demo memakai FASTQ sintetis dan reference 20 kbp. Batas upload 10 MiB dan satu analisis aktif global.</p>
          <p>Full Garlic.V2 dan FASTQ 1 GB belum tervalidasi.</p>
        </div>
      </details>

      {/* --- INTEGRASI TEAM SECTION --- */}
      <TeamSection />

    </div>
  );
};

export default LandingPage;
