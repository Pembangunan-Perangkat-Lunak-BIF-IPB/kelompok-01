import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  UploadCloud, 
  FolderOpen, 
  FileText, 
  Trash2, 
  Loader2,
  AlertCircle,
  PlayCircle,
  Lock,
  Unlock,
  RotateCcw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { uploadAndRunSample, ApiError, type UploadAndRunResponse } from '../services/api';

export const NewAnalysisPage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { token, isAuthenticated } = useAuth();

  // State Pengunggahan File & Error
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadAndRunResponse | null>(null);

  // --- STATE PARAMETER VARIANT CALLING & THRESHOLD ---
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);
  const [minQual, setMinQual] = useState<number | string>(30.0);
  const [minDp, setMinDp] = useState<number | string>(10);

  // Handler Scroll Touchpad / Wheel (Tarik ke Atas = Angka Naik)
  const handleWheelQual = (e: React.WheelEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (!isAdvancedMode) return;
    const currentVal = Number(minQual) || 0;
    if (e.deltaY < 0) {
      setMinQual(Number((currentVal + 0.5).toFixed(1)));
    } else if (e.deltaY > 0) {
      setMinQual(Math.max(0, Number((currentVal - 0.5).toFixed(1))));
    }
  };

  const handleWheelDp = (e: React.WheelEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (!isAdvancedMode) return;
    const currentVal = Number(minDp) || 1;
    if (e.deltaY < 0) {
      setMinDp(currentVal + 1);
    } else if (e.deltaY > 0) {
      setMinDp(Math.max(1, currentVal - 1));
    }
  };

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
      const optionsPayload = {
        library_type: 'SE',
        reference_genome: 'Garlic.V2 (ASM12345v1)',
        min_qual: minQual === '' ? 0 : Number(minQual),
        min_dp: minDp === '' ? 1 : Number(minDp),
        custom_flags: '',
        is_advanced: isAdvancedMode,
      };

      const result = await uploadAndRunSample(file, token, optionsPayload as any);
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

  const handleResetParameters = () => {
    setMinQual(30.0);
    setMinDp(10);
  };

  const jobId = 
    uploadResult?.job?.id_job ?? 
    uploadResult?.job?.job_id ?? 
    uploadResult?.job?.id ?? 
    uploadResult?.id_job;

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
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      
      {/* --- HEADER HALAMAN --- */}
      <div className="text-center space-y-4 pt-2">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-snug pb-3 max-w-4xl mx-auto text-transparent bg-clip-text bg-gradient-to-r from-slate-950 via-blue-950 to-slate-900 dark:from-white dark:via-blue-100 dark:to-slate-200 drop-shadow-[0_2px_12px_rgba(255,255,255,0.9)] dark:drop-shadow-md">
          Mulai Analisis Varian Baru
        </h1>

        <div className="max-w-2xl mx-auto bg-white/35 dark:bg-slate-900/50 backdrop-blur-2xl p-5 rounded-2xl border border-white/60 dark:border-slate-700/60 shadow-xl">
          <p className="text-base md:text-lg text-slate-950 dark:text-slate-100 font-extrabold leading-relaxed">
            Unggah berkas mentah FASTQ dan atur parameter threshold variant calling untuk deteksi varian genomik otomatis di server IPB.
          </p>
        </div>
      </div>

      {/* --- SEKSI 01: SAMPLE SEQUENCE INPUT (FASTQ) --- */}
      <div className="bg-white/35 dark:bg-slate-900/50 backdrop-blur-2xl rounded-3xl p-6 md:p-8 border border-white/60 dark:border-slate-700/60 shadow-xl space-y-5">
        <div className="flex items-center border-b border-white/40 dark:border-slate-800 pb-3">
          <span className="text-xs md:text-sm font-mono font-black text-blue-700 dark:text-blue-400 flex items-center gap-2">
            <span className="w-7 h-7 rounded-xl bg-blue-600/20 text-blue-900 dark:text-blue-300 flex items-center justify-center font-bold">01</span>
            INPUT SEKUENS SAMPEL (FASTQ)
          </span>
        </div>

        {/* Peringatan Belum Login */}
        {!isAuthenticated && (
          <div className="p-4 bg-amber-500/20 border border-amber-500/40 backdrop-blur-md rounded-2xl text-amber-950 dark:text-amber-200 text-xs md:text-sm font-black flex items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Anda belum masuk ke akun. Silakan login terlebih dahulu untuk mengunggah sampel.</span>
            </div>
            <Link to="/login" className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold px-4 py-2 rounded-xl text-xs md:text-sm transition-colors shrink-0 shadow-md">
              Masuk / Login
            </Link>
          </div>
        )}

        {/* Hidden Input File */}
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileInputChange} 
          accept=".fastq,.gz,.fastq.gz"
          className="hidden" 
          disabled={uploading || !isAuthenticated}
        />

        {/* Dropzone Area */}
        {!uploadResult ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-3xl p-8 md:p-10 text-center transition-all backdrop-blur-md flex flex-col items-center justify-center ${
              isDragging 
                ? 'border-blue-500 bg-blue-500/25 scale-[1.01]' 
                : 'border-blue-500/50 dark:border-blue-400/40 bg-white/30 dark:bg-slate-800/40 hover:bg-white/50 dark:hover:bg-slate-800/60'
            }`}
          >
            {uploading ? (
              <div className="space-y-3 py-4">
                <Loader2 className="w-10 h-10 text-blue-600 dark:text-blue-400 animate-spin mx-auto" />
                <h3 className="text-base md:text-lg font-black text-slate-950 dark:text-white">
                  Mengunggah Berkas & Memicu Pipeline Bioinformatika...
                </h3>
                <p className="text-xs md:text-sm text-slate-950 dark:text-slate-200 font-mono font-bold">
                  {selectedFile?.name} ({(selectedFile ? selectedFile.size / (1024 * 1024) : 0).toFixed(2)} MB)
                </p>
              </div>
            ) : (
              <>
                <div className="p-4 rounded-2xl bg-blue-600/20 text-blue-700 dark:text-blue-300 backdrop-blur-md border border-blue-500/30 shadow-inner mb-3">
                  <UploadCloud className="w-8 h-8" />
                </div>

                <h3 className="text-base md:text-lg font-black text-slate-950 dark:text-white mb-2">
                  Seret & lepas berkas sekuensing FASTQ ke sini, atau telusuri berkas lokal
                </h3>
                <p className="text-xs md:text-sm font-mono font-extrabold text-slate-950 dark:text-slate-200 mb-6">
                  Ukuran Maksimum: <code className="font-black text-blue-800 dark:text-blue-300">1.0 GB</code> • Ekstensi: <code className="font-black text-blue-800 dark:text-blue-300">.fastq</code>, <code className="font-black text-blue-800 dark:text-blue-300">.fastq.gz</code>
                </p>

                <button
                  type="button"
                  disabled={!isAuthenticated}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400/60 dark:disabled:bg-slate-700/60 text-white font-black px-6 py-3 rounded-xl text-xs md:text-sm shadow-lg shadow-blue-600/30 backdrop-blur-md transition-all cursor-pointer disabled:cursor-not-allowed"
                >
                  <FolderOpen className="w-4 h-4 md:w-5 md:h-5" />
                  <span>Telusuri Berkas Komputer</span>
                </button>
              </>
            )}
          </div>
        ) : (
          /* State Berkas Terunggah */
          <div className="border-2 border-dashed border-emerald-500/60 bg-emerald-500/20 backdrop-blur-md rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/30 text-emerald-800 dark:text-emerald-300 rounded-xl border border-emerald-500/50">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-xs md:text-sm font-black text-slate-950 dark:text-white font-mono">{fileNameDisplay}</h4>
                  <p className="text-xs text-slate-950 dark:text-slate-200 font-extrabold mt-0.5">
                    Ukuran Terkompresi: {(fileSizeDisplay / (1024 * 1024)).toFixed(2)} MB • Status: <strong className="text-emerald-800 dark:text-emerald-300">QUEUED</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleResetFile}
                className="p-2 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20 rounded-lg transition-colors"
                title="Hapus Berkas"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Pesan Error Upload / Validasi */}
        {errorMessage && (
          <div className="p-3.5 bg-rose-500/20 border border-rose-500/40 backdrop-blur-md rounded-2xl text-rose-950 dark:text-rose-200 text-xs md:text-sm font-black flex items-center gap-2 shadow-sm">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* --- PANEL SAKLAR MODE ADVANCE --- */}
        <div className="pt-2 border-t border-white/40 dark:border-slate-800">
          <div className="p-4 rounded-2xl bg-white/20 dark:bg-slate-800/40 border border-white/40 dark:border-slate-700/50 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl border backdrop-blur-md transition-colors ${
                isAdvancedMode 
                  ? 'bg-amber-500/20 text-amber-900 dark:text-amber-300 border-amber-500/40' 
                  : 'bg-blue-600/20 text-blue-900 dark:text-blue-300 border-blue-400/40'
              }`}>
                {isAdvancedMode ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
              </div>
              <h3 className="text-xs md:text-sm font-mono font-black text-slate-950 dark:text-white uppercase tracking-wider">
                MODE ADVANCE (KUSTOMISASI PARAMETER)
              </h3>
            </div>

            {/* Toggle Switch Default / Advance */}
            <div className="flex items-center gap-3 shrink-0">
              <span className={`text-xs md:text-sm font-mono font-black ${!isAdvancedMode ? 'text-blue-700 dark:text-blue-400' : 'text-slate-500'}`}>
                Default
              </span>
              <button
                type="button"
                onClick={() => {
                  const nextMode = !isAdvancedMode;
                  setIsAdvancedMode(nextMode);
                  if (!nextMode) handleResetParameters();
                }}
                className={`w-14 h-7 rounded-full p-1 transition-colors backdrop-blur-md border border-white/50 dark:border-slate-700/60 relative cursor-pointer ${
                  isAdvancedMode ? 'bg-amber-500' : 'bg-slate-400 dark:bg-slate-700'
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                  isAdvancedMode ? 'translate-x-7' : 'translate-x-0'
                }`} />
              </button>
              <span className={`text-xs md:text-sm font-mono font-black ${isAdvancedMode ? 'text-amber-700 dark:text-amber-400' : 'text-slate-500'}`}>
                Advance
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* --- SEKSI 02: VARIANT CALLING & QUALITY THRESHOLDS --- */}
      {isAdvancedMode && (
        <div className="bg-white/35 dark:bg-slate-900/50 backdrop-blur-2xl rounded-3xl p-6 md:p-8 border border-white/60 dark:border-slate-700/60 shadow-xl space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center border-b border-white/40 dark:border-slate-800 pb-3">
            <span className="text-xs md:text-sm font-mono font-black text-blue-700 dark:text-blue-400 flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-blue-600/20 text-blue-800 dark:text-blue-300 flex items-center justify-center font-bold">02</span>
              VARIANT CALLING & QUALITY THRESHOLDS
            </span>
          </div>

          {/* Grid Input Parameter */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            
            {/* Minimum Quality Score (QUAL) */}
            <div className="space-y-2 bg-white/40 dark:bg-slate-800/40 p-5 rounded-2xl border border-white/50 dark:border-slate-700/50">
              <div className="flex justify-between items-center">
                <label className="text-xs md:text-sm font-mono font-black text-slate-950 dark:text-slate-100 uppercase">
                  Minimum Quality Score (QUAL):
                </label>
                <span className="text-xs font-mono text-slate-700 dark:text-slate-400 font-extrabold">Range: ≥ 0.0</span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={minQual}
                  onWheel={handleWheelQual}
                  onChange={(e) => setMinQual(e.target.value)}
                  placeholder="30.0"
                  className="w-full bg-white/60 dark:bg-slate-800/80 border-2 border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 pr-32 text-sm md:text-base font-black text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 backdrop-blur-md shadow-inner font-mono"
                />
                <button
                  type="button"
                  onClick={() => setMinQual(30.0)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-mono font-black px-3 py-1.5 rounded-lg bg-amber-500/25 hover:bg-amber-500/40 text-amber-950 dark:text-amber-200 border border-amber-500/40 transition-colors cursor-pointer flex items-center gap-1"
                  title="Klik untuk mereset ke QUAL 30.0"
                >
                  {Number(minQual) === 30 ? (
                    'Preset (30.0)'
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> Reset (30.0)
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Minimum Read Depth (DP) */}
            <div className="space-y-2 bg-white/40 dark:bg-slate-800/40 p-5 rounded-2xl border border-white/50 dark:border-slate-700/50">
              <div className="flex justify-between items-center">
                <label className="text-xs md:text-sm font-mono font-black text-slate-950 dark:text-slate-100 uppercase">
                  Minimum Read Depth (DP):
                </label>
                <span className="text-xs font-mono text-slate-700 dark:text-slate-400 font-extrabold">Range: ≥ 1</span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  value={minDp}
                  onWheel={handleWheelDp}
                  onChange={(e) => setMinDp(e.target.value)}
                  placeholder="10"
                  className="w-full bg-white/60 dark:bg-slate-800/80 border-2 border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 pr-28 text-sm md:text-base font-black text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 backdrop-blur-md shadow-inner font-mono"
                />
                <button
                  type="button"
                  onClick={() => setMinDp(10)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-mono font-black px-3 py-1.5 rounded-lg bg-slate-300/70 hover:bg-slate-400/70 dark:bg-slate-700/70 dark:hover:bg-slate-600/70 text-slate-950 dark:text-slate-100 border border-slate-400/40 transition-colors cursor-pointer flex items-center gap-1"
                  title="Klik untuk mereset ke DP 10"
                >
                  {Number(minDp) === 10 ? (
                    'Preset (10)'
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" /> Reset (10)
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* --- TOMBOL AKSI UTAMA --- */}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={handleSubmitAnalysis}
          disabled={!uploadResult}
          className="flex items-center justify-center gap-2.5 bg-blue-600/90 hover:bg-blue-600 disabled:bg-slate-400/60 dark:disabled:bg-slate-700/60 text-white font-black px-8 py-4 rounded-2xl text-sm md:text-base shadow-xl shadow-blue-600/30 backdrop-blur-md transition-all cursor-pointer disabled:cursor-not-allowed hover:scale-[1.02]"
        >
          <PlayCircle className="w-5 h-5" />
          <span>Jalankan Pipeline Analisis</span>
        </button>
      </div>

    </div>
  );
};

export default NewAnalysisPage;