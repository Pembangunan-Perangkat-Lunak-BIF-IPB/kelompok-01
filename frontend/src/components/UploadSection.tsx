import React, { useState } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { uploadSample, ApiError, type SampleUploadResponse } from '../services/api';

export const UploadSection: React.FC = () => {
  const { token, isAuthenticated } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<SampleUploadResponse | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setErrorMessage(null);
      setUploadResult(null);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !token) return;

    setUploading(true);
    setErrorMessage(null);
    setUploadResult(null);

    try {
      const result = await uploadSample(selectedFile, token);
      setUploadResult(result);
      setSelectedFile(null);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Terjadi kesalahan jaringan saat mengunggah berkas.');
      }
    } finally {
      setUploading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="p-6 bg-slate-100 rounded-2xl text-center border border-slate-200">
        <p className="text-sm font-semibold text-slate-700">
          Silakan masuk/login terlebih dahulu untuk melakukan pengunggahan sampel FASTQ.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-1 flex items-center gap-2">
        <Upload className="w-4 h-4 text-blue-600" /> Unggah Sampel FASTQ
      </h3>
      <p className="text-xs text-slate-500 mb-4">
        Dukungan berkas Single-End (.fastq, .fastq.gz) hingga 1 GB.
      </p>

      <form onSubmit={handleUploadSubmit} className="space-y-4">
        <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-blue-500 transition-colors bg-slate-50/50">
          <input
            type="file"
            id="fastq-file-input"
            accept=".fastq,.gz"
            onChange={handleFileChange}
            className="hidden"
            disabled={uploading}
          />
          <label htmlFor="fastq-file-input" className="cursor-pointer block">
            <FileText className="w-8 h-8 mx-auto text-slate-400 mb-2" />
            <span className="text-xs font-bold text-blue-600 hover:underline">
              Pilih Berkas FASTQ
            </span>
            <span className="text-xs text-slate-400 block mt-1">
              {selectedFile ? selectedFile.name : 'atau seret dan lepas berkas di sini'}
            </span>
          </label>
        </div>

        {selectedFile && (
          <div className="text-xs text-slate-600 flex justify-between bg-slate-100 p-2.5 rounded-lg font-mono">
            <span>Ukuran: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</span>
            <span className="text-emerald-600 font-bold">SIAP DIUNGGAH</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {uploadResult && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Berhasil Disimpan di Server!</span>
            </div>
            <p className="font-mono text-[11px] text-emerald-700">
              ID Sampel: #{uploadResult.id_sample} | File: {uploadResult.nama_berkas}
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={!selectedFile || uploading}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
        >
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Memvalidasi & Mengunggah Sampel...</span>
            </>
          ) : (
            <span>Mulai Unggah Sampel</span>
          )}
        </button>
      </form>
    </div>
  );
};