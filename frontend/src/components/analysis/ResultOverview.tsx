import { useEffect, useState } from 'react';
import { getJobResult, type JobResultSummary } from '../../services/api';
import { displayReferenceName } from '../../services/displayText';
import { useAuth } from '../../context/auth';
import { Button } from '../ui/Foundation';

/** Loads only the existing owned Result API; unavailable data never becomes a zero. */
export function ResultOverview({ jobId }: { jobId: number }) {
  const { token } = useAuth();
  const [reload, setReload] = useState(0);
  const [state, setState] = useState<{ key: string; data: JobResultSummary | null; error: string }>({ key: '', data: null, error: '' });
  const key = jobId + ':' + token + ':' + reload;
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    getJobResult(jobId, token, controller.signal).then(data => {
      if (!controller.signal.aborted) setState({ key, data, error: '' });
    }).catch(error => {
      if (!controller.signal.aborted) setState({ key, data: null, error: error instanceof Error ? error.message : 'Ringkasan hasil tidak dapat dimuat.' });
    });
    return () => controller.abort();
  }, [jobId, token, key]);
  if (state.key !== key) return <p role="status" className="gp-result-preview-loading">Memuat ringkasan hasil tersimpan…</p>;
  if (state.error) return <div role="alert" className="gp-summary-error">{state.error} Metadata analisis tetap tersedia.<Button variant="ghost" onClick={() => setReload(value => value + 1)}>Muat ulang ringkasan</Button></div>;
  const result = state.data;
  if (!result) return null;
  return <div className="gp-result-overview">
    <p className="gp-variant-sentence"><strong>{result.counts.total_variants.toLocaleString('id-ID')} record varian</strong> tersimpan: <span>{result.counts.snps.toLocaleString('id-ID')} SNP</span> dan <span>{result.counts.indels.toLocaleString('id-ID')} InDel</span>.
      {result.counts.other > 0 && <> {result.counts.other} record bertipe lain.</>}{result.counts.unclassified > 0 && <> {result.counts.unclassified} record belum terklasifikasi.</>}</p>
    <dl className="gp-selection-summary"><div><dt>Reference genome</dt><dd>{result.reference ? displayReferenceName(result.reference.nama_genom) : '#' + result.id_reference_genome}{result.reference?.versi && <span> · {result.reference.versi}</span>}</dd></div>
      <div><dt>Seleksi analisis</dt><dd>QUAL ≥ {result.parameters.parameter_qual} · FORMAT/DP ≥ {result.parameters.parameter_dp}</dd></div>
      <div><dt>Konfigurasi caller</dt><dd>Ploidi: {result.parameters.variant_ploidy ?? 'Tidak tersedia'} · {result.parameters.require_pass === true ? 'FILTER=PASS' : result.parameters.require_pass === false ? 'FILTER tidak dibatasi' : 'FILTER tidak tersedia'}</dd></div></dl>
    {(result.execution_mode === 'synthetic' || result.reference?.sumber === 'genopath:synthetic-fixture') && <p className="gp-biological-note">Input sintetis untuk pengujian teknis, bukan validasi biologis Garlic.V2.</p>}
  </div>;
}
