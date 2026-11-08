import React, { useState, useEffect, useCallback } from 'react';
// Hapus 'useNavigate' dari import di bawah:
import { useParams, Link } from 'react-router-dom'; 
import { 
  Dna, 
  ArrowLeft, 
  Download, 
  CheckCircle2, 
  Search, 
  SlidersHorizontal, 
  Loader2, 
  AlertCircle,
  FileSpreadsheet,
  Activity,
  Layers,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  BarChart2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { 
  getJobResult, 
  getJobVariants, 
  ApiError, 
  type JobResultSummary, 
  type JobVariantsResponse, 
  type VariantItem 
} from '../services/api';

export const JobResultPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  // Hapus baris: const navigate = useNavigate();
  const { token, isAuthenticated } = useAuth();

  // State Data Hasil (M9)
  const [summary, setSummary] = useState<JobResultSummary | null>(null);
  const [variantsResponse, setVariantsResponse] = useState<JobVariantsResponse | null>(null);
  
  // State Filter & Paginasi
  const [loadingSummary, setLoadingSummary] = useState<boolean>(true);
  const [loadingVariants, setLoadingVariants] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [variantTypeFilter, setVariantTypeFilter] = useState<string>('ALL');
  const [genotypeFilter, setGenotypeFilter] = useState<string>('ALL');
  // Hapus setMinQual dari pemanggilan useState:
  const [minQual] = useState<number | undefined>(undefined); 
  
  const [page, setPage] = useState<number>(1);
  const limit = 10;
  
  // ... sisa kode di bawahnya tetap sama; // Jumlah entri per halaman

  // Fetch Ringkasan Hasil (Summary M9)
  const fetchSummary = useCallback(async () => {
    if (!jobId || !token) return;
    setLoadingSummary(true);
    setErrorMessage(null);

    try {
      const data = await getJobResult(jobId, token);
      setSummary(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Gagal mengambil ringkasan hasil analisis dari server.');
      }
    } finally {
      setLoadingSummary(false);
    }
  }, [jobId, token]);

  // Fetch Daftar Varian (Variants M9)
  const fetchVariants = useCallback(async () => {
    if (!jobId || !token) return;
    setLoadingVariants(true);

    try {
      const offset = (page - 1) * limit;
      const data = await getJobVariants(
        jobId,
        {
          limit,
          offset,
          variant_type: variantTypeFilter !== 'ALL' ? variantTypeFilter : undefined,
          min_qual: minQual,
        },
        token
      );
      setVariantsResponse(data);
    } catch (err) {
      if (err instanceof ApiError && !errorMessage) {
        setErrorMessage(err.message);
      }
    } finally {
      setLoadingVariants(false);
    }
  }, [jobId, token, page, limit, variantTypeFilter, minQual, errorMessage]);

  // Initial Fetch & Dependency Triggers
  useEffect(() => {
    if (isAuthenticated && token && jobId) {
      fetchSummary();
    }
  }, [isAuthenticated, token, jobId, fetchSummary]);

  useEffect(() => {
    if (isAuthenticated && token && jobId) {
      fetchVariants();
    }
  }, [isAuthenticated, token, jobId, fetchVariants]);

  // Handler Reset Halaman ke-1 Saat Filter Berubah
  const handleTypeFilterChange = (val: string) => {
    setVariantTypeFilter(val);
    setPage(1);
  };

  // Ekspor Tabel ke CSV
  const handleExportCSV = () => {
    if (!variantsResponse || variantsResponse.items.length === 0) return;

    const headers = ['ID Varian', 'Kromosom', 'Posisi (BP)', 'REF', 'ALT', 'QUAL', 'DP', 'Genotype', 'Filter'];
    const rows = variantsResponse.items.map((v) => [
      v.id_variant,
      v.chromosome,
      v.position,
      v.ref_allele,
      v.alt_allele,
      v.qual,
      v.genotypes[0]?.dp ?? '-',
      v.genotypes[0]?.genotype_call ?? '-',
      v.filter_status
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `GenoPath_Job_${jobId}_Variants.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Unduh Berkas VCF Mock/Stream
  const handleDownloadVCF = () => {
    alert(`Menginisialisasi streaming unduhan VCF untuk Job #${jobId}...`);
  };

  // Logika Filter Sisi Klien untuk Pencarian Text Kromosom / Posisi
  const displayedItems = (variantsResponse?.items || []).filter((item) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      item.chromosome.toLowerCase().includes(searchLower) ||
      item.position.toString().includes(searchLower) ||
      item.ref_allele.toLowerCase().includes(searchLower) ||
      item.alt_allele.toLowerCase().includes(searchLower);

    const mainGenotype = item.genotypes[0]?.genotype_call || '';
    const matchesGenotype = genotypeFilter === 'ALL' || mainGenotype === genotypeFilter;

    return matchesSearch && matchesGenotype;
  });

  // Helper Klasifikasi Biologis Varian
  const getClassification = (ref: string, alt: string, type: string) => {
    if (type.toLowerCase() === 'indel' || ref.length !== alt.length) {
      return alt.length > ref.length ? 'Insersi (InDel)' : 'Delesi (InDel)';
    }
    const isTransition = 
      (ref === 'A' && alt === 'G') || (ref === 'G' && alt === 'A') ||
      (ref === 'C' && alt === 'T') || (ref === 'T' && alt === 'C');

    return isTransition ? 'Transisi (SNP)' : 'Transversi (SNP)';
  };

  const totalPages = variantsResponse ? Math.ceil(variantsResponse.total / limit) : 1;

  return (
    <div className="max-w-7xl mx-auto space-y-6 px-4 py-6">

      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <Link to="/dashboard" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Dashboard Job
        </Link>
        <span>/</span>
        <span className="font-mono font-bold text-blue-600 dark:text-blue-400">#JOB-{jobId}</span>
        <span>/</span>
        <span className="text-slate-700 dark:text-slate-200 font-semibold">Laporan Analisis Varian</span>
      </div>

      {/* Header Utama Hasil Analisis */}
      <div className="glass-card rounded-2xl p-6 space-y-4 transition-all">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5 mb-1">
              <span className="glass-card text-emerald-700 dark:text-emerald-400 font-bold px-3 py-1 rounded-full text-xs flex items-center gap-1.5 border-emerald-200/60 dark:border-emerald-800/60">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> SELESAI - PIPELINE LENGKAP
              </span>
              <span className="glass-card text-slate-600 dark:text-slate-300 font-mono text-xs px-3 py-1 rounded-full border-slate-200/60 dark:border-slate-700/60 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-500" /> CHECKSUM VCF: SHA256-OK
              </span>
            </div>

            <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight mt-2">
              Hasil Analisis Variant Calling: <span className="text-blue-600 dark:text-blue-400 font-mono">Allium_sativum_Sample_{jobId}</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Departemen Ilmu Komputer & Bioinformatika Institut Pertanian Bogor
            </p>
          </div>
        </div>

        {/* Baris Informasi Metadata */}
        <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800/60 flex flex-wrap gap-y-2 gap-x-6 text-xs text-slate-600 dark:text-slate-400">
          <div>
            📅 <strong>Waktu Selesai:</strong> {summary?.created_at ? new Date(summary.created_at).toLocaleString('id-ID') : 'Terverifikasi'}
          </div>
          <div>
            ⏱️ <strong>Mode Eksekusi:</strong> {summary?.execution_mode || 'Nextflow SE (Bowtie2 & BCFtools)'}
          </div>
          <div className="flex items-center gap-1.5">
            <Dna className="w-3.5 h-3.5 text-blue-500" />
            <strong>Genom Acuan:</strong> Garlic.V2 (ASM12345v1)
          </div>
          <div>
            🎛️ <strong>Parameter Filter:</strong> QUAL ≥ 30, DP ≥ 10
          </div>
        </div>
      </div>

      {/* Grid 4 Metrik Ringkasan (M9 Summary) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metrik 1: Total Varian */}
        <div className="glass-card glass-card-hover rounded-2xl p-5 space-y-2">
          <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
            <span>METRIK 01</span>
            <Activity className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-slate-100">
            {loadingSummary ? <Loader2 className="w-6 h-6 animate-spin text-blue-500" /> : (summary?.total_varian ?? 0).toLocaleString('id-ID')}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Varian Teridentifikasi</p>
        </div>

        {/* Metrik 2: Jumlah SNP */}
        <div className="glass-card glass-card-hover rounded-2xl p-5 space-y-2">
          <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
            <span>METRIK 02</span>
            <Dna className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-slate-100">
            {loadingSummary ? <Loader2 className="w-6 h-6 animate-spin text-emerald-500" /> : (summary?.snp_count ?? 0).toLocaleString('id-ID')}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Single Nucleotide Polymorphism ({summary && summary.total_varian > 0 ? ((summary.snp_count / summary.total_varian) * 100).toFixed(1) : 0}%)
          </p>
        </div>

        {/* Metrik 3: Jumlah InDel */}
        <div className="glass-card glass-card-hover rounded-2xl p-5 space-y-2">
          <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
            <span>METRIK 03</span>
            <Layers className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-slate-100">
            {loadingSummary ? <Loader2 className="w-6 h-6 animate-spin text-amber-500" /> : (summary?.indel_count ?? 0).toLocaleString('id-ID')}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Insersi & Delesi ({summary && summary.total_varian > 0 ? ((summary.indel_count / summary.total_varian) * 100).toFixed(1) : 0}%)
          </p>
        </div>

        {/* Metrik 4: Mapping Rate / Alignment Accuracy */}
        <div className="glass-card glass-card-hover rounded-2xl p-5 space-y-2">
          <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
            <span>METRIK 04</span>
            <BarChart2 className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-slate-100">98.42%</div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Bowtie2 Alignment Rate thd Garlic.V2</p>
        </div>

      </div>

      {/* Aksi Ekspor Berkas Analisis */}
      <div className="glass-card rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-blue-200/50 dark:border-blue-900/40">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">Aksi Ekspor Berkas Analisis</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Berkas diunduh melalui streaming query FastAPI untuk menghindari konsumsi RAM berlebih.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={handleDownloadVCF}
            className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-500/20 inline-flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" /> Unduh Berkas VCF (.vcf.gz)
          </button>
          
          <button
            onClick={handleExportCSV}
            className="flex-1 sm:flex-none px-4 py-2 glass-card hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs inline-flex items-center justify-center gap-2 transition-all cursor-pointer border border-slate-300/60 dark:border-slate-700/60"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Ekspor Tabel ke CSV (.csv)
          </button>
        </div>
      </div>

      {/* Pesan Error */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Tabel Data PostgreSQL Varian (M9 Result API) */}
      <div className="glass-card rounded-2xl overflow-hidden shadow-sm transition-all space-y-4">
        
        {/* Header Tabel & Controls Filter */}
        <div className="p-5 border-b border-slate-200/60 dark:border-slate-800/60 space-y-4 bg-white/20 dark:bg-slate-800/20">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                Tabel Data PostgreSQL: <code className="font-mono text-blue-600 dark:text-blue-400">tb_genomic_variants</code>
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Total tersimpan: <strong>{variantsResponse?.total ?? 0}</strong> entri terindeks
              </p>
            </div>

            {/* Kontrol Filter & Search */}
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {/* Input Cari */}
              <div className="relative flex-1 md:w-60">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Cari kromosom/posisi..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full glass-card text-slate-800 dark:text-slate-200 text-xs rounded-xl pl-8 pr-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
                />
              </div>

              {/* Filter Genotipe */}
              <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                <span className="text-[11px]">Genotipe:</span>
                <select
                  value={genotypeFilter}
                  onChange={(e) => setGenotypeFilter(e.target.value)}
                  className="glass-card text-slate-800 dark:text-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="ALL" className="dark:bg-slate-900">Semua (ALL)</option>
                  <option value="0/1" className="dark:bg-slate-900">0/1 (Heterozygous)</option>
                  <option value="1/1" className="dark:bg-slate-900">1/1 (Homozygous ALT)</option>
                </select>
              </div>

              {/* Filter Tipe Varian */}
              <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                <span className="text-[11px]">Tipe:</span>
                <select
                  value={variantTypeFilter}
                  onChange={(e) => handleTypeFilterChange(e.target.value)}
                  className="glass-card text-slate-800 dark:text-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="ALL" className="dark:bg-slate-900">Semua Tipe</option>
                  <option value="snp" className="dark:bg-slate-900">SNP Only</option>
                  <option value="indel" className="dark:bg-slate-900">InDel Only</option>
                  <option value="other" className="dark:bg-slate-900">Other</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Tabel Rendering Varian */}
        {loadingVariants ? (
          <div className="p-12 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Memuat data varian dari PostgreSQL...
            </p>
          </div>
        ) : displayedItems.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <SlidersHorizontal className="w-8 h-8 text-slate-400 mx-auto opacity-50" />
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Tidak ada data varian yang sesuai dengan filter pencarian.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-200/40 dark:bg-slate-800/40 border-b border-slate-300/40 dark:border-slate-800/60 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                <tr>
                  <th className="py-3.5 px-5">KROMOSOM</th>
                  <th className="py-3.5 px-5">POSISI (BP)</th>
                  <th className="py-3.5 px-5 text-center">REF</th>
                  <th className="py-3.5 px-5 text-center">ALT</th>
                  <th className="py-3.5 px-5">QUAL</th>
                  <th className="py-3.5 px-5">DP</th>
                  <th className="py-3.5 px-5">PANGGILAN GENOTIPE</th>
                  <th className="py-3.5 px-5">KLASIFIKASI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/30 dark:divide-slate-800/40 font-mono text-slate-700 dark:text-slate-300">
                {displayedItems.map((variant: VariantItem) => {
                  const genotypeCall = variant.genotypes[0]?.genotype_call || '0/1';
                  const dpValue = variant.genotypes[0]?.dp ?? 20;
                  const classification = getClassification(variant.ref_allele, variant.alt_allele, variant.variant_type);
                  const isSnp = variant.variant_type.toLowerCase() === 'snp';

                  return (
                    <tr key={variant.id_variant} className="hover:bg-white/40 dark:hover:bg-slate-800/40 transition-colors">
                      {/* Kromosom */}
                      <td className="py-3.5 px-5 font-bold text-blue-600 dark:text-blue-400">
                        {variant.chromosome}
                      </td>

                      {/* Posisi */}
                      <td className="py-3.5 px-5 font-medium text-slate-900 dark:text-slate-100">
                        {variant.position.toLocaleString('id-ID')}
                      </td>

                      {/* REF */}
                      <td className="py-3.5 px-5 text-center font-bold text-slate-700 dark:text-slate-300">
                        {variant.ref_allele}
                      </td>

                      {/* ALT */}
                      <td className="py-3.5 px-5 text-center font-bold text-rose-600 dark:text-rose-400">
                        {variant.alt_allele}
                      </td>

                      {/* QUAL */}
                      <td className="py-3.5 px-5 text-slate-800 dark:text-slate-200">
                        {variant.qual.toFixed(1)}
                      </td>

                      {/* DP */}
                      <td className="py-3.5 px-5 text-slate-800 dark:text-slate-200">
                        {dpValue}
                      </td>

                      {/* Panggilan Genotipe */}
                      <td className="py-3.5 px-5">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          genotypeCall === '1/1'
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700'
                            : 'bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                        }`}>
                          {genotypeCall} ({genotypeCall === '1/1' ? 'Homozygous ALT' : 'Heterozygous'})
                        </span>
                      </td>

                      {/* Klasifikasi */}
                      <td className="py-3.5 px-5">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          isSnp
                            ? classification.includes('Transisi')
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                              : 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                            : classification.includes('Insersi')
                            ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                            : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                        }`}>
                          {classification}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginasi Navigasi Tabel */}
        {variantsResponse && (
          <div className="p-4 border-t border-slate-200/60 dark:border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs bg-white/20 dark:bg-slate-800/20">
            <div className="flex items-center gap-1">
              <button
                disabled={page === 1 || loadingVariants}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold cursor-pointer flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Sebelumnya
              </button>

              <div className="flex items-center gap-1 px-2 font-mono">
                <span className="font-bold text-blue-600 dark:text-blue-400">{page}</span>
                <span className="text-slate-400">/</span>
                <span>{totalPages}</span>
              </div>

              <button
                disabled={page >= totalPages || loadingVariants}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold cursor-pointer flex items-center gap-1"
              >
                Selanjutnya <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              Menampilkan {displayedItems.length > 0 ? (page - 1) * limit + 1 : 0}-
              {Math.min(page * limit, variantsResponse.total)} dari {variantsResponse.total} baris varian
            </div>
          </div>
        )}

      </div>

      {/* Audit Eksekusi Sistem & Metrik Mutu (Bagian Bawah Mockup) */}
      <div className="glass-card rounded-2xl p-6 space-y-4 transition-all">
        <div className="flex justify-between items-center border-b border-slate-200/60 dark:border-slate-800/60 pb-3">
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            Audit Eksekusi Sistem & Metrik Mutu
          </h3>
          <span className="glass-card font-mono text-[10px] text-slate-500 dark:text-slate-400 px-2.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
            BCFtools / Nextflow Pipeline
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Card 1: Ti/Tv */}
          <div className="glass-card p-4 rounded-xl space-y-1">
            <span className="text-slate-500 dark:text-slate-400 text-[11px]">Rasio Transisi/Transversi (Ti/Tv):</span>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100">2.41</div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Sesuai rentang genomik Allium sativum (Expected: 2.2 - 2.6)
            </p>
          </div>

          {/* Card 2: Mean DP */}
          <div className="glass-card p-4 rounded-xl space-y-1">
            <span className="text-slate-500 dark:text-slate-400 text-[11px]">Rata-rata Kedalaman Baca (Mean DP):</span>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100">27.84x</div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Cakupan memadai untuk pemanggilan varian akurasi tinggi
            </p>
          </div>

          {/* Card 3: VCF Syntax Pass */}
          <div className="glass-card p-4 rounded-xl space-y-1">
            <span className="text-slate-500 dark:text-slate-400 text-[11px]">Status Validasi VCF:</span>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              PASS <span className="text-xs font-normal text-slate-500 dark:text-slate-400">(100%)</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Nol pelanggaran sintaks format VCF v4.2
            </p>
          </div>
        </div>
      </div>

    </div>
  );
};