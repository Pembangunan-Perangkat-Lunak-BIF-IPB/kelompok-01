import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  UploadCloud, 
  CheckCircle2, 
  FolderOpen, 
  FileText, 
  Trash2, 
  Info, 
  RefreshCw, 
  ArrowRight, 
  X,
  Dna
} from 'lucide-react';

interface UploadedFileInfo {
  name: string;
  sizeMB: number;
  lines: string;
  checksum: string;
}

export const NewAnalysisPage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [fileInfo, setFileInfo] = useState<UploadedFileInfo | null>(null);

  // Simulasi penanganan upload file
  const handleFileSelect = (file: File) => {
    // Membuat data dummy metadata file sesuai format antarmuka
    const mockInfo: UploadedFileInfo = {
      name: file.name.endsWith('.fastq.gz') || file.name.endsWith('.fq') ? file.name : `${file.name.split('.')[0]}_R1.fastq.gz`,
      sizeMB: Math.round((file.size / (1024 * 1024)) || 642),
      lines: '~18,400,000 baris',
      checksum: '8fa7e3c9210b'
    };
    setFileInfo(mockInfo);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleRemoveFile = () => {
    setFileInfo(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmitAnalysis = () => {
    // Alihkan pengguna ke dashboard job setelah mengirim analisis
    navigate('/dashboard');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Halaman */}
      <div className="text-center space-y-2 pt-2">
        <div className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1 rounded-full text-[11px] font-semibold">
          <Dna className="w-3.5 h-3.5 text-blue-600" />
          PIPELINE ALLIUM SATIVUM
        </div>

        <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
          Mulai Analisis Baru
        </h1>

        <p className="text-xs text-slate-500 max-w-xl mx-auto leading-relaxed">
          Unggah berkas pembacaan sekuens FASTQ untuk mendeteksi varian genomik. Pipeline pemanggilan varian otomatis dieksekusi di latar belakang pada server komputasi IPB.
        </p>
      </div>

      {/* Kartu Utama Upload */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
        
        {/* Banner Info Format Pustaka */}
        <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3 flex items-center justify-between text-xs text-slate-700">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              <strong>Format Pustaka:</strong> Single-End (SE) FASTQ (<code className="bg-blue-100/70 text-blue-800 px-1 py-0.5 rounded font-mono text-[11px]">.fastq</code>, <code className="bg-blue-100/70 text-blue-800 px-1 py-0.5 rounded font-mono text-[11px]">.fq</code>, <code className="bg-blue-100/70 text-blue-800 px-1 py-0.5 rounded font-mono text-[11px]">.fastq.gz</code>, <code className="bg-blue-100/70 text-blue-800 px-1 py-0.5 rounded font-mono text-[11px]">.fq.gz</code>)
            </span>
          </div>
          <span className="bg-white border border-slate-200 font-mono text-[10px] font-bold text-slate-500 px-2 py-0.5 rounded shrink-0">
            Maks. 1 GB
          </span>
        </div>

        {/* Input File Tersembunyi */}
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileInputChange} 
          accept=".fastq,.fq,.gz"
          className="hidden" 
        />

        {/* ========================================================= */}
        {/* KONDISI 1: DEFAULT STATE (BELUM ADA FILE)                  */}
        {/* ========================================================= */}
        {!fileInfo ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all ${
              isDragging 
                ? 'border-blue-500 bg-blue-50/50' 
                : 'border-slate-300 hover:border-slate-400 bg-slate-50/30'
            }`}
          >
            <div className="w-12 h-12 bg-blue-50 border border-blue-100 rounded-2xl text-blue-600 flex items-center justify-center mx-auto mb-3 shadow-sm">
              <UploadCloud className="w-6 h-6" />
            </div>

            <h3 className="text-sm font-bold text-slate-800 mb-1">
              Pilih berkas FASTQ lokal atau seret ke sini
            </h3>
            <p className="text-xs text-slate-400 mb-5">
              Format kompresi GZIP disarankan untuk transfer berkas yang lebih cepat
            </p>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-md shadow-blue-500/20 transition-all"
            >
              <FolderOpen className="w-4 h-4" /> Telusuri Berkas Komputer
            </button>
          </div>
        ) : (
          /* ========================================================= */
          /* KONDISI 2: FILE UPLOADED STATE                             */
          /* ========================================================= */
          <div className="space-y-4">
            {/* Box Status Terunggah */}
            <div className="border-2 border-dashed border-emerald-200 bg-emerald-50/20 rounded-2xl p-8 text-center">
              <div className="w-12 h-12 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-600 flex items-center justify-center mx-auto mb-3 shadow-sm">
                <CheckCircle2 className="w-6 h-6" />
              </div>

              <h3 className="text-sm font-bold text-slate-900 mb-4">
                File Berhasil diupload !
              </h3>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-md shadow-blue-500/20 transition-all"
              >
                <FolderOpen className="w-4 h-4" /> Telusuri Berkas Komputer
              </button>
            </div>

            {/* Kartu Rincian File Terpilih */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
              <div className="bg-slate-50/80 px-4 py-2.5 border-b border-slate-200 flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Berkas Terpilih & Terverifikasi MD5
                </span>
                <span className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full text-[10px]">
                  Siap Dikirim
                </span>
              </div>

              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 border border-blue-100 rounded-lg text-blue-600">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 font-mono">{fileInfo.name}</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Ukuran: {fileInfo.sizeMB} MB • GZIP Compressed • {fileInfo.lines}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="flex items-center gap-1 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Hapus
                  </button>
                </div>

                <div className="flex justify-between items-center text-[11px] font-mono text-slate-500 pt-1">
                  <span className="flex items-center gap-1.5 text-emerald-600 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span> 100% Selesai Terunggah & Header Valid
                  </span>
                  <span>Checksum: {fileInfo.checksum}</span>
                </div>
              </div>
            </div>

            {/* Tombol Aksi Batal / Kirim */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleRemoveFile}
                className="flex items-center gap-1.5 border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold px-5 py-2.5 rounded-xl text-xs transition-all"
              >
                <X className="w-4 h-4" /> Batal
              </button>

              <button
                type="button"
                onClick={handleSubmitAnalysis}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-md shadow-blue-500/20 transition-all"
              >
                Kirim & Pantau Progres di Dashboard Job <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Catatan Alur Eksekusi */}
      <div className="bg-slate-100/80 border border-slate-200/80 rounded-xl p-4 flex items-start gap-3 text-xs text-slate-600">
        <RefreshCw className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          Setelah berkas terkirim, seluruh tahap pemanggilan varian genomik (<strong>Fastp QC ➔ Penjajaran BWA-MEM2 ➔ Mark Duplicates ➔ GATK Variant Calling & Filtrasi</strong>) akan dieksekusi secara otomatis dan statusnya dapat dipantau langsung secara real-time pada <Link to="/dashboard" className="text-blue-600 font-bold hover:underline">Dashboard Job</Link>.
        </div>
      </div>
    </div>
  );
};