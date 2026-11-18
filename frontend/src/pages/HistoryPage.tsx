
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Plus, Search } from 'lucide-react';
import { useJobPolling } from '../hooks/useJobPolling';
import { PageHeader, Button, Alert, StatePanel } from '../components/ui/Foundation';
import { JobTable } from '../components/analysis/JobTable';

export function HistoryPage() {
  const { jobs, error, updated, loading, reload } = useJobPolling();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');

  const keyword = search.trim().toLocaleLowerCase();

  const visible = jobs.filter(job => {
    const matchesStatus = status === 'ALL' || job.status === status;
    const matchesSearch =
      String(job.analysis_number ?? '').includes(keyword) ||
      (job.analysis_name ?? '').toLocaleLowerCase().includes(keyword);

    return matchesStatus && matchesSearch;
  });

  const resetFilters = () => {
    setSearch('');
    setStatus('ALL');
  };

  return (
    <div className="gp-history-page">
      <PageHeader
        title="Riwayat Analisis"
        description="Temukan kembali analisis, tinjau status, dan buka hasil milik akun Anda."
        actions={
          <>
            <Button
              variant="secondary"
              className="gp-icon-button"
              aria-label="Segarkan status"
              onClick={reload}
            >
              <RefreshCw size={17} />
            </Button>
            <Link className="gp-link-button" to="/analisis-baru">
              <Plus size={17} />
              Analisis Baru
            </Link>
          </>
        }
      />

      {error && (
        <Alert>
          {error}
          {jobs.length > 0 && ' Data terakhir ditampilkan; status mungkin sudah berubah.'}
        </Alert>
      )}

      <section className="gp-history-toolbar" aria-label="Pencarian dan filter riwayat">
        <div className="gp-history-search">
          <label htmlFor="job-search">Cari analisis</label>
          <div className="gp-search-input">
            <Search size={17} aria-hidden="true" />
            <input
              id="job-search"
              className="gp-input"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Nama atau nomor analisis..."
            />
          </div>
        </div>

        <div className="gp-history-status">
          <label htmlFor="job-status">Status analisis</label>
          <select
            id="job-status"
            className="gp-input"
            value={status}
            onChange={event => setStatus(event.target.value)}
          >
            <option value="ALL">Semua status</option>
            <option value="Queued">Queued</option>
            <option value="Running">Running</option>
            <option value="Completed">Completed</option>
            <option value="Failed">Failed</option>
          </select>
        </div>

        {(search || status !== 'ALL') && (
          <Button variant="ghost" onClick={resetFilters}>
            Reset filter
          </Button>
        )}
      </section>

      <div className="gp-history-summary">
        <div>
          <strong>{visible.length}</strong>
          <span> analisis ditemukan</span>
        </div>
        <span className="gp-category-label">Kategori: Variant Calling</span>
      </div>

      {loading ? (
        <StatePanel loading title="Memuat riwayat analisis..." />
      ) : visible.length > 0 ? (
        <JobTable jobs={visible} />
      ) : !error ? (
        <StatePanel
          title={jobs.length > 0 ? 'Tidak ada analisis yang sesuai.' : 'Belum ada riwayat analisis.'}
          action={
            jobs.length > 0 ? (
              <Button variant="secondary" onClick={resetFilters}>
                Reset filter
              </Button>
            ) : (
              <Link className="gp-link-button" to="/analisis-baru">
                Mulai analisis pertama
              </Link>
            )
          }
        >
          {jobs.length > 0
            ? 'Coba ubah kata kunci pencarian atau status yang dipilih.'
            : 'Setiap analisis yang Anda kirim akan tersimpan di sini.'}
        </StatePanel>
      ) : null}

      {updated && (
        <p className="gp-row-meta mt-4">
          Pembaruan otomatis setiap 4 detik. Terakhir diterima: {updated}
        </p>
      )}
    </div>
  );
}

export default HistoryPage;
