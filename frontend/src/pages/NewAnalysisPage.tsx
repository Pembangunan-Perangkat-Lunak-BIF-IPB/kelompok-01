import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UploadCloud, Loader2, PlayCircle, RotateCcw } from 'lucide-react';
import { useAuth } from '../context/auth';
import { ApiError, downloadDemoInput, getJobOptions, submitAnalysis, validateFile, type JobOptions, type SubmissionResponse } from '../services/api';
import { clearDraft, loadDraft, makeParameters, matchesFile, saveDraft, type SubmissionDraft } from '../services/submissionDraft';

export function NewAnalysisPage() {
  const { token, user } = useAuth();
  const username = user?.username || '';
  const navigate = useNavigate();
  const inFlight = useRef(false);
  const [restored] = useState(() => {
    try { return { draft: loadDraft(username), error: '' }; }
    catch (error) { return { draft: null, error: (error as Error).message }; }
  });
  const [draft, setDraft] = useState<SubmissionDraft | null>(restored.draft);
  const [file, setFile] = useState<File | null>(null);
  const [reference, setReference] = useState(String(restored.draft?.parameters.id_reference_genome ?? ''));
  const [ploidy, setPloidy] = useState(String(restored.draft?.parameters.variant_ploidy ?? ''));
  const [qual, setQual] = useState(String(restored.draft?.parameters.parameter_qual ?? 30));
  const [dp, setDp] = useState(String(restored.draft?.parameters.parameter_dp ?? 10));
  const [advanced, setAdvanced] = useState(Boolean(restored.draft));
  const [options, setOptions] = useState<JobOptions | null>(null);
  const [optionsError, setOptionsError] = useState('');
  const [reload, setReload] = useState(0);
  const [error, setError] = useState('');
  const [partial, setPartial] = useState<SubmissionResponse | null>(null);
  const [uploading, setUploading] = useState(false);
  const [downloadingInput, setDownloadingInput] = useState(false);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    getJobOptions(token, controller.signal).then(data => {
      if (!controller.signal.aborted) { setOptions(data); setOptionsError(''); }
    }).catch(reason => {
      if (!controller.signal.aborted) setOptionsError(reason instanceof Error ? reason.message : 'Konfigurasi tidak dapat dimuat.');
    });
    return () => controller.abort();
  }, [token, reload]);

  const locked = Boolean(draft) || uploading;
  const configured = options?.pipeline_enabled && options.alignment_strategy === 'bowtie2';
  const selectFile = (candidate: File) => {
    if (inFlight.current || draft?.reconciliation || restored.error) return;
    try {
      validateFile(candidate, options?.upload_max_bytes);
      if (draft && !matchesFile(draft, candidate)) throw new Error('Pilih kembali berkas yang sama dengan submission tertunda (nama, ukuran, waktu modifikasi).');
      setFile(candidate); setError('');
    } catch (reason) { setError((reason as Error).message); }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (inFlight.current || !token || !file || !configured || draft?.reconciliation || restored.error) return;
    inFlight.current = true;
    setError(''); setPartial(null);
    let active: SubmissionDraft;
    try {
      active = draft ?? {
        parameters: makeParameters({ reference, ploidy, qual, dp, filename: file.name }),
        file: { name: file.name, size: file.size, lastModified: file.lastModified }, reconciliation: false,
      };
      // Persist the UUID BEFORE sending. Reload/retry must never silently create a new submission.
      saveDraft(username, active);
      setDraft(active); setUploading(true);
      const result = await submitAnalysis(file, token, active.parameters);
      try { clearDraft(username); } catch { /* A retained accepted UUID can safely replay. */ }
      navigate('/jobs/' + result.job!.id_job, { state: {
        notification: result.dispatch_scheduled ? 'Submission diterima dan eksekusi dijadwalkan. Pantau status Job.' : 'Submission ditemukan kembali. Status ditampilkan dari server.',
      } });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Pengiriman belum dapat dipastikan.');
      if (reason instanceof ApiError && reason.submission) {
        setPartial(reason.submission);
        if (reason.submission.submission_status === 'reconciliation_required') {
          const blocked = { ...active!, reconciliation: true };
          setDraft(blocked);
          try { saveDraft(username, blocked); } catch { /* Keep the blocked in-memory state. */ }
        }
      } else if (reason instanceof ApiError && [413, 422].includes(reason.status)) {
        // Rejected content/configuration is definitive; a corrected upload needs a new UUID.
        try { clearDraft(username); setDraft(null); } catch { /* Retain identity if storage fails. */ }
      }
    } finally { inFlight.current = false; setUploading(false); }
  };
  const inputClass = 'w-full glass-card rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 disabled:opacity-60';
  const selectedReference = options?.references.find(item => item.id_reference_genome === Number(reference));
  const getDemoInput = async () => {
    if (!token || downloadingInput) return;
    setDownloadingInput(true); setError('');
    try {
      const url = URL.createObjectURL(await downloadDemoInput(token));
      const link = document.createElement('a');
      link.href = url; link.download = 'genopath_synthetic_SE.fastq.gz';
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Contoh FASTQ tidak tersedia.'); }
    finally { setDownloadingInput(false); }
  };

  return <div className="max-w-3xl mx-auto space-y-6 pb-12">
    <header className="text-center space-y-3 pt-2">
      <h1 className="text-3xl font-black">Mulai Analisis Varian Baru</h1>
      <p className="glass-card rounded-2xl p-4 text-sm">Pilih FASTQ single-end, tentukan konfigurasi, lalu jalankan analisis.</p>
    </header>
    {(restored.error || optionsError || error) && <div role="alert" className="glass-card rounded-xl p-4 text-rose-800 dark:text-rose-300">
      {restored.error || optionsError || error}
      {optionsError && <button type="button" className="underline ml-3" onClick={() => setReload(value => value + 1)}>Muat ulang konfigurasi</button>}
    </div>}
    {!options && !optionsError && <p role="status">Memuat pilihan reference…</p>}
    {options && !configured && <p role="status" className="glass-card rounded-xl p-4">Eksekusi biologis belum diaktifkan atau aligner Bowtie2 belum dikonfigurasi oleh operator.</p>}
    {options && options.references.length === 0 && <p className="glass-card rounded-xl p-4">Belum ada reference yang tersedia pada server. Operator perlu menyiapkannya sebelum analisis.</p>}
    <form onSubmit={submit} className="space-y-6">
      <section className="glass-card rounded-3xl p-6 space-y-4">
        <h2 className="font-bold text-blue-700 dark:text-blue-300">01 · Input FASTQ single-end</h2>
        <div className="border-2 border-dashed border-blue-400 rounded-2xl p-6 space-y-3"
          onDragOver={event => event.preventDefault()} onDrop={event => {
            event.preventDefault(); if (event.dataTransfer.files[0]) selectFile(event.dataTransfer.files[0]);
          }}>
          <UploadCloud aria-hidden="true" className="w-8 h-8 text-blue-600" />
          <label htmlFor="fastq" className="block text-sm font-semibold">{draft ? 'Pilih kembali FASTQ yang sama untuk melanjutkan submission' : 'Pilih atau seret berkas FASTQ'}</label>
          <input id="fastq" type="file" accept=".fastq,.fastq.gz" disabled={uploading || draft?.reconciliation || Boolean(restored.error)}
            onChange={event => { if (event.target.files?.[0]) selectFile(event.target.files[0]); }} className="block w-full text-sm" />
          <p className="text-xs">.fastq / .fastq.gz · {options ? 'Maksimum ' + (options.upload_max_bytes / 1024 ** 2).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + ' MiB.' : 'Memuat batas unggah…'} Validasi isi dilakukan server saat dikirim.</p>
          {options?.references.some(item => item.sumber === 'genopath:synthetic-fixture') && <div className="text-xs space-y-2">
            <p>Demo teknis: gunakan contoh sintetis 20 kbp dengan reference fixture, ploidi 2. Bukan data biologis Garlic.V2.</p>
            <button type="button" onClick={() => void getDemoInput()} disabled={downloadingInput} className="text-blue-700 dark:text-blue-300 underline py-2">
              {downloadingInput ? 'Mengunduh contoh…' : 'Unduh FASTQ contoh sintetis'}
            </button>
          </div>}
          {file && <p className="text-sm break-all">{file.name} · {(file.size / 1_000_000).toFixed(2)} MB · Belum berarti analisis berjalan.</p>}
        </div>
      </section>
      <section className="glass-card rounded-3xl p-6 space-y-4">
        <h2 className="font-bold text-blue-700 dark:text-blue-300">02 · Konfigurasi analisis</h2>
        <fieldset disabled={locked} className="space-y-4">
          <div><label htmlFor="reference" className="block text-sm font-semibold mb-1">Genom reference</label>
            <select id="reference" required className={inputClass} value={reference} onChange={event => setReference(event.target.value)}>
              <option value="">Pilih reference yang tersedia</option>
              {options?.references.map(item => <option key={item.id_reference_genome} value={item.id_reference_genome}>{item.nama_genom}{item.versi ? ' · ' + item.versi : ''} (#{item.id_reference_genome})</option>)}
            </select>
            {selectedReference?.sumber && <p className="text-xs mt-1">Sumber: {selectedReference.sumber}</p>}
          </div>
          <div><label htmlFor="ploidy" className="block text-sm font-semibold mb-1">Ploidi untuk variant calling</label>
            <select id="ploidy" required value={ploidy} className={inputClass} onChange={event => setPloidy(event.target.value)}>
              <option value="">Pilih sesuai dataset</option>
              {options?.variant_ploidies.map(value => <option key={value} value={value}>{value}</option>)}
            </select><p className="text-xs mt-1">Parameter caller harus sesuai dataset; tidak disimpulkan otomatis dari FASTQ.</p>
          </div>
          <button type="button" role="switch" aria-checked={advanced} aria-controls="thresholds" onClick={() => {
            setAdvanced(!advanced); if (advanced) { setQual('30'); setDp('10'); }
          }} className="glass-card px-4 py-2 rounded-xl text-sm">Advanced QUAL/DP: {advanced ? 'Aktif' : 'Nonaktif'}</button>
          {advanced ? <div id="thresholds" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label htmlFor="qual" className="block text-sm mb-1">Minimum QUAL</label>
              <input id="qual" type="number" min="0" step="any" required value={qual} onChange={event => setQual(event.target.value)} className={inputClass} /></div>
            <div><label htmlFor="dp" className="block text-sm mb-1">Minimum FORMAT/DP</label>
              <input id="dp" type="number" min="0" max="2147483647" step="1" required value={dp} onChange={event => setDp(event.target.value)} className={inputClass} /></div>
            <p className="text-xs sm:col-span-2">Varian dengan QUAL/DP hilang dikecualikan, termasuk pada threshold nol. Ini parameter seleksi analisis, bukan filter tampilan.</p>
          </div> : <p className="text-sm">Preset seleksi: QUAL ≥ 30, FORMAT/DP ≥ 10, FILTER=PASS.</p>}
        </fieldset>
      </section>
      <section className="glass-card rounded-2xl p-5 space-y-2 text-sm">
        <h2 className="font-bold">Ringkasan sebelum dikirim</h2>
        <p>Reference: {selectedReference?.nama_genom ?? (reference ? '#' + reference : 'Belum dipilih')} · Ploidi: {ploidy || 'Belum dipilih'}</p>
        <p>Single-end · Bowtie2 / Nextflow · QUAL ≥ {qual} · FORMAT/DP ≥ {dp} · FILTER=PASS</p>
        {draft && <div role="status" className="space-y-2 break-all">
          <p>UUID submission: <code>{draft.parameters.request_id}</code></p>
          <p>{draft.reconciliation ? 'Hasil pengiriman memerlukan rekonsiliasi operator. Jangan membuat UUID baru atau mengunggah ulang.' : 'Konfigurasi dikunci. Pengiriman ulang memakai UUID dan berkas yang sama agar tidak membuat Sample kedua.'}</p>
        </div>}
        {partial?.sample && <p>Sample tersimpan: #{partial.sample.id_sample}.</p>}
        {partial?.job && <Link className="text-blue-700 dark:text-blue-300 underline" to={'/jobs/' + partial.job.id_job}>Periksa Job #{partial.job.id_job}</Link>}
      </section>
      <div className="flex flex-wrap justify-end gap-3">
        {!draft && <button type="button" disabled={uploading} className="glass-card px-4 py-3 rounded-xl text-sm" onClick={() => { setQual('30'); setDp('10'); }}><RotateCcw className="inline w-4 h-4 mr-1" />Reset threshold</button>}
        <button type="submit" disabled={!file || !reference || !ploidy || !configured || uploading || draft?.reconciliation || Boolean(restored.error)}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-500 text-white font-bold px-6 py-3 rounded-xl flex items-center gap-2">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
          {uploading ? 'Mengunggah dan memvalidasi…' : draft ? 'Kirim ulang submission yang sama' : 'Jalankan Analisis'}
        </button>
      </div>
    </form>
  </div>;
}
export default NewAnalysisPage;
