import { ContextHelp } from '../components/ContextHelp';
import { Pagination, StatusBadge, TableFrame } from '../components/ui/Foundation';
import { displayReferenceName } from '../services/displayText';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, FileSpreadsheet, Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/auth';
import { downloadJobResult, getJobResult, getJobVariants, getJobVariantsForPlot, type JobResultSummary, type JobVariantsResponse, type VariantItem, type VariantQueryParams, type VariantType } from '../services/api';

const variantTypes = [
  { key: 'snps', label: 'SNP', color: 'bg-blue-600' },
  { key: 'indels', label: 'InDel', color: 'bg-emerald-600' },
  { key: 'other', label: 'Other', color: 'bg-amber-500' },
  { key: 'unclassified', label: 'Tidak terklasifikasi', color: 'bg-violet-600' },
] as const;

function variantCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function hasVariantCounts(value: unknown): value is JobResultSummary['counts'] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const counts = value as Record<string, unknown>;
  return ['total_variants', 'snps', 'indels', 'other', 'unclassified'].every(key =>
    Object.prototype.hasOwnProperty.call(counts, key) &&
    (counts[key] === null || (typeof counts[key] === 'number' && Number.isFinite(counts[key]))));
}

function VariantDistribution({ counts }: { counts: JobResultSummary['counts'] }) {
  const values = variantTypes.map(type => ({ ...type, count: variantCount(counts[type.key]) }));
  const classifiedTotal = values.reduce((sum, item) => sum + item.count, 0);
  const description = values.map(item => `${item.label} ${item.count.toLocaleString('id-ID')}`).join(', ');

  return <figure className="gp-section space-y-3" aria-labelledby="variant-distribution-title">
    <figcaption id="variant-distribution-title" className="font-semibold">Distribusi tipe varian</figcaption>
    {classifiedTotal > 0 ? <>
      <div role="img" aria-label={`Distribusi tipe varian: ${description}`} className="flex h-5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        {values.map(item => item.count > 0 && <span key={item.key} className={item.color}
          style={{ width: `${(item.count / classifiedTotal) * 100}%` }} />)}
      </div>
      <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        {values.map(item => <li key={item.key} className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2"><span aria-hidden="true" className={`h-3 w-3 rounded-sm ${item.color}`} />{item.label}</span>
          <span className="tabular-nums">{item.count.toLocaleString('id-ID')} <span className="text-xs text-slate-600 dark:text-slate-300">
            {((item.count / classifiedTotal) * 100).toFixed(1)}%
          </span></span>
        </li>)}
      </ul>
    </> : <p role="status" className="text-sm text-slate-600 dark:text-slate-300">Belum ada varian untuk ditampilkan.</p>}
  </figure>;
}

type PlotPoint = { position: number; qual: number };
type VariantPlotData = { items: VariantItem[]; total: number; truncated: boolean };

function GenomeQualScatter({ loading, error, data }: {
  loading: boolean; error: string; data: VariantPlotData | null;
}) {
  if (loading) return <section className="gp-section" aria-labelledby="genome-qual-title">
    <h2 id="genome-qual-title" className="font-semibold">Posisi genom vs QUAL</h2>
    <p role="status" className="mt-3 text-sm text-slate-600 dark:text-slate-300">Memuat seluruh varian untuk grafik…</p>
  </section>;
  if (error) return <section className="gp-section" aria-labelledby="genome-qual-title">
    <h2 id="genome-qual-title" className="font-semibold">Posisi genom vs QUAL</h2>
    <p role="alert" className="mt-3 text-sm text-rose-800 dark:text-rose-300">Grafik tidak dapat dimuat: {error}</p>
  </section>;
  if (!data) return null;

  const points: PlotPoint[] = [];
  for (const rawItem of data.items as unknown[]) {
    if (typeof rawItem !== 'object' || rawItem === null || Array.isArray(rawItem)) continue;
    const item = rawItem as Record<string, unknown>;
    const position: unknown = item.position;
    const qual: unknown = item.qual;
    if (Number.isSafeInteger(position) && Number(position) > 0 &&
        typeof qual === 'number' && Number.isFinite(qual) && qual >= 0) {
      points.push({ position: Number(position), qual });
    }
  }
  const excluded = data.items.length - points.length;
  return <section className="gp-section min-w-0 space-y-3" aria-labelledby="genome-qual-title">
    <div>
      <h2 id="genome-qual-title" className="font-semibold">Posisi genom vs QUAL</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        {points.length.toLocaleString('id-ID')} titik valid dari {data.total.toLocaleString('id-ID')} varian yang mengikuti filter tabel aktif.
      </p>
    </div>
    {data.truncated && <p role="status" className="text-sm text-amber-800 dark:text-amber-300">
      Grafik dibatasi pada {data.items.length.toLocaleString('id-ID')} dari {data.total.toLocaleString('id-ID')} varian agar tetap responsif.
    </p>}
    {excluded > 0 && <p role="status" className="text-sm text-amber-800 dark:text-amber-300">
      {excluded.toLocaleString('id-ID')} record dilewati karena posisi atau QUAL tidak valid.
    </p>}
    {points.length === 0 ? <p role="status" className="text-sm text-slate-600 dark:text-slate-300">
      {data.total === 0 ? 'Tidak ada varian yang cocok dengan filter aktif.' : 'Tidak ada titik dengan posisi dan QUAL valid untuk ditampilkan.'}
    </p> : <GenomeQualPlot points={points} />}
  </section>;
}

function GenomeQualPlot({ points }: { points: PlotPoint[] }) {
  const width = 800;
  const height = 360;
  const left = 86;
  const right = 24;
  const top = 18;
  const bottom = 62;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const minPosition = Math.min(...points.map(point => point.position));
  const maxPosition = Math.max(...points.map(point => point.position));
  const minQual = Math.min(...points.map(point => point.qual));
  const maxQual = Math.max(...points.map(point => point.qual));
  const x = (position: number) => left + (maxPosition === minPosition ? 0.5 : (position - minPosition) / (maxPosition - minPosition)) * plotWidth;
  const y = (qual: number) => top + plotHeight - (maxQual === minQual ? 0.5 : (qual - minQual) / (maxQual - minQual)) * plotHeight;
  const ticks = [0, 1, 2, 3, 4];
  const formatTick = (value: number) => value.toLocaleString('id-ID', { maximumFractionDigits: 2 });

  return <figure className="m-0 min-w-0" aria-labelledby="genome-qual-title">
    <svg className="block h-auto w-full" viewBox={`0 0 ${width} ${height}`} role="img"
      aria-label={`Scatter plot posisi genom dan QUAL, ${points.length.toLocaleString('id-ID')} varian`}>
      {ticks.map(tick => {
        const ratio = tick / 4;
        const yValue = top + plotHeight * ratio;
        const qualValue = maxQual === minQual ? maxQual : maxQual - (maxQual - minQual) * ratio;
        const positionValue = minPosition === maxPosition ? minPosition : minPosition + (maxPosition - minPosition) * ratio;
        const xValue = left + plotWidth * ratio;
        return <g key={tick}>
          <line x1={left} x2={width - right} y1={yValue} y2={yValue} stroke="var(--gp-border)" strokeDasharray="3 5" />
          <text x={left - 12} y={yValue + 4} textAnchor="end" fill="var(--gp-muted)" fontSize="12">{formatTick(qualValue)}</text>
          <text x={xValue} y={height - bottom + 20} textAnchor="middle" fill="var(--gp-muted)" fontSize="12">{formatTick(Math.round(positionValue))}</text>
        </g>;
      })}
      <line x1={left} x2={left} y1={top} y2={height - bottom} stroke="var(--gp-control-border)" />
      <line x1={left} x2={width - right} y1={height - bottom} y2={height - bottom} stroke="var(--gp-control-border)" />
      {points.map((point, index) => <circle key={`${point.position}-${index}`} cx={x(point.position)} cy={y(point.qual)} r="4"
        fill="var(--gp-brand)" stroke="var(--gp-surface)" strokeWidth="1.5">
        <title>{`Posisi genom: ${formatTick(point.position)} bp · QUAL: ${formatTick(point.qual)}`}</title>
      </circle>)}
      <text x={left + plotWidth / 2} y={height - 12} textAnchor="middle" fill="var(--gp-text)" fontSize="13">Posisi varian pada genom (bp)</text>
      <text transform={`translate(20 ${top + plotHeight / 2}) rotate(-90)`} textAnchor="middle" fill="var(--gp-text)" fontSize="13">QUAL</text>
    </svg>
    <figcaption className="sr-only">Setiap titik adalah satu varian dengan posisi dan nilai QUAL dari API.</figcaption>
  </figure>;
}

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
  const [downloadError, setDownloadError] = useState('');
  const [downloading, setDownloading] = useState<'vcf' | 'csv' | null>(null);
  const [summaryState, setSummary] = useState<{ key: string; data: JobResultSummary | null; error: string }>({ key: '', data: null, error: '' });
  const [tableState, setTable] = useState<{ key: string; data: JobVariantsResponse | null; error: string }>({ key: '', data: null, error: '' });
  const [plotState, setPlot] = useState<{ key: string; data: VariantPlotData | null; error: string }>({ key: '', data: null, error: '' });
  const limit = 10;
  const summaryKey = jobId + ':' + reload;
  const tableKey = summaryKey + ':' + offset + ':' + JSON.stringify(filters);
  const plotKey = summaryKey + ':' + JSON.stringify(filters);
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
  useEffect(() => {
    if (!valid || !jobId || !token) return;
    const controller = new AbortController();
    getJobVariantsForPlot(jobId, filters, token, controller.signal).then(data => {
      if (!controller.signal.aborted) setPlot({ key: plotKey, data, error: '' });
    }).catch(error => {
      if (!controller.signal.aborted) setPlot({ key: plotKey, data: null, error: error instanceof Error ? error.message : 'Data varian tidak dapat dimuat.' });
    });
    return () => controller.abort();
  }, [jobId, token, valid, filters, plotKey]);
  const loadingSummary = summaryState.key !== summaryKey;
  const loadingTable = tableState.key !== tableKey;
  const loadingPlot = plotState.key !== plotKey;
  const summary = loadingSummary ? null : summaryState.data;
  const table = loadingTable ? null : tableState.data;
  const plot = loadingPlot ? null : plotState.data;
  const plotError = loadingPlot ? '' : plotState.error;
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
  const download = async (format: 'vcf' | 'csv') => {
    if (!summary || !jobId || !token || downloading) return;
    setDownloading(format); setDownloadError('');
    try {
      const file = await downloadJobResult(jobId, format, token, format === 'csv' && table ? {
        variant_type: table.filters.variant_type ?? undefined,
        min_qual: table.filters.min_qual ?? undefined, max_qual: table.filters.max_qual ?? undefined,
      } : {});
      const url = URL.createObjectURL(file.blob);
      const link = document.createElement('a'); link.href = url;
      link.download = file.filename;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setDownloadError(error instanceof Error ? error.message : 'Unduhan gagal.'); }
    finally { setDownloading(null); }
  };
  if (!valid) return <p role="alert">ID Job tidak valid.</p>;
  const date = (value: string | null) => value ? new Date(value).toLocaleString('id-ID') : 'Belum tersedia';
  const inputClass = 'gp-input';
  return <div className="gp-result-page space-y-6">
    <Link to={'/jobs/' + jobId} className="text-blue-700 dark:text-blue-300 underline text-sm"><ArrowLeft className="inline w-4 h-4 mr-1" />Pemantauan analisis</Link>
    <header className="gp-section gp-result-identity space-y-4">
      <div className="flex justify-between items-start gap-4">
        <div><h1 className="text-2xl font-black">{summary?.analysis_name ?? 'Hasil analisis'}</h1>
          {summary && <p className="text-sm mt-2">Analisis #{summary.analysis_number ?? '?'} · <StatusBadge status={summary.status} /> · Mode: {summary.execution_mode ?? 'Tidak diketahui'}</p>}</div>
        <button type="button" aria-label="Muat ulang hasil" onClick={() => setReload(value => value + 1)} className="gp-button gp-button--secondary gp-icon-button"><RefreshCw className="w-4 h-4" /></button>
      </div>
      {loadingSummary && <p role="status">Memuat ringkasan…</p>}
      {!loadingSummary && summaryState.error && <p role="alert" className="text-rose-800 dark:text-rose-300">{summaryState.error}</p>}
      {summary && <div className="text-sm space-y-2">
        {summary.execution_mode === 'synthetic' && <p role="status" className="font-bold text-amber-800 dark:text-amber-300">DATA SINTETIS: untuk pengujian teknis, bukan hasil biologis nyata.</p>}
        {summary.reference?.sumber === 'genopath:synthetic-fixture' && <p role="status" className="font-bold text-amber-800 dark:text-amber-300">INPUT SINTETIS TERKONTROL: toolchain nyata; bukan validasi biologis Garlic.V2.</p>}
        {summary.reference && <p>Reference: {displayReferenceName(summary.reference.nama_genom)} · {summary.reference.versi ?? 'Versi tidak tersedia'}</p>}
        <p>Reference ID: #{summary.id_reference_genome} · Mulai: {date(summary.waktu_mulai)} · Selesai: {date(summary.waktu_selesai)}</p>
        <p>Seleksi analisis: QUAL ≥ {summary.parameters.parameter_qual}; FORMAT/DP ≥ {summary.parameters.parameter_dp};
          FILTER=PASS: {summary.parameters.require_pass == null ? 'Tidak diketahui' : summary.parameters.require_pass ? 'Ya' : 'Tidak'};
          Ploidi: {summary.parameters.variant_ploidy ?? 'Tidak diketahui'}.</p>

      </div>}
    </header>
    {summary && (hasVariantCounts(summary.counts) ? <section className="space-y-2"><div className="gp-result-stats">
      {[
        ['Total record varian', variantCount(summary.counts.total_variants)],
        ['SNP', variantCount(summary.counts.snps)],
        ['InDel', variantCount(summary.counts.indels)],
        ['Other', variantCount(summary.counts.other)],
        ['Tidak terklasifikasi', variantCount(summary.counts.unclassified)],
      ].map(([label, value]) => <div key={label}><h2 className="text-sm">{label}</h2><p className="mt-2">{Number(value).toLocaleString('id-ID')}</p></div>)}
    </div><p className="text-xs">Ringkasan seluruh hasil analisis.<ContextHelp label="Ringkasan varian">Filter tabel tidak mengubah ringkasan. Record multiallelic, dengan beberapa ALT, dihitung sebagai satu record. GT mempertahankan indeks alel dan pemisah asli VCF.</ContextHelp></p>
    <VariantDistribution counts={summary.counts} /></section> : <p role="alert" className="text-rose-800 dark:text-rose-300">Ringkasan jumlah varian dari server tidak valid; statistik dan distribusi tidak dapat ditampilkan.</p>)}
    <GenomeQualScatter loading={loadingPlot} error={plotError} data={plot} />
    <section className="gp-section gp-download-panel space-y-3" aria-label="Unduhan hasil">
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={!summary || Boolean(downloading)} onClick={() => void download('vcf')} className="gp-button gp-button--primary">{downloading === 'vcf' ? 'Mengunduh VCF…' : 'Unduh VCF hasil analisis'}</button>
        <button type="button" disabled={!summary || !table || Boolean(downloading)} onClick={() => void download('csv')} className="gp-button gp-button--primary"><FileSpreadsheet className="inline w-4 h-4 mr-1" />{downloading === 'csv' ? 'Mengunduh CSV…' : 'Unduh CSV seluruh hasil sesuai filter'}</button>
      </div><p className="text-xs">VCF: seluruh seleksi analisis. CSV: seluruh hasil sesuai filter, tanpa batas halaman.<ContextHelp label="Cakupan unduhan">VCF bukan file mentah caller dan tidak mengikuti filter tampilan. CSV mengikuti filter aktif pada semua halaman. Teks berpotensi formula diamankan untuk spreadsheet; nilai kosong tetap kosong.</ContextHelp></p>
      {downloadError && <p role="alert" className="text-rose-800 dark:text-rose-300">{downloadError}</p>}
    </section>
    <section className="gp-section">
      <div className="p-5 space-y-4">
        <h2 className="font-bold">Tabel Varian</h2>
        <form onSubmit={applyFilters} className="gp-filterbar">
          <div><label htmlFor="variant-type" className="block text-sm mb-1">Tipe varian</label>
            <select id="variant-type" value={type} onChange={event => setType(event.target.value)} className={inputClass}>
              <option value="">Semua tipe</option><option value="snp">SNP</option><option value="indel">InDel</option><option value="other">Other</option><option value="unclassified">Tidak terklasifikasi</option>
            </select></div>
          <div><label htmlFor="min-qual" className="block text-sm mb-1">QUAL minimum</label><input id="min-qual" type="number" min="0" step="any" value={minQual} onChange={event => setMinQual(event.target.value)} className={inputClass} /></div>
          <div><label htmlFor="max-qual" className="block text-sm mb-1">QUAL maksimum</label><input id="max-qual" type="number" min="0" step="any" value={maxQual} onChange={event => setMaxQual(event.target.value)} className={inputClass} /></div>
          <button className="gp-button gp-button--primary" type="submit">Terapkan filter</button>
        </form>
        <p className="text-xs">Filter tampilan tidak menjalankan ulang analisis.<ContextHelp label="Filter hasil">Tipe dan batas QUAL diterapkan pada seluruh varian tersimpan sebelum pembagian halaman. Filter ini tidak dapat mengembalikan record yang dikeluarkan oleh threshold analisis awal.</ContextHelp></p>
        {filterError && <p role="alert" className="text-rose-800 dark:text-rose-300">{filterError}</p>}
      </div>
      {loadingTable ? <p role="status" className="p-8"><Loader2 className="inline w-5 h-5 animate-spin mr-2" />Memuat varian…</p> :
        tableState.error ? <p role="alert" className="p-6 text-rose-800 dark:text-rose-300">{tableState.error}</p> :
          table && <><p className="px-5 pb-4 text-xs">Filter aktif: {table.filters.variant_type ?? 'semua tipe'}; QUAL minimum {table.filters.min_qual ?? 'tanpa batas'}, maksimum {table.filters.max_qual ?? 'tanpa batas'}.</p>
          <TableFrame label="Varian hasil analisis"><table className="gp-scientific-table"><caption className="sr-only">Record varian sesuai filter aktif</caption>
            <thead><tr className="border-y border-slate-300 dark:border-slate-700">{['Kromosom', 'Posisi (bp)', 'REF', 'ALT', 'QUAL', 'FORMAT/DP', 'GT asli', 'FILTER', 'Tipe'].map(label => <th scope="col" key={label} className="p-3">{label}</th>)}</tr></thead>
            <tbody>{table.items.map(variant => <tr key={variant.id_variant} className="gp-data">
              <td className="p-3">{variant.chromosome}</td><td className="p-3">{variant.position.toLocaleString('id-ID')}</td>
              <td className="p-3 gp-allele">{variant.ref_allele}</td><td className="p-3 gp-allele">{variant.alt_allele}</td><td className="p-3">{variant.qual ?? 'Tidak tersedia'}</td>
              <td className="p-3">{variant.genotypes.length ? variant.genotypes.map(call => call.dp ?? 'Tidak tersedia').join('; ') : 'Tidak tersedia'}</td>
              <td className="p-3">{variant.genotypes.length ? variant.genotypes.map(call => call.genotype_call || 'Tidak tersedia').join('; ') : 'Tidak tersedia'}</td>
              <td className="p-3">{variant.filter_status ?? 'Tidak tersedia'}</td><td className="p-3">{variant.variant_type ?? 'Tidak terklasifikasi'}</td>
            </tr>)}</tbody>
          </table></TableFrame>
          {table.items.length === 0 && <p className="p-6">{table.total === 0 ? 'Tidak ada record yang cocok dengan filter ini.' : 'Halaman ini kosong; kembali ke halaman sebelumnya.'}</p>}
          <Pagination from={table.items.length ? offset + 1 : 0} to={table.items.length ? offset + table.returned : 0} total={table.total}
            canPrevious={offset > 0} canNext={table.has_more && table.next_offset != null}
            previous={() => setOffset(value => Math.max(0, value - limit))}
            next={() => { if (table.next_offset != null) setOffset(table.next_offset); }} /></>}
    </section>
  </div>;
}
export default JobResultPage;
