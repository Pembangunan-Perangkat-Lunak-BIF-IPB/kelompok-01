import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, FileUp, Sliders, Cpu, FileCheck, Server } from 'lucide-react';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      {/* Hero Section */}
      <section className="max-w-4xl mx-auto px-6 pt-10 pb-8 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-full px-3 py-1 text-[11px] font-mono text-blue-700 mb-4">
          <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
          Paket A: Pipeline Bioinformatika Nextflow & FastAPI <span className="text-slate-400">| BUILD: v1.0-STABLE / NEXTFLOW-ASYNC</span>
        </div>

        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-3 tracking-tight">
          Alat Analisis Variant Calling Bawang Putih Otomatis
        </h1>

        <p className="text-xs text-slate-600 max-w-2xl mx-auto mb-6 leading-relaxed">
          Otomatisasi pemrosesan genomik <em>Allium sativum</em> (Bawang Putih) mulai dari kontrol kualitas FASTQ, pemetaan referensi Garlic.V2, hingga ekstraksi varian teranotasi VCF/CSV berbasis komputasi asinkron berkinerja tinggi.
        </p>

        <div className="flex justify-center mb-6">
          <button
            onClick={() => navigate('/login')}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20"
          >
            <Play className="w-4 h-4 fill-current" /> Mulai Analisis Baru
          </button>
        </div>

        {/* Card Spesifikasi */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 max-w-3xl mx-auto text-left flex flex-wrap justify-around text-xs text-slate-600 gap-2 shadow-sm font-mono">
          <div><span className="text-slate-400 uppercase text-[10px]">SPESIFIKASI:</span> Target Spesies: <strong>Allium sativum L.</strong></div>
          <div>Genom Referensi: <strong>Garlic.V2 (AlliumDB)</strong></div>
          <div>Format Input: <strong>FASTQ Single-End & Paired-End (Maks 1 GB)</strong></div>
        </div>
      </section>

      {/* Diagram Alur Eksekusi */}
      <section className="max-w-5xl mx-auto px-6 py-6">
        <div className="flex justify-between items-center mb-4 border-b border-slate-200 pb-2">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-600 rounded-full"></span> Alur Eksekusi Pipeline Otomatis
          </h2>
          <span className="text-[10px] font-mono text-slate-400">DIAGRAM LOGIKA PROSES</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
            <div className="flex items-center justify-between text-xs text-blue-600 mb-2 font-mono font-bold">
              <span>01. INPUT</span>
              <FileUp className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-xs text-slate-800 mb-1">Unggah Data FASTQ</h3>
            <p className="text-[11px] text-slate-500 leading-snug mb-3">Validasi berkas Single-End / Paired-End maks 1 GB via REST API multipart upload aman.</p>
            <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">CMD: multipart/form-data</span>
          </div>

          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
            <div className="flex items-center justify-between text-xs text-emerald-600 mb-2 font-mono font-bold">
              <span>02. QC & PREPROC</span>
              <Sliders className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-xs text-slate-800 mb-1">Kontrol Kualitas & Trimming</h3>
            <p className="text-[11px] text-slate-500 leading-snug mb-3">fastp v0.23: Pemotongan sekuens adapter, eliminasi low-quality reads, evaluasi Q20/Q30.</p>
            <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">TOOL: fastp -q 20 -u 30</span>
          </div>

          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
            <div className="flex items-center justify-between text-xs text-indigo-600 mb-2 font-mono font-bold">
              <span>03. ALIGNMENT</span>
              <Cpu className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-xs text-slate-800 mb-1">Pemetaan Referensi</h3>
            <p className="text-[11px] text-slate-500 leading-snug mb-3">BWA-MEM2 & SAMtools: Pemetaan ke Garlic.V2, konversi BAM, coordinate sorting, & pengindeksan.</p>
            <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">TOOL: bwa-mem2 & samtools</span>
          </div>

          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
            <div className="flex items-center justify-between text-xs text-amber-600 mb-2 font-mono font-bold">
              <span>04. CALL & EXPORT</span>
              <FileCheck className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-xs text-slate-800 mb-1">Calling Varian & Ekspor</h3>
            <p className="text-[11px] text-slate-500 leading-snug mb-3">BCFtools: Pemanggilan varian genom, filtering QUAL/DP, anotasi lokasi genetik, & ekspor VCF/CSV.</p>
            <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">TOOL: bcftools mpileup/call</span>
          </div>
        </div>

        <div className="mt-4 bg-slate-100 border border-slate-200 rounded-xl p-3 flex justify-between items-center text-[11px] font-mono text-slate-600">
          <div>RUTE DATA: <span>[RAW FASTQ] ➔ [FASTP QC] ➔ [BAM/BAI] ➔ [RAW BCF] ➔ [FILTERED VCF / CSV]</span></div>
          <span className="text-blue-600 font-bold">ENGINE: Nextflow DSL2</span>
        </div>
      </section>

      {/* Tabel Petunjuk SOP */}
      <section className="max-w-5xl mx-auto px-6 py-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Petunjuk Penggunaan Laboratorium</h2>
          <span className="text-[10px] font-mono bg-slate-200 text-slate-700 px-2 py-0.5 rounded">SOP PRAKTIKUM</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-mono text-slate-600 text-[11px]">
                <th className="p-3">TAHAP</th>
                <th className="p-3">TINDAKAN PRAKTIKAN / PENELITI</th>
                <th className="p-3">FORMAT KELUARAN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              <tr>
                <td className="p-3 font-mono font-bold text-blue-600">01.</td>
                <td className="p-3">Buka tab "Analisis Baru", pilih mode Single atau Paired-End. Masukkan nama batch penelitian.</td>
                <td className="p-3 font-mono text-slate-500">JOB_ID (UUIDv4)</td>
              </tr>
              <tr>
                <td className="p-3 font-mono font-bold text-blue-600">02.</td>
                <td className="p-3">Unggah berkas FASTQ atau gunakan dataset kontrol Allium sativum dari repository praktikum.</td>
                <td className="p-3 font-mono text-slate-500">.fastq.gz / SRA</td>
              </tr>
              <tr>
                <td className="p-3 font-mono font-bold text-blue-600">03.</td>
                <td className="p-3">Atur threshold Q-score minimal (default: Q20) dan batas kedalaman bacaan (DP minimal: 10x).</td>
                <td className="p-3 font-mono text-slate-500">config.json</td>
              </tr>
              <tr>
                <td className="p-3 font-mono font-bold text-blue-600">04.</td>
                <td className="p-3">Pantau status eksekusi terminal di "Dashboard Job" hingga status menampilkan COMPLETED.</td>
                <td className="p-3 font-mono text-slate-500">stdout.log</td>
              </tr>
              <tr>
                <td className="p-3 font-mono font-bold text-blue-600">05.</td>
                <td className="p-3">Unduh laporan terkompresi atau telusuri tabel SNP/InDel interaktif melalui modul visualisasi.</td>
                <td className="p-3 font-mono text-slate-500">.vcf.gz, .csv, HTML</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-slate-400 mt-2 font-mono">Data FASTQ yang diunggah disimpan sementara selama 72 jam pada object store internal.</p>
      </section>

      {/* Tim Pengembang */}
      <section className="max-w-5xl mx-auto px-6 py-6 border-t border-slate-200 mt-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-600 rounded-full"></span> Tim Pengembang Proyek Praktikum
            </h2>
            <p className="text-[11px] text-slate-500">Program Studi Bioinformatika — IPB University</p>
          </div>
          <span className="text-[10px] font-mono text-slate-400">KONTRIBUTOR MAHASISWA</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {[
            { name: 'Roni Andripan', role: 'Software Tester', id: 'G4401241005' },
            { name: 'Fajar Dhuha Zafran', role: 'Back-End Developer', id: 'G4401241069' },
            { name: 'Rafif Alfarrel Nugroho', role: 'Project Manager', id: 'G4401241015' },
            { name: 'Azril Ilham Fajrian', role: 'Front-End Developer', id: 'G4401241028' },
            { name: 'Aldo Rafiz Aprilian', role: 'System Analyst', id: 'G4401241031' },
          ].map((member, idx) => (
            <div key={idx} className="bg-white border border-slate-200 p-3 rounded-xl shadow-sm">
              <span className="text-[9px] font-mono text-slate-400 block mb-1">{member.id}</span>
              <h4 className="font-bold text-xs text-slate-800">{member.name}</h4>
              <p className="text-[10px] text-blue-600 font-medium mb-2">{member.role}</p>
              <span className="text-[9px] font-mono text-slate-400 uppercase border-t border-slate-100 pt-1 block">IPB-BIOINFORMATIKA</span>
            </div>
          ))}
        </div>
      </section>

      {/* Footer Status & Infrastruktur */}
      <footer className="bg-slate-900 text-slate-400 text-xs py-4 px-6 mt-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-2 font-mono text-[11px]">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-blue-400" />
            <span>STATUS INFRASTRUKTUR LAB: Spesifikasi: Cloud Compute 32 GB RAM | Storage 500 GB | Nextflow v23.x | PostgreSQL 15</span>
          </div>
        </div>
        <div className="max-w-5xl mx-auto border-t border-slate-800 mt-3 pt-3 flex justify-between items-center text-[10px] text-slate-500">
          <p>© 2026 Tim GenoPath | Bioinformatika IPB University. Dibuat untuk Proyek Praktikum Bioinformatika.</p>
          <span className="font-mono">v1.0-prod :: Garlic Genome Assembly ASM1234v1</span>
        </div>
      </footer>
    </div>
  );
};