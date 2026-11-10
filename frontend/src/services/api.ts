// --- Interface Payload & Response Autentikasi ---

export interface LoginPayload {
  username: string;
  password: string;
}

// Skema Registrasi: Menggunakan 'nama' sesuai backend Pydantic
export interface RegisterPayload {
  username: string;
  nama: string;
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user?: {
    id: string;
    username: string;
    nama?: string;
    name?: string; // Fallback jika BE mengembalikan 'name'
    email?: string;
  };
}

// --- Interface Samples & Jobs (M8 / M9) ---

export interface SampleUploadResponse {
  id_sample?: number;
  sample_id?: number;
  id?: number;
  nama_berkas?: string;
  ukuran_berkas?: number;
  waktu_unggah?: string;
}

export interface JobItem {
  id_job?: number | string;
  job_id?: number | string;
  id?: number | string;
  id_sample?: number;
  sample_id?: number;
  status: 'Queued' | 'Running' | 'Completed' | 'Failed' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | string;
  waktu_mulai?: string | null;
  waktu_selesai?: string | null;
  pesan_error?: string | null;
  execution_mode?: 'synthetic' | 'nextflow' | string;
  has_result?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface JobCreateOptions {
  id_reference_genome?: number;
  request_id?: string;
  vcf_sample?: string;
  parameter_qual?: number;
  parameter_dp?: number;
  min_qual?: number;
  min_dp?: number;
  custom_flags?: string;
  is_advanced?: boolean;
  require_pass?: boolean;
  execution_mode?: 'synthetic' | 'nextflow';
  variant_ploidy?: number;
  library_type?: string;
  reference_genome?: string;
}

// Skema untuk endpoint otomatisasi (Upload + Create + Start Job)
export interface UploadAndRunResponse {
  request_id?: string;
  submission_status?: string;
  sample?: SampleUploadResponse;
  job?: JobItem;
  id_job?: number | string;
  id_sample?: number;
  status?: string;
}

// Skema Kontrak Hasil BE M9 (Menggunakan struktur counts)
export interface JobResultCounts {
  total_variants: number;
  snps: number;
  indels: number;
  other: number;
}

export interface JobResultSummary {
  id_job?: number | string;
  job_id?: number | string;
  id_analysis?: number;
  status?: string;
  // Kontrak Resmi Backend M9
  counts?: JobResultCounts;
  // Fallback compatibility jika properti dibaca langsung di root
  total_varian?: number;
  snp_count?: number;
  indel_count?: number;
  other_count?: number;
  execution_mode?: string;
  created_at?: string;
  checksum?: string;
  reference_genome?: string;
  filter_params?: string;
  alignment_rate?: number;
  titv_ratio?: number;
  mean_dp?: number;
  vcf_status?: string;
}

export interface GenotypeItem {
  id_genotype: number;
  id_sample: number;
  genotype_call: string;
  dp: number;
}

export interface VariantItem {
  id_variant: number;
  chromosome: string;
  position: number;
  ref_allele: string;
  alt_allele: string;
  qual: number | null; // Null-safe sesuai audit (dapat bernilai null)
  variant_type: 'snp' | 'indel' | 'other' | string;
  filter_status: string;
  genotypes?: GenotypeItem[];
}

// Hanya mengirim parameter yang didukung BE (Mencegah HTTP 422)
export interface VariantQueryParams {
  limit?: number;
  offset?: number;
  variant_type?: string; // 'snp' | 'indel' | 'other'
  min_qual?: number;
  max_qual?: number;
}

export interface JobVariantsResponse {
  id_job?: number | string;
  id_analysis?: number;
  items: VariantItem[];
  total: number;
  limit: number;
  offset: number;
  returned?: number;
  has_more?: boolean;
  next_offset?: number | null;
}

// Custom ApiError (Mendukung erasableSyntaxOnly TypeScript)
export class ApiError extends Error {
  status: number;
  retryAfter: string | null;

  constructor(status: number, message: string, retryAfter: string | null = null) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

// --- Helper Utilities ---

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function parseDetailError(detail: any, defaultMsg: string): string {
  if (!detail) return defaultMsg;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((err) => {
        if (typeof err === 'string') return err;
        const field = err.loc ? err.loc.filter((l: string) => l !== 'body').join('.') : '';
        return field ? `${field}: ${err.msg || JSON.stringify(err)}` : err.msg || JSON.stringify(err);
      })
      .join(', ');
  }
  if (typeof detail === 'object') {
    return JSON.stringify(detail);
  }
  return String(detail);
}

// --- Endpoints Autentikasi ---

export async function registerUser(payload: RegisterPayload): Promise<void> {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: payload.username,
      nama: payload.nama,
      email: payload.email,
      password: payload.password,
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    let message = 'Gagal melakukan pendaftaran akun.';

    switch (response.status) {
      case 409:
        message = 'Nama pengguna (username) atau alamat email sudah terdaftar.';
        break;
      case 422:
        message = parseDetailError(
          data?.detail,
          'Input data tidak valid. Pastikan format email sesuai dan kata sandi minimal 12 karakter.'
        );
        break;
      case 503:
        message = 'Layanan pendaftaran sedang gangguan. Silakan coba beberapa saat lagi.';
        break;
      default:
        message = parseDetailError(data?.detail, message);
    }

    throw new ApiError(response.status, message);
  }
}

export async function loginUser(payload: LoginPayload): Promise<TokenResponse> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    let message = 'Gagal melakukan otentikasi. Periksa kredensial Anda.';

    switch (response.status) {
      case 401:
        message = 'Nama pengguna (username) atau kata sandi tidak cocok.';
        break;
      case 422:
        message = parseDetailError(data?.detail, 'Format masukan login tidak valid.');
        break;
      case 503:
        message = 'Layanan otentikasi sedang tidak tersedia.';
        break;
      default:
        message = parseDetailError(data?.detail, message);
    }

    throw new ApiError(response.status, message);
  }

  return data as TokenResponse;
}

// --- Endpoints Sample & Job Lifecycle (M8) ---

export async function uploadSample(file: File, token: string): Promise<SampleUploadResponse> {
  const filename = file.name.toLowerCase();
  const isValidFastq = filename.endsWith('.fastq') || filename.endsWith('.fastq.gz');

  if (!isValidFastq) {
    throw new ApiError(422, 'Ekstensi berkas tidak didukung. Harap unggah berkas .fastq atau .fastq.gz.');
  }

  if (file.size > 1_000_000_000) {
    throw new ApiError(413, 'Ukuran berkas melebihi batas maksimum 1 GB.');
  }

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/samples/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const retryAfter = response.headers.get('Retry-After');
    let message = 'Gagal mengunggah berkas sampel.';

    switch (response.status) {
      case 400:
        message = 'Format pengiriman berkas tidak valid atau terpotong.';
        break;
      case 401:
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_info');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login?expired=1';
        }
        message = 'Sesi Anda telah berakhir. Silakan login kembali.';
        break;
      case 413:
        message = 'Ukuran berkas melebihi batas yang diizinkan server (maks. 1 GB).';
        break;
      case 415:
        message = 'Tipe konten harus berupa multipart/form-data.';
        break;
      case 422:
        message = parseDetailError(
          data?.detail,
          'Format berkas FASTQ tidak valid (.fastq / .fastq.gz) atau melampaui batas validasi.'
        );
        break;
      case 503:
        message = retryAfter
          ? `Server sedang memproses pengunggahan lain. Coba lagi dalam ${retryAfter} detik.`
          : 'Layanan pengunggahan sedang tidak tersedia.';
        break;
      default:
        message = parseDetailError(data?.detail, message);
    }

    throw new ApiError(response.status, message, retryAfter);
  }

  return data as SampleUploadResponse;
}

// Di dalam src/services/api.ts pada fungsi createJob
export async function createJob(
  sampleId: number,
  token: string,
  options?: JobCreateOptions
): Promise<JobItem> {
  const rawVcfName = options?.vcf_sample || `sample_${sampleId}`;
  const sanitizedVcfSample = rawVcfName
    .replace(/[^A-Za-z0-9_.-]/g, '_')
    .replace(/^[^A-Za-z0-9]+/, 's_')
    .substring(0, 64) || `sample_${sampleId}`;

  const payload = {
    id_sample: sampleId,
    id_reference_genome: options?.id_reference_genome ?? 1,
    request_id: options?.request_id || generateUUID(),
    vcf_sample: sanitizedVcfSample,
    parameter_qual: options?.min_qual ?? options?.parameter_qual ?? 30.0,
    parameter_dp: options?.min_dp ?? options?.parameter_dp ?? 10,
    require_pass: options?.require_pass ?? true,
    // MENGGUNAKAN PIPELINE BIOINFORMATIKA RIIL
    execution_mode: 'nextflow',
    variant_ploidy: options?.variant_ploidy ?? 2,
  };

  const response = await fetch('/api/jobs', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user_info');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login?expired=1';
      }
    }
    const message = parseDetailError(data?.detail, 'Gagal membuat job analisis baru.');
    throw new ApiError(response.status, message);
  }

  return data as JobItem;
}
// Poin Audit 1: Pemicu Eksekusi Job (Start Pipeline Nextflow/BCFtools)
export async function startJob(jobId: string | number, token: string): Promise<JobItem> {
  const response = await fetch(`/api/jobs/${jobId}/start`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user_info');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login?expired=1';
      }
    }
    const message = parseDetailError(data?.detail, 'Gagal memicu eksekusi pipeline job.');
    throw new ApiError(response.status, message);
  }

  return data as JobItem;
}

// Poin Audit 1: Workflow Utuh (Upload -> Create -> Start)
export async function uploadAndRunSample(
  file: File,
  token: string,
  options?: JobCreateOptions
): Promise<UploadAndRunResponse> {
  // 1. Upload file FASTQ
  const sample = await uploadSample(file, token);

  const targetSampleId = sample.id_sample ?? sample.sample_id ?? sample.id;
  if (!targetSampleId) {
    throw new ApiError(422, 'Gagal mendapatkan ID sampel dari respon pengunggahan berkas.');
  }

  const cleanFileName = file.name.split('.')[0];

  // 2. Buat Job (Status: Queued)
  const job = await createJob(targetSampleId, token, {
    vcf_sample: cleanFileName,
    ...options,
  });

  const jobId = job.id_job ?? job.job_id ?? job.id;
  if (!jobId) {
    throw new ApiError(422, 'Gagal mendapatkan ID job dari respon pembuatan job.');
  }

  // 3. Poin Audit 1 Fix: Panggil /start agar pipeline berjalan di server (Status: Running)
  let startedJob = job;
  try {
    startedJob = await startJob(jobId, token);
  } catch (err) {
    console.warn('Job berhasil dibuat, namun auto-start gagal dipicu:', err);
  }

  return {
    sample,
    job: startedJob,
    id_job: jobId,
    id_sample: targetSampleId,
    status: startedJob.status || job.status,
    submission_status: 'SUCCESS',
  };
}

export async function getJobs(token: string): Promise<JobItem[]> {
  const response = await fetch('/api/jobs', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user_info');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login?expired=1';
      }
    }
    const message = parseDetailError(data?.detail, 'Gagal mengambil daftar job.');
    throw new ApiError(response.status, message);
  }

  return data as JobItem[];
}

// --- Endpoints Result API (M9) ---

export async function getJobResult(jobId: string | number, token: string): Promise<JobResultSummary> {
  const response = await fetch(`/api/jobs/${jobId}/result`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user_info');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login?expired=1';
      }
    }
    const message = parseDetailError(data?.detail, 'Gagal mengambil ringkasan hasil job.');
    throw new ApiError(response.status, message);
  }

  return data as JobResultSummary;
}

// Poin Audit 5: Pembersihan Parameter Query Varian yang Tidak Didukung BE
export async function getJobVariants(
  jobId: string | number,
  params: VariantQueryParams,
  token: string
): Promise<JobVariantsResponse> {
  const query = new URLSearchParams();
  if (params.limit !== undefined) query.append('limit', params.limit.toString());
  if (params.offset !== undefined) query.append('offset', params.offset.toString());
  if (params.variant_type && params.variant_type !== 'ALL') {
    query.append('variant_type', params.variant_type.toLowerCase());
  }
  if (params.min_qual !== undefined) query.append('min_qual', params.min_qual.toString());
  if (params.max_qual !== undefined) query.append('max_qual', params.max_qual.toString());

  // REMOVED: genotype dan search disingkirkan agar tidak menyebabkan HTTP 422 di FastAPI Backend

  const response = await fetch(`/api/jobs/${jobId}/variants?${query.toString()}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user_info');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login?expired=1';
      }
    }
    const message = parseDetailError(data?.detail, 'Gagal mengambil daftar varian.');
    throw new ApiError(response.status, message);
  }

  return data as JobVariantsResponse;
}

// Helper Opsional: Mengunduh Berkas VCF (Poin Audit 7)
export async function downloadJobVcf(jobId: string | number, token: string): Promise<Blob> {
  const response = await fetch(`/api/jobs/${jobId}/vcf`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new ApiError(response.status, 'Berkas VCF tidak ditemukan atau belum selesai diproses.');
  }

  return await response.blob();
}