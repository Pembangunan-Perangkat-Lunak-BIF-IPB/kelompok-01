import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UploadCloud, Loader2, PlayCircle, RotateCcw } from 'lucide-react';
import { useAuth } from '../context/auth';
import { ApiError, downloadDemoInput, getJobOptions, submitAnalysis, validateFile, type JobOptions, type SubmissionResponse } from '../services/api';
import { ContextHelp } from '../components/ContextHelp';
import { PageHeader } from '../components/ui/Foundation';
import { displayReferenceName } from '../services/displayText';
import { clearDraft, loadDraft, makeParameters, matchesFile, saveDraft, type SubmissionDraft } from '../services/submissionDraft';

export function NewAnalysisPage() {
  const { token, user } = useAuth();
  const username = user?.username || '';
  const navigate = useNavigate();
  const inFlight = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [restored] = useState(() => {
    try { return { draft: loadDraft(username), error: '' }; }
    catch (error) { return { draft: null, error: (error as Error).message }; }
  });
  const [draft, setDraft] = useState<SubmissionDraft | null>(restored.draft);
  const [name, setName] = useState(restored.draft?.parameters.analysis_name ?? '');
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
    const input = fileInput.current;
    const cancel = () => {
      if (!inFlight.current && !input?.files?.length) { setFile(null); setError(''); setPartial(null); }
    };
    input?.addEventListener('cancel', cancel);
    return () => input?.removeEventListener('cancel', cancel);
  }, []);

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
  const nameError = name.trim().length > 80 || /[\p{C}]/u.test(name) ? 'Nama maksimal 80 karakter, tanpa karakter kontrol.' : '';
  const qualError = !qual.trim() || !Number.isFinite(Number(qual)) || Number(qual) < 0 ? 'QUAL harus berupa angka ≥ 0.' : '';
  const dpError = !dp.trim() || !Number.isInteger(Number(dp)) || Number(dp) < 0 || Number(dp) > 2147483647 ? 'DP harus bilangan bulat 0-2147483647.' : '';
  const configured = options?.pipeline_enabled && options.alignment_strategy === 'bowtie2';
  const selectFile = (candidate: File | null) => {
    if (inFlight.current || draft?.reconciliation || restored.error) return;
    setFile(null); setError(''); setPartial(null);
    if (!candidate) return;
    try {
      validateFile(candidate, options?.upload_max_bytes);
      if (draft && !matchesFile(draft, candidate)) throw new Error('Pilih kembali berkas yang sama dengan submission tertunda (nama, ukuran, waktu modifikasi).');
      setFile(candidate); setError('');
    } catch (reason) { setError((reason as Error).message); }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (inFlight.current || !token || !file || !configured || draft?.reconciliation || restored.error) return;
    if (nameError || qualError || dpError) { setError(nameError || qualError || dpError); return; }
    inFlight.current = true;
    setError(''); setPartial(null);
    let active: SubmissionDraft;
    try {
      active = draft ?? {
        parameters: makeParameters({ name, reference, ploidy, qual, dp, filename: file.name }),
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
        // Rejected content/configuration is definitive; never leave rejected input ready.
        setFile(null);
        if (fileInput.current) fileInput.current.value = '';
        // A corrected upload needs a new UUID.
        try { clearDraft(username); setDraft(null); } catch { /* Retain identity if storage fails. */ }
      }
    } finally { inFlight.current = false; setUploading(false); }
  };
  const inputClass = 'gp-input';
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

  return <div className="gp-form-page pb-12">
    <PageHeader title="Mulai Analisis Varian Baru" description="Pilih FASTQ single-end, tentukan konfigurasi, lalu jalankan analisis." />
    {(restored.error || optionsError || error) && <div role="alert" className="gp-alert gp-alert--error">
      {restored.error || optionsError || error}
      {optionsError && <button type="button" className="underline ml-3" onClick={() => setReload(value => value + 1)}>Muat ulang konfigurasi</button>}
    </div>}
    {!options && !optionsError && <p role="status">Memuat pilihan reference…</p>}
    {options && !configured && <p role="status" className="glass-card rounded-xl p-4">Eksekusi biologis belum diaktifkan atau aligner Bowtie2 belum dikonfigurasi oleh operator.</p>}
    {options && options.references.length === 0 && <p className="glass-card rounded-xl p-4">Belum ada reference yang tersedia pada server. Operator perlu menyiapkannya sebelum analisis.</p>}
    <form onSubmit={submit} className="space-y-6">
      <section className="gp-section space-y-2">
        <label htmlFor="analysis-name" className="block text-sm font-semibold">Nama analisis (opsional)</label>
        <input id="analysis-name" value={name} maxLength={80} disabled={locked} placeholder="Contoh: Sampel Bawang A"
          onChange={event => setName(event.target.value)} aria-invalid={Boolean(nameError)} aria-describedby="name-help"
          className={inputClass} />
        <p id="name-help" className="text-xs">Kosongkan untuk nama otomatis. Maksimal 80 karakter.</p>
        {nameError && <p role="alert" className="text-rose-800 dark:text-rose-300 text-sm">{nameError}</p>}
      </section>
      <section className="gp-section space-y-4">
        <h2 className="font-bold text-blue-700 dark:text-blue-300">01 · Input FASTQ single-end</h2>
        <div className="gp-upload space-y-3"
          onDragOver={event => event.preventDefault()} onDrop={event => {
            event.preventDefault(); if (event.dataTransfer.files[0]) selectFile(event.dataTransfer.files[0]);
          }}>
          <UploadCloud aria-hidden="true" className="w-8 h-8 text-blue-600" />
          <label htmlFor="fastq" className="block text-sm font-semibold">{draft ? 'Pilih kembali FASTQ yang sama untuk melanjutkan submission' : 'Pilih atau seret berkas FASTQ'}</label>
          <input ref={fileInput} id="fastq" type="file" accept=".fastq,.fastq.gz" disabled={uploading || draft?.reconciliation || Boolean(restored.error)}
            onChange={event => selectFile(event.currentTarget.files?.[0] ?? null)}
            className="block w-full text-sm" />
          <p className="text-xs">.fastq / .fastq.gz · {options ? 'Maksimum ' + (options.upload_max_bytes / 1024 ** 2).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + ' MiB.' : 'Memuat batas unggah…'} Validasi isi dilakukan server saat dikirim.</p>
          {options?.references.some(item => item.sumber === 'genopath:synthetic-fixture') && <div className="text-xs space-y-2">
            <p>Demo teknis: gunakan contoh sintetis 20 kbp dengan reference fixture, ploidi 2. Bukan data biologis Garlic.V2.</p>
            <button type="button" onClick={() => void getDemoInput()} disabled={downloadingInput} className="text-blue-700 dark:text-blue-300 underline py-2">
              {downloadingInput ? 'Mengunduh contoh…' : 'Unduh FASTQ contoh sintetis'}
            </button>
          </div>}
          {file && <p className="gp-file-state">{file.name} · {(file.size / 1_000_000).toFixed(2)} MB · File siap dikirim.</p>}
        </div>
      </section>
      <section className="gp-section space-y-4">
        <h2 className="font-bold text-blue-700 dark:text-blue-300">02 · Konfigurasi analisis</h2>
        <fieldset disabled={locked} className="space-y-4">
          <div><label htmlFor="reference" className="block text-sm font-semibold mb-1">Genom reference</label>
            <select id="reference" required className={inputClass} value={reference} onChange={event => setReference(event.target.value)}>
              <option value="">Pilih reference yang tersedia</option>
              {options?.references.map(item => <option key={item.id_reference_genome} value={item.id_reference_genome}>{displayReferenceName(item.nama_genom)}{item.versi ? ' · ' + item.versi : ''} (#{item.id_reference_genome})</option>)}
            </select>
            {selectedReference?.sumber && <p className="text-xs mt-1">Sumber: {selectedReference.sumber}</p>}
          </div>
          <div><label htmlFor="ploidy" className="block text-sm font-semibold mb-1">Ploidi untuk variant calling</label>
            <ContextHelp label="Ploidi">Jumlah salinan kromosom yang digunakan caller. Pilih sesuai dataset; aplikasi tidak menentukannya dari FASTQ.</ContextHelp>
            <select id="ploidy" required value={ploidy} className={inputClass} onChange={event => setPloidy(event.target.value)}>
              <option value="">Pilih sesuai dataset</option>
              {options?.variant_ploidies.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><h3 className="font-semibold text-sm">Seleksi varian</h3>
                <p className="text-xs mt-1">{!qualError && !dpError && Number(qual) === 30 && Number(dp) === 10 ? 'Default' : 'Konfigurasi khusus'} · QUAL ≥ {qual || '…'} · FORMAT/DP ≥ {dp || '…'} · FILTER=PASS</p></div>
              <button type="button" aria-expanded={advanced} aria-controls="thresholds" onClick={() => setAdvanced(!advanced)}
                className="gp-button gp-button--secondary">Pengaturan lanjutan {advanced ? '−' : '+'}</button>
            </div>
            {!advanced && (qualError || dpError) && <p role="alert" className="text-sm text-rose-800 dark:text-rose-300">{qualError || dpError} Buka pengaturan lanjutan untuk memperbaiki nilai.</p>}
            {advanced && <div id="thresholds" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center"><label htmlFor="qual" className="text-sm font-semibold">Minimum QUAL</label>
                  <ContextHelp label="Minimum QUAL">Skor kualitas varian pada kolom QUAL VCF. Threshold lebih tinggi mempertahankan lebih sedikit record yang memenuhi syarat, bukan jaminan akurasi lebih tinggi. Nilai QUAL yang hilang dikecualikan, termasuk jika threshold 0.</ContextHelp></div>
                <p id="qual-help" className="text-xs mb-2">Ambang kualitas minimum varian. Default: 30.</p>
                <input id="qual" type="number" min="0" step="any" required value={qual} aria-invalid={Boolean(qualError)} aria-describedby={'qual-help' + (qualError ? ' qual-error' : '')}
                  onChange={event => setQual(event.target.value)} className={inputClass} />
                {qualError && <p id="qual-error" role="alert" className="text-sm text-rose-800 dark:text-rose-300 mt-2">{qualError}</p>}
              </div>
              <div>
                <div className="flex items-center"><label htmlFor="dp" className="text-sm font-semibold">Minimum FORMAT/DP</label>
                  <ContextHelp label="Minimum FORMAT/DP">Jumlah read pada posisi varian untuk sample terkait, sesuai FORMAT/DP dalam VCF. Ini bukan jumlah read pendukung ALT saja dan bukan INFO/DP. Threshold lebih tinggi dapat mengurangi hasil. Nilai DP yang hilang tetap dikecualikan.</ContextHelp></div>
                <p id="dp-help" className="text-xs mb-2">Kedalaman minimum per sample. Default: 10.</p>
                <input id="dp" type="number" min="0" max="2147483647" step="1" required value={dp} aria-invalid={Boolean(dpError)} aria-describedby={'dp-help' + (dpError ? ' dp-error' : '')}
                  onChange={event => setDp(event.target.value)} className={inputClass} />
                {dpError && <p id="dp-error" role="alert" className="text-sm text-rose-800 dark:text-rose-300 mt-2">{dpError}</p>}
              </div>
              <p className="text-xs sm:col-span-2">Nilai tersimpan saat panel ditutup. Parameter ini menentukan seleksi analisis.</p>
            </div>}
          </div>
        </fieldset>
      </section>
      <section className="gp-summary space-y-2 text-sm">
        <h2 className="font-bold">Ringkasan sebelum dikirim</h2>
        <p>Nama: {name.trim() || 'Otomatis setelah dikirim'}</p>
        <p className="break-all">Berkas: {file ? file.name : 'Belum dipilih'}{file ? ' (' + (file.size / 1_000_000).toFixed(2) + ' MB)' : ''}</p>
        <p>Reference: {selectedReference ? displayReferenceName(selectedReference.nama_genom) : (reference ? '#' + reference : 'Belum dipilih')} · Ploidi: {ploidy || 'Belum dipilih'}</p>
        <p>Single-end · Bowtie2 / Nextflow · QUAL ≥ {qualError ? 'Tidak valid' : qual} · FORMAT/DP ≥ {dpError ? 'Tidak valid' : dp} · FILTER=PASS</p>
        {draft && <div role="status" className="space-y-2 break-all">
          <p>UUID submission: <code>{draft.parameters.request_id}</code></p>
          <p>{draft.reconciliation ? 'Hasil pengiriman memerlukan rekonsiliasi operator. Jangan membuat UUID baru atau mengunggah ulang.' : 'Konfigurasi dikunci. Pengiriman ulang memakai UUID dan berkas yang sama agar tidak membuat Sample kedua.'}</p>
        </div>}
        {partial?.sample && <p>Sample tersimpan: #{partial.sample.id_sample}.</p>}
        {partial?.job && <Link className="text-blue-700 dark:text-blue-300 underline" to={'/jobs/' + partial.job.id_job}>Periksa Job #{partial.job.id_job}</Link>}
      </section>
      <div className="flex flex-wrap justify-end gap-3">
        {!draft && <button type="button" disabled={uploading} className="gp-button gp-button--secondary" onClick={() => { setQual('30'); setDp('10'); }}><RotateCcw className="inline w-4 h-4 mr-1" />Reset threshold</button>}
        <button type="submit" disabled={Boolean(nameError || qualError || dpError) || !file || !reference || !ploidy || !configured || uploading || draft?.reconciliation || Boolean(restored.error)}
          className="gp-button gp-button--primary">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
          {uploading ? 'Mengunggah dan memvalidasi…' : draft ? 'Kirim ulang submission yang sama' : 'Jalankan Analisis'}
        </button>
      </div>
    </form>
  </div>;
}
export default NewAnalysisPage;
