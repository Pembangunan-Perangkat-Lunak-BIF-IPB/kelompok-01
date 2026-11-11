import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import type { JobItem } from '../../services/api';
import { StatusBadge } from '../ui/Foundation';

const analysisTime = (value: string | null) => value ? new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : 'Belum tersedia';

/** A persisted analysis, not a fabricated progress card. Global IDs remain URL identities. */
export function AnalysisRecord({ job, compact = false }: { job: JobItem; compact?: boolean }) {
  const resultReady = job.status === 'Completed' && job.has_result;
  return <article className={'gp-analysis-record' + (compact ? ' gp-analysis-record--compact' : '')}>
    <div className="gp-record-identity"><h3><Link to={'/jobs/' + job.id_job}>{job.analysis_name ?? 'Analisis'}</Link></h3>
      <p>Analisis #{job.analysis_number ?? '?'} · {job.execution_mode ?? 'Mode belum tersedia'}</p></div>
    <div className="gp-record-state"><StatusBadge status={job.status} />
      <p>{job.status === 'Completed' ? 'Selesai: ' + analysisTime(job.waktu_selesai) : job.status === 'Queued' ? 'Menunggu eksekusi' : 'Mulai: ' + analysisTime(job.waktu_mulai)}</p></div>
    {job.status === 'Failed' && <p className="gp-record-error">{job.pesan_error || 'Analisis gagal. Minta operator memeriksa log eksekusi.'}</p>}
    <Link className="gp-record-action" to={resultReady ? '/jobs/' + job.id_job + '/result' : '/jobs/' + job.id_job}>
      {resultReady ? 'Lihat Hasil' : job.status === 'Completed' ? 'Periksa ketersediaan hasil' : job.status === 'Failed' ? 'Periksa kegagalan' : 'Pantau status'}<ArrowUpRight size={16} aria-hidden="true" />
    </Link>
  </article>;
}

export function AnalysisProvenance({ job }: { job: JobItem }) {
  return <dl className="gp-provenance" aria-label="Identitas sumber analisis">
    <div><dt>Sample ID</dt><dd>#{job.id_sample}</dd></div>
    <div><dt>Reference ID</dt><dd>#{job.id_reference_genome}</dd></div>
    <div><dt>Mulai</dt><dd>{analysisTime(job.waktu_mulai)}</dd></div>
    <div><dt>Selesai</dt><dd>{analysisTime(job.waktu_selesai)}</dd></div>
  </dl>;
}
