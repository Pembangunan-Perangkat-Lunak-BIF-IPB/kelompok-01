import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, FileSpreadsheet, Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/auth';
import { getJobResult, getJobVariants, type JobResultSummary, type JobVariantsResponse, type VariantQueryParams, type VariantType } from '../services/api';
import { pageCsv } from '../services/resultExport';

export function JobResultPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const { token } = useAuth();
  const [reload, setReload] = useState(0);
  const [type, setType] = useState('');
  const [minQual, setMinQual] = useState('');
  const [maxQual, setMaxQual] = useState('');
  const [filters, setFilters] = useState<VariantQueryParams>({});
  const [offset, setOffset] = useState(0);
  const [filterError, setFilterError] = useState('');
  const [summaryState, setSummary] = useState<{ key: string; data: JobResultSummary | null; error: string }>({ key: '', data: null, error: '' });
  const [tableState, setTable] = useState<{ key: string; data: JobVariantsResponse | null; error: string }>({ key: '', data: null, error: '' });
  const limit = 10;
  const summaryKey = jobId + ':' + reload;
  const tableKey = summaryKey + ':' + offset + ':' + JSON.stringify(filters);
  const valid = Boolean(jobId && /^[1-9]\d*$/.test(jobId) && Number(jobId) <= 2 ** 31 - 1);
  useEffect(() => {
    if (!valid || !jobId || !token) return;
    const controller = new AbortController();
    getJobResult(jobId, token, controller.signal).then(data => {
      if (!controller.signal.aborted) setSummary({ key: summaryKey, data, error: '' });
    }).catch(error => {
      if (!controller.signal.aborted) setSummary({ key: summaryKey, data: null, error: error instanceof Error ? error.message : 'Ringkasan tidak dapat dimuat.' });
    });
    return () => controller.abort();
  }, [jobId, token, valid, summaryKey]);
  useEffect(() => {
    if (!valid || !jobId || !token) return;
    const controller = new AbortController();
    getJobVariants(jobId, { ...filters, limit, offset }, token, controller.signal).then(data => {
      if (!controller.signal.aborted) setTable({ key: tableKey, data, error: '' });
    }).catch(error => {
      if (!controller.signal.aborted) setTable({ key: tableKey, data: null, error: error instanceof Error ? error.message : 'Tabel varian tidak dapat dimuat.' });
    });
    return () => controller.abort();
  }, [jobId, token, valid, filters, offset, tableKey]);
  const loadingSummary = summaryState.key !== summaryKey;
  const loadingTable = tableState.key !== tableKey;
  const summary = loadingSummary ? null : summaryState.data;
  const table = loadingTable ? null : tableState.data;
  const applyFilters = (event: FormEvent) => {
    event.preventDefault();
    const min = minQual.trim() ? Number(minQual) : undefined;
    const max = maxQual.trim() ? Number(maxQual) : undefined;
    if ([min, max].some(value => value !== undefined && (!Number.isFinite(value) || value < 0)) ||
      (min !== undefined && max !== undefined && min > max)) {
      setFilterError('Batas QUAL harus finite ≥ 0 dan minimum tidak melebihi maksimum.'); return;
    }
    setFilterError(''); setOffset(0);
    setFilters({ variant_type: type ? type as VariantType : undefined, min_qual: min, max_qual: max });
  };
  const exportPage = () => {
    if (!table?.items.length) return;
    const url = URL.createObjectURL(new Blob([pageCsv(table.items)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url;
    link.download = 'GenoPath_Job_' + jobId + '_halaman_' + (Math.floor(offset / limit) + 1) + '.csv';
    link.click(); URL.revokeObjectURL(url);
  };
  if (!valid) return <p role="alert">ID Job tidak valid.</p>;
  const date = (value: string | null) => value ? new Date(value).toLocaleString('id-ID') : 'Belum tersedia';
  const inputClass = 'glass-card px-3 py-2 rounded-xl text-sm w-full';
  return <div className="max-w-7xl mx-auto space-y-6 px-4 py-6">
    <Link to={'/jobs/' + jobId} className="text-blue-700 dark:text-blue-300 underline text-sm"><ArrowLeft className="inline w-4 h-4 mr-1" />Pemantauan Job #{jobId}</Link>
    <header className="glass-card rounded-2xl p-6 space-y-4">
      <div className="flex justify-between items-start gap-4">
        <div><h1 className="text-2xl font-black">Hasil Analisis Job #{jobId}</h1>
          {summary && <p className="text-sm mt-2">Sample #{summary.id_sample} · {summary.status} · Mode: {summary.execution_mode ?? 'Tidak diketahui'}</p>}</div>
        <button type="button" aria-label="Muat ulang hasil" onClick={() => setReload(value => value + 1)} className="glass-card rounded-xl p-3"><RefreshCw className="w-4 h-4" /></button>
      </div>
      {loadingSummary && <p role="status">Memuat ringkasan…</p>}
      {!loadingSummary && summaryState.error && <p role="alert" className="text-rose-800 dark:text-rose-300">{summaryState.error}</p>}
      {summary && <div className="text-sm space-y-2">
        {summary.execution_mode === 'synthetic' && <p role="status" className="font-bold text-amber-800 dark:text-amber-300">DATA SINTETIS — untuk pengujian teknis, bukan hasil biologis nyata.</p>}
        <p>Reference ID: #{summary.id_reference_genome} · Mulai: {date(summary.waktu_mulai)} · Selesai: {date(summary.waktu_selesai)}</p>
        <p>Seleksi analisis: QUAL ≥ {summary.parameters.parameter_qual}; FORMAT/DP ≥ {summary.parameters.parameter_dp};
          FILTER=PASS: {summary.parameters.require_pass == null ? 'Tidak diketahui' : summary.parameters.require_pass ? 'Ya' : 'Tidak'};
          Ploidi: {summary.parameters.variant_ploidy ?? 'Tidak diketahui'}.</p>
        <p className="text-xs">Nama/assembly reference, checksum, dan metrik alignment tidak disediakan API ini.</p>
      </div>}
    </header>
    {summary && <section className="space-y-2"><div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      {[['Total record varian', summary.counts.total_variants], ['SNP', summary.counts.snps], ['InDel', summary.counts.indels],
        ['Other', summary.counts.other], ['Tidak terklasifikasi', summary.counts.unclassified]].map(([label, value]) =>
        <div key={label} className="glass-card rounded-2xl p-5"><h2 className="text-sm">{label}</h2><p className="text-3xl font-black mt-2">{Number(value).toLocaleString('id-ID')}</p></div>)}
    </div><p className="text-xs">Ringkasan seluruh record tersimpan pada Job; tidak berubah oleh filter tabel. Record multiallelic tetap dihitung satu record.</p></section>}
    <section className="glass-card rounded-2xl p-5 space-y-3">
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled title="Endpoint download VCF belum tersedia" className="bg-slate-500 text-white px-4 py-2 rounded-xl text-sm disabled:opacity-60">Unduh VCF — belum tersedia</button>
        <button type="button" disabled={!table?.items.length} onClick={exportPage} className="bg-blue-600 disabled:bg-slate-500 text-white px-4 py-2 rounded-xl text-sm"><FileSpreadsheet className="inline w-4 h-4 mr-1" />Ekspor halaman ini (CSV)</button>
      </div><p className="text-xs">CSV hanya memuat halaman tabel yang sedang ditampilkan, maksimal 10 record. Ekspor seluruh hasil dan download VCF belum diimplementasikan.</p>
    </section>
    <section className="glass-card rounded-2xl overflow-hidden">
      <div className="p-5 space-y-4">
        <h2 className="font-bold">Tabel Varian</h2>
        <form onSubmit={applyFilters} className="grid grid-cols-1 sm:grid-cols-4 items-end gap-3">
          <div><label htmlFor="variant-type" className="block text-sm mb-1">Tipe varian</label>
            <select id="variant-type" value={type} onChange={event => setType(event.target.value)} className={inputClass}>
              <option value="">Semua tipe</option><option value="snp">SNP</option><option value="indel">InDel</option><option value="other">Other</option><option value="unclassified">Tidak terklasifikasi</option>
            </select></div>
          <div><label htmlFor="min-qual" className="block text-sm mb-1">QUAL minimum</label><input id="min-qual" type="number" min="0" step="any" value={minQual} onChange={event => setMinQual(event.target.value)} className={inputClass} /></div>
          <div><label htmlFor="max-qual" className="block text-sm mb-1">QUAL maksimum</label><input id="max-qual" type="number" min="0" step="any" value={maxQual} onChange={event => setMaxQual(event.target.value)} className={inputClass} /></div>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm" type="submit">Terapkan filter</button>
        </form>
        <p className="text-xs">Filter diterapkan server sebelum pagination, hanya pada varian yang sudah disimpan; tidak menjalankan ulang analisis.</p>
        {filterError && <p role="alert" className="text-rose-800 dark:text-rose-300">{filterError}</p>}
      </div>
      {loadingTable ? <p role="status" className="p-8"><Loader2 className="inline w-5 h-5 animate-spin mr-2" />Memuat varian…</p> :
        tableState.error ? <p role="alert" className="p-6 text-rose-800 dark:text-rose-300">{tableState.error}</p> :
          table && <><p className="px-5 pb-4 text-xs">Filter aktif: {table.filters.variant_type ?? 'semua tipe'}; QUAL minimum {table.filters.min_qual ?? 'tanpa batas'}, maksimum {table.filters.max_qual ?? 'tanpa batas'}.</p>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm">
            <thead><tr className="border-y border-slate-300 dark:border-slate-700">{['Kromosom', 'Posisi (bp)', 'REF', 'ALT', 'QUAL', 'FORMAT/DP', 'GT asli', 'FILTER', 'Tipe'].map(label => <th scope="col" key={label} className="p-3">{label}</th>)}</tr></thead>
            <tbody>{table.items.map(variant => <tr key={variant.id_variant} className="border-b border-slate-200 dark:border-slate-800 font-mono">
              <td className="p-3">{variant.chromosome}</td><td className="p-3">{variant.position.toLocaleString('id-ID')}</td>
              <td className="p-3 break-all">{variant.ref_allele}</td><td className="p-3 break-all">{variant.alt_allele}</td><td className="p-3">{variant.qual ?? '—'}</td>
              <td className="p-3">{variant.genotypes.length ? variant.genotypes.map(call => call.dp ?? '—').join('; ') : '—'}</td>
              <td className="p-3">{variant.genotypes.length ? variant.genotypes.map(call => call.genotype_call || '—').join('; ') : '—'}</td>
              <td className="p-3">{variant.filter_status ?? '—'}</td><td className="p-3">{variant.variant_type ?? 'Tidak terklasifikasi'}</td>
            </tr>)}</tbody>
          </table></div>
          {table.items.length === 0 && <p className="p-6">{table.total === 0 ? 'Tidak ada record yang cocok dengan filter ini.' : 'Halaman ini kosong; kembali ke halaman sebelumnya.'}</p>}
          <div className="p-4 flex flex-wrap gap-3 justify-between items-center text-sm">
            <p>Menampilkan {table.items.length ? offset + 1 : 0}–{table.items.length ? offset + table.returned : 0} dari {table.total} record setelah filter.</p>
            <div className="flex gap-3">
              <button type="button" disabled={offset === 0} onClick={() => setOffset(value => Math.max(0, value - limit))} className="glass-card rounded-xl px-3 py-2 disabled:opacity-40">Sebelumnya</button>
              <button type="button" disabled={!table.has_more || table.next_offset == null} onClick={() => { if (table.next_offset != null) setOffset(table.next_offset); }} className="glass-card rounded-xl px-3 py-2 disabled:opacity-40">Selanjutnya</button>
            </div>
          </div></>}
    </section>
  </div>;
}
export default JobResultPage;
