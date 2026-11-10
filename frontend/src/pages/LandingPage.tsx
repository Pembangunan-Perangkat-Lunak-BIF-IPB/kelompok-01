import { ContextHelp } from '../components/ContextHelp';
import React from 'react';
import { Link } from 'react-router-dom';
import { Play, FileInput, Sliders, Dna as DnaIcon, Database, ArrowRight } from 'lucide-react';
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
          <span className="text-slate-950 dark:text-slate-100">VERSI INTEGRASI DEMO / NEXTFLOW & FASTAPI</span>
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
              Alur Eksekusi Pipeline Otomatis
            </h2>
          </div>
          <span className="px-3 py-1 rounded-xl bg-white/30 dark:bg-slate-900/45 text-slate-950 dark:text-slate-200 text-[11px] font-mono font-black border border-white/50 dark:border-slate-700/60 shadow-lg backdrop-blur-2xl">
            DIAGRAM LOGIKA PROSES
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
            <div className="pt-2">
              <span className="inline-block px-2.5 py-1 rounded-lg bg-white/40 dark:bg-slate-800/60 text-slate-950 dark:text-slate-100 font-mono text-[10px] font-black border border-white/50 dark:border-slate-700/60 backdrop-blur-md">
                CMD: multipart/form-data
              </span>
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
            <div className="pt-2">
              <span className="inline-block px-2.5 py-1 rounded-lg bg-white/40 dark:bg-slate-800/60 text-slate-950 dark:text-slate-100 font-mono text-[10px] font-black border border-white/50 dark:border-slate-700/60 backdrop-blur-md">
                TOOL: fastp (konfigurasi server)
              </span>
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
            <div className="pt-2">
              <span className="inline-block px-2.5 py-1 rounded-lg bg-white/40 dark:bg-slate-800/60 text-slate-950 dark:text-slate-100 font-mono text-[10px] font-black border border-white/50 dark:border-slate-700/60 backdrop-blur-md">
                TOOL: bowtie2 & samtools
              </span>
            </div>
          </div>

          {/* 04. CALL & EXPORT */}
          <div className="bg-white/30 dark:bg-slate-900/45 backdrop-blur-2xl p-5 rounded-2xl border border-white/50 dark:border-slate-700/60 shadow-xl space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-black text-blue-700 dark:text-blue-400">04. CALL & EXPORT</span>
                <Database className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-black text-sm text-slate-950 dark:text-white">Calling Varian & Ingestion</h3>
              <p className="text-xs text-slate-950 dark:text-slate-200 leading-relaxed font-extrabold">
                BCFtools: Pemanggilan dan seleksi varian berdasarkan konfigurasi, lalu penyimpanan hasil ke basis data.
              </p>
            </div>
            <div className="pt-2">
              <span className="inline-block px-2.5 py-1 rounded-lg bg-white/40 dark:bg-slate-800/60 text-slate-950 dark:text-slate-100 font-mono text-[10px] font-black border border-white/50 dark:border-slate-700/60 backdrop-blur-md">
                TOOL: bcftools & postgresql
              </span>
            </div>
          </div>
        </div>

        {/* Banner Rute Data Stream Frosted */}
        <div className="bg-white/30 dark:bg-slate-900/45 backdrop-blur-2xl p-4 rounded-2xl border border-white/50 dark:border-slate-700/60 shadow-xl flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-slate-950 dark:text-slate-100 gap-2">
          <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
            <span className="font-black text-slate-950 dark:text-white">RUTE DATA:</span>
            <span className="px-2 py-0.5 rounded bg-white/40 dark:bg-slate-800/60 font-black text-slate-950 dark:text-slate-100 backdrop-blur-md border border-white/40 dark:border-slate-700/50">[RAW FASTQ]</span>
            <ArrowRight className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span className="px-2 py-0.5 rounded bg-white/40 dark:bg-slate-800/60 font-black text-slate-950 dark:text-slate-100 backdrop-blur-md border border-white/40 dark:border-slate-700/50">[FASTP QC]</span>
            <ArrowRight className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span className="px-2 py-0.5 rounded bg-white/40 dark:bg-slate-800/60 font-black text-slate-950 dark:text-slate-100 backdrop-blur-md border border-white/40 dark:border-slate-700/50">[BOWTIE2 BAM/CSI]</span>
            <ArrowRight className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span className="px-2 py-0.5 rounded bg-white/40 dark:bg-slate-800/60 font-black text-slate-950 dark:text-slate-100 backdrop-blur-md border border-white/40 dark:border-slate-700/50">[BCFTOOLS VCF]</span>
            <ArrowRight className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-950 dark:text-emerald-300 font-black border border-emerald-500/40 backdrop-blur-md">DB POSTGRESQL</span>
          </div>
          <span className="text-[11px] text-blue-800 dark:text-blue-300 font-black">
            ENGINE: Nextflow DSL2 (single-end)
          </span>
        </div>
      </section>

      {/* --- TABEL SOP / PETUNJUK LABORATORIUM FROSTED GLASS --- */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/30 dark:bg-slate-900/45 border border-white/50 dark:border-slate-700/60 shadow-lg backdrop-blur-2xl">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="text-xs font-black font-mono tracking-wider text-slate-950 dark:text-slate-100 uppercase">
              Petunjuk Penggunaan Laboratorium
            </h2>
          </div>
          <span className="px-3 py-1 rounded-xl bg-white/30 dark:bg-slate-900/45 text-slate-950 dark:text-slate-200 font-mono text-[10px] font-black border border-white/50 dark:border-slate-700/60 shadow-lg backdrop-blur-2xl">
            SOP PRAKTIKUM
          </span>
        </div>

        <div className="bg-white/30 dark:bg-slate-900/45 backdrop-blur-2xl rounded-2xl border border-white/50 dark:border-slate-700/60 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="bg-white/40 dark:bg-slate-800/60 text-slate-950 dark:text-slate-100 border-b border-white/50 dark:border-slate-700/60 backdrop-blur-md">
                  <th className="py-3 px-4 font-black">TAHAP</th>
                  <th className="py-3 px-4 font-black">TINDAKAN PRAKTIKAN / PENELITI</th>
                  <th className="py-3 px-4 font-black">FORMAT KELUARAN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/30 dark:divide-slate-800/50 text-slate-950 dark:text-slate-200">
                <tr className="hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="py-3 px-4 font-black text-blue-700 dark:text-blue-400">01.</td>
                  <td className="py-3 px-4 font-extrabold">Buka menu "Analisis Baru" dan pilih berkas Single-End FASTQ (.fastq / .fastq.gz).</td>
                  <td className="py-3 px-4 text-slate-950 dark:text-slate-100 font-black">Berkas terpilih; belum dikirim</td>
                </tr>
                <tr className="hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="py-3 px-4 font-black text-blue-700 dark:text-blue-400">02.</td>
                  <td className="py-3 px-4 font-extrabold">Pilih reference dan ploidi sesuai dataset, lalu periksa parameter QUAL dan FORMAT/DP.</td>
                  <td className="py-3 px-4 text-slate-950 dark:text-slate-100 font-black">Konfigurasi sebelum eksekusi</td>
                </tr>
                <tr className="hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="py-3 px-4 font-black text-blue-700 dark:text-blue-400">03.</td>
                  <td className="py-3 px-4 font-extrabold">Tekan Jalankan Analisis untuk mengirim berkas dan konfigurasi. Server memvalidasi input dan menjadwalkan Job.</td>
                  <td className="py-3 px-4 text-slate-950 dark:text-slate-100 font-black">Job dan status dari server</td>
                </tr>
                <tr className="hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="py-3 px-4 font-black text-blue-700 dark:text-blue-400">04.</td>
                  <td className="py-3 px-4 font-extrabold">Pantau status eksekusi real-time pada "Dashboard Job" hingga status menunjukkan COMPLETED.</td>
                  <td className="py-3 px-4 text-emerald-800 dark:text-emerald-400 font-black">status: COMPLETED / FAILED</td>
                </tr>
                <tr className="hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="py-3 px-4 font-black text-blue-700 dark:text-blue-400">05.</td>
                  <td className="py-3 px-4 font-extrabold">Buka hasil untuk meninjau tabel serta mengunduh VCF hasil seleksi analisis dan CSV seluruh hasil sesuai filter aktif.</td>
                  <td className="py-3 px-4 text-slate-950 dark:text-slate-100 font-black">Tabel hasil, VCF & CSV</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* --- INTEGRASI TEAM SECTION --- */}
      <TeamSection />

    </div>
  );
};

export default LandingPage;
