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
  Dna,
  Loader2,
  AlertCircle,
  PlayCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { uploadAndRunSample, ApiError, type UploadAndRunResponse } from '../services/api';

export const NewAnalysisPage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { token, isAuthenticated } = useAuth();

  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadAndRunResponse | null>(null);

  const processFileUpload = async (file: File) => {
    if (!token) {
      setErrorMessage('Silakan masuk / login terlebih dahulu untuk mengunggah sampel.');
      return;
    }

    const filename = file.name.toLowerCase();
    const isValidFastq = filename.endsWith('.fastq') || filename.endsWith('.fastq.gz');

    if (!isValidFastq) {
      setErrorMessage('Format berkas tidak didukung. Harap pilih berkas dengan ekstensi .fastq atau .fastq.gz');
      return;
    }

    if (file.size > 1_000_000_000) {
      setErrorMessage('Ukuran berkas melebihi batas maksimum 1 GB.');
      return;
    }

    setSelectedFile(file);
    setUploading(true);
    setErrorMessage(null);
    setUploadResult(null);

    try {
      // Menggunakan Opsi A otomatis: Upload /api/samples/upload -> Create Job /api/jobs
      const result = await uploadAndRunSample(file, token);
      setUploadResult(result);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Terjadi kesalahan jaringan saat mengunggah berkas.');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFileUpload(e.target.files[0]);
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
      processFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleResetFile = () => {
    setUploadResult(null);
    setSelectedFile(null);
    setErrorMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Helper untuk mengekstrak ID Job dan Sample dari struktur respons M8 dengan fallback fleksibel
  const jobId = 
    uploadResult?.job?.id_job ?? 
    uploadResult?.job?.job_id ?? 
    uploadResult?.job?.id ?? 
    uploadResult?.id_job;

  const sampleId = 
    uploadResult?.sample?.id_sample ?? 
    uploadResult?.sample?.sample_id ?? 
    uploadResult?.sample?.id ?? 
    uploadResult?.id_sample;

  const fileNameDisplay = 
    uploadResult?.sample?.nama_berkas ?? 
    (uploadResult?.sample as any)?.original_name ?? 
    selectedFile?.name ?? 
    'sampel.fastq';

  const fileSizeDisplay = 
    uploadResult?.sample?.ukuran_berkas ?? 
    (uploadResult?.sample as any)?.size_bytes ?? 
    selectedFile?.size ?? 
    0;

  const handleSubmitAnalysis = () => {
    if (jobId) {
      navigate(`/jobs/${jobId}`);
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 px-4 py-6">
      {/* Header Halaman */}
      <div className="text-center space-y-2 pt-2">
        <div className="inline-flex items-center gap-1.5 bg-blue-50 dark:bg-slate-800/80 border border-blue-200 dark:border-slate-700/80 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full text-[11px] font-semibold transition-colors duration-300">
          <Dna className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          PIPELINE ALLIUM SATIVUM (AUTOMATED M8)
        </div>

        <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight transition-colors duration-300">
          Mulai Analisis Baru
        </h1>

        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl mx-auto leading-relaxed transition-colors duration-300">
          Unggah berkas FASTQ untuk mendeteksi varian genomik. Pipeline eksekusi otomatis memicu Fastp, Bowtie2, SAMtools, dan BCFtools secara otomatis di latar belakang server IPB.
        </p>
      </div>

      {/* Kartu Utama Upload */}
      <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5 transition-colors duration-300">
        
        {/* Banner Info Format Pustaka */}
        <div className="bg-blue-50/60 dark:bg-slate-800/60 border border-blue-100 dark:border-slate-700/60 rounded-xl p-3 flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 transition-colors duration-300">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>
              <strong>Format Pustaka:</strong> Single-End (SE) FASTQ (<code className="bg-blue-100/70 dark:bg-slate-700 text-blue-800 dark:text-blue-300 px-1 py-0.5 rounded font-mono text-[11px]">.fastq</code>, <code className="bg-blue-100/70 dark:bg-slate-700 text-blue-800 dark:text-blue-300 px-1 py-0.5 rounded font-mono text-[11px]">.fastq.gz</code>)
            </span>
          </div>
          <span className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[10px] font-bold text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded shrink-0">
            Maks. 1 GB
          </span>
        </div>

        {/* Peringatan Belum Login */}
        {!isAuthenticated && (
          <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-xl text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between transition-colors duration-300">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Anda belum masuk ke akun. Silakan login terlebih dahulu untuk mengunggah sampel.</span>
            </div>
            <Link to="/login" className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1 rounded-lg text-xs transition-colors">
              Masuk / Login
            </Link>
          </div>
        )}

        {/* Input File Tersembunyi */}
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileInputChange} 
          accept=".fastq,.gz,.fastq.gz"
          className="hidden" 
          disabled={uploading || !isAuthenticated}
        />

        {/* STATE DEFAULT & UPLOADING */}
        {!uploadResult ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all ${
              isDragging 
                ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30' 
                : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 bg-slate-50/30 dark:bg-slate-800/30'
            }`}
          >
            {uploading ? (
              <div className="space-y-3 py-4">
                <Loader2 className="w-10 h-10 text-blue-600 dark:text-blue-400 animate-spin mx-auto" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Mengunggah Berkas & Memicu Pipeline Bioinformatika...
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                  {selectedFile?.name} ({(selectedFile ? selectedFile.size / (1024 * 1024) : 0).toFixed(2)} MB)
                </p>
              </div>
            ) : (
              <>
                <div className="w-12 h-12 bg-blue-50 dark:bg-slate-800 border border-blue-100 dark:border-slate-700 rounded-2xl text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-3 shadow-sm">
                  <UploadCloud className="w-6 h-6" />
                </div>

                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                  Pilih berkas FASTQ lokal atau seret ke sini
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-5">
                  Ekstensi resmi: <code className="font-mono text-blue-600 dark:text-blue-400">.fastq</code> atau <code className="font-mono text-blue-600 dark:text-blue-400">.fastq.gz</code>
                </p>

                <button
                  type="button"
                  disabled={!isAuthenticated}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-md shadow-blue-500/20 transition-all cursor-pointer disabled:cursor-not-allowed"
                >
                  <FolderOpen className="w-4 h-4" /> Telusuri Berkas Komputer
                </button>
              </>
            )}
          </div>
        ) : (
          /* STATE FILE UPLOADED & JOB AUTOMATED (M8) */
          <div className="space-y-4">
            {/* Box Status Terunggah */}
            <div className="border-2 border-dashed border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/20 dark:bg-emerald-950/20 rounded-2xl p-8 text-center transition-colors duration-300">
              <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3 shadow-sm">
                <CheckCircle2 className="w-6 h-6" />
              </div>

              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
                Berkas Berhasil Diunggah & Job Dijadwalkan!
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Pipeline bioinformatika otomatis memproses file dalam antrean server (Status: <strong>QUEUED</strong>).
              </p>

              <button
                type="button"
                onClick={() => {
                  handleResetFile();
                  setTimeout(() => fileInputRef.current?.click(), 100);
                }}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-md shadow-blue-500/20 transition-all cursor-pointer"
              >
                <FolderOpen className="w-4 h-4" /> Unggah Berkas Lain
              </button>
            </div>

            {/* Kartu Rincian File dan Job M8 */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm transition-colors duration-300">
              <div className="bg-slate-50/80 dark:bg-slate-800/60 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <PlayCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Auto-Trigger Job Pipeline (M8)
                </span>
                <div className="flex items-center gap-2">
                  {sampleId && (
                    <span className="bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 font-bold px-2 py-0.5 rounded text-[10px] border border-blue-200 dark:border-blue-800 font-mono">
                      Sample #{sampleId}
                    </span>
                  )}
                  {jobId && (
                    <span className="bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold px-2 py-0.5 rounded text-[10px] border border-emerald-200 dark:border-emerald-800 font-mono">
                      Job #{jobId}
                    </span>
                  )}
                </div>
              </div>

              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-100 dark:border-slate-700/60">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 dark:bg-slate-700 border border-blue-100 dark:border-slate-600 rounded-lg text-blue-600 dark:text-blue-400">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono">{fileNameDisplay}</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Ukuran Terkompresi: {(fileSizeDisplay / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleResetFile}
                    className="flex items-center gap-1 border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-400 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Hapus
                  </button>
                </div>

                <div className="flex justify-between items-center text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-1">
                  <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Staging & Auto-Run Execution Enqueued
                  </span>
                  <span>{new Date().toLocaleTimeString('id-ID')}</span>
                </div>
              </div>
            </div>

            {/* Tombol Aksi Batal / Kirim */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleResetFile}
                className="flex items-center gap-1.5 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-5 py-2.5 rounded-xl text-xs transition-all cursor-pointer"
              >
                <X className="w-4 h-4" /> Batal
              </button>

              <button
                type="button"
                onClick={handleSubmitAnalysis}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-md shadow-blue-500/20 transition-all cursor-pointer"
              >
                Pantau Progres Job di Dashboard <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Pesan Error */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2 transition-colors duration-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

      </div>

      {/* Catatan Alur Eksekusi */}
      <div className="bg-slate-100/80 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 flex items-start gap-3 text-xs text-slate-600 dark:text-slate-400 transition-colors duration-300">
        <RefreshCw className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          Setelah berkas terkirim, seluruh tahap pemanggilan varian genomik (<strong>Fastp QC ➔ Penjajaran Bowtie2 ➔ SAMtools ➔ BCFtools Variant Calling</strong>) dieksekusi secara otomatis dan statusnya dapat dipantau langsung pada <Link to="/dashboard" className="text-blue-600 dark:text-blue-400 font-bold hover:underline">Dashboard Job</Link>.
        </div>
      </div>
    </div>
  );
};