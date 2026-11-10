// Public FastAPI DTOs. No storage paths or invented biological defaults.
export interface LoginPayload { username: string; password: string }
export interface RegisterPayload extends LoginPayload { nama: string; email: string }
export interface TokenResponse { access_token: string; token_type: 'bearer' }
export interface SampleUploadResponse {
  id_sample: number; nama_berkas: string; ukuran_berkas: number; waktu_unggah: string;
}
export type JobStatus = 'Queued' | 'Running' | 'Completed' | 'Failed';
export interface JobItem {
  id_job: number; id_sample: number; id_reference_genome: number; status: JobStatus;
  waktu_mulai: string | null; waktu_selesai: string | null; pesan_error: string | null;
  execution_mode: 'synthetic' | 'nextflow' | null; has_result: boolean;
}
export interface ReferenceOption {
  id_reference_genome: number; nama_genom: string; versi: string | null; sumber: string | null;
}
export interface JobOptions {
  pipeline_enabled: boolean; alignment_strategy: string | null; upload_max_bytes: number;
  variant_ploidies: number[]; references: ReferenceOption[];
}
export interface SubmissionParameters {
  request_id: string; id_reference_genome: number; vcf_sample: string;
  parameter_qual: number; parameter_dp: number; require_pass: boolean;
  variant_ploidy: number; execution_mode: 'nextflow'; alignment_strategy: 'bowtie2';
}
export interface SubmissionResponse {
  request_id: string;
  submission_status: 'accepted' | 'replayed' | 'sample_stored' | 'reconciliation_required';
  sample: SampleUploadResponse | null; job: JobItem | null;
  dispatch_scheduled: boolean; detail: string | null;
}
export interface JobResultSummary {
  id_job: number; id_analysis: number; id_sample: number; id_reference_genome: number;
  status: 'Completed'; execution_mode: 'synthetic' | 'nextflow' | null;
  waktu_mulai: string | null; waktu_selesai: string | null;
  counts: { total_variants: number; snps: number; indels: number; other: number; unclassified: number };
  parameters: { parameter_qual: number; parameter_dp: number; require_pass: boolean | null; variant_ploidy: number | null };
  reference?: ReferenceOption | null;
}
export interface VariantItem {
  id_variant: number; chromosome: string; position: number; ref_allele: string; alt_allele: string;
  qual: number | null; variant_type: string | null; filter_status: string | null;
  info: Record<string, string | null> | null;
  genotypes: { id_genotype: number; id_sample: number; genotype_call: string; dp: number | null }[];
}
export type VariantType = 'snp' | 'indel' | 'other' | 'unclassified';
export interface VariantQueryParams {
  limit?: number; offset?: number; variant_type?: VariantType; min_qual?: number; max_qual?: number;
}
export interface JobVariantsResponse {
  id_job: number; id_analysis: number; items: VariantItem[]; total: number; limit: number;
  offset: number; returned: number; has_more: boolean; next_offset: number | null;
  filters: { variant_type: VariantType | null; min_qual: number | null; max_qual: number | null };
}
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
function submissionPayload(value: unknown): SubmissionResponse | null {
  if (!isObject(value) || typeof value.request_id !== 'string' ||
      !['accepted', 'replayed', 'sample_stored', 'reconciliation_required'].includes(String(value.submission_status))) return null;
  return value as unknown as SubmissionResponse;
}
export class ApiError extends Error {
  status: number;
  retryAfter: string | null;
  submission: SubmissionResponse | null;
  constructor(status: number, message: string, retryAfter: string | null = null, submission: SubmissionResponse | null = null) {
    super(message);
    this.name = 'ApiError'; this.status = status; this.retryAfter = retryAfter; this.submission = submission;
  }
}
async function request<T>(path: string, token?: string, init: RequestInit = {}): Promise<T> {
  const submissionRequest = path.startsWith('/samples/upload-and-run?');
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', 'Bearer ' + token);
  let response: Response;
  try { response = await fetch('/api' + path, { ...init, headers, cache: 'no-store' }); }
  catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, submissionRequest
      ? 'Koneksi terputus. Hasil pengiriman belum dapat dipastikan; jangan membuat submission baru.'
      : 'Koneksi ke server terputus. Coba muat ulang.');
  }
  const data: unknown = await response.json().catch(() => null);
  if (response.status === 401 && token) {
    localStorage.removeItem('access_token'); localStorage.removeItem('user_info');
    window.dispatchEvent(new Event('genopath:unauthorized'));
  }
  if (!response.ok) {
    const submission = submissionPayload(data);
    const detail = isObject(data) && typeof data.detail === 'string' ? data.detail : null;
    const fallback: Record<number, string> = {
      401: 'Sesi tidak valid atau telah berakhir. Silakan masuk kembali.',
      404: 'Job atau hasil tidak ditemukan untuk akun ini.',
      409: 'Permintaan belum dapat diproses. Periksa status Job atau submission sebelumnya.',
      413: 'Berkas melebihi batas unggahan server.',
      422: 'Data atau konfigurasi tidak valid. Periksa format FASTQ dan parameter.',
      503: 'Layanan atau konfigurasi pipeline belum tersedia.',
    };
    throw new ApiError(response.status, submission?.detail || detail || fallback[response.status] || 'Permintaan gagal.',
      response.headers.get('Retry-After'), submission);
  }
  if (data === null) throw new ApiError(0, submissionRequest
    ? 'Respons server tidak dapat dibaca. Periksa submission yang sama sebelum mengulang.'
    : 'Respons server tidak dapat dibaca. Coba muat ulang.');
  return data as T;
}
export const registerUser = (payload: RegisterPayload) => request<unknown>('/auth/register', undefined, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
});
export async function loginUser(payload: LoginPayload): Promise<TokenResponse> {
  const result = await request<TokenResponse>('/auth/login', undefined, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  if (typeof result.access_token !== 'string' || !result.access_token || result.token_type !== 'bearer') {
    throw new ApiError(503, 'Respons autentikasi tidak valid.');
  }
  return result;
}
export function validateFile(file: File, maxBytes = 1_000_000_000): void {
  if (!/(?:\.fastq|\.fastq\.gz)$/.test(file.name)) throw new ApiError(422, 'Gunakan ekstensi .fastq atau .fastq.gz (huruf kecil).');
  if (file.size === 0) throw new ApiError(422, 'Berkas FASTQ kosong.');
  if (file.size > maxBytes) throw new ApiError(413, 'Ukuran berkas melebihi batas unggahan.');
}
export function uploadSample(file: File, token: string): Promise<SampleUploadResponse> {
  validateFile(file);
  const body = new FormData(); body.append('file', file);
  return request('/samples/upload', token, { method: 'POST', body });
}
export async function submitAnalysis(file: File, token: string, parameters: SubmissionParameters): Promise<SubmissionResponse> {
  validateFile(file);
  const query = new URLSearchParams(Object.entries(parameters).map(([key, value]) => [key, String(value)]));
  const body = new FormData(); body.append('file', file);
  const result = await request<SubmissionResponse>('/samples/upload-and-run?' + query, token, { method: 'POST', body });
  if (result.request_id !== parameters.request_id || !result.job ||
      !Number.isSafeInteger(result.job.id_job) || result.job.id_job <= 0 ||
      !['Queued', 'Running', 'Completed', 'Failed'].includes(result.job.status) ||
      (result.job.status === 'Queued' && result.dispatch_scheduled !== true) ||
      !['accepted', 'replayed'].includes(result.submission_status)) {
    throw new ApiError(503, 'Submission belum dikonfirmasi. Pertahankan UUID dan konfigurasi yang sama.', null, result);
  }
  return result;
}
export const getJobOptions = (token: string, signal?: AbortSignal) => request<JobOptions>('/jobs/options', token, { signal });
export const getJobs = (token: string, signal?: AbortSignal) => request<JobItem[]>('/jobs', token, { signal });
export const getJob = (id: string | number, token: string, signal?: AbortSignal) => request<JobItem>('/jobs/' + id, token, { signal });
export const getJobResult = (id: string | number, token: string, signal?: AbortSignal) => request<JobResultSummary>('/jobs/' + id + '/result', token, { signal });
export function getJobVariants(id: string | number, params: VariantQueryParams, token: string, signal?: AbortSignal) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined) query.set(key, String(value));
  return request<JobVariantsResponse>('/jobs/' + id + '/variants?' + query, token, { signal });
}

export async function downloadJobResult(id: string | number, format: 'vcf' | 'csv', token: string, filters: VariantQueryParams = {}): Promise<Blob> {
  const query = new URLSearchParams();
  if (format === 'csv') {
    for (const key of ['variant_type', 'min_qual', 'max_qual'] as const) {
      if (filters[key] != null) query.set(key, String(filters[key]));
    }
  }
  let response: Response;
  try {
    response = await fetch('/api/jobs/' + id + '/' + format + (query.size ? '?' + query : ''), {
      headers: { Authorization: 'Bearer ' + token }, cache: 'no-store',
    });
  } catch { throw new ApiError(0, 'Unduhan terputus. Coba kembali setelah koneksi pulih.'); }
  if (response.status === 401) {
    localStorage.removeItem('access_token'); localStorage.removeItem('user_info');
    window.dispatchEvent(new Event('genopath:unauthorized'));
  }
  if (!response.ok) {
    const data: unknown = await response.json().catch(() => null);
    throw new ApiError(response.status, isObject(data) && typeof data.detail === 'string' ? data.detail : 'Unduhan gagal atau hasil belum tersedia.');
  }
  try { return await response.blob(); }
  catch { throw new ApiError(0, 'Unduhan tidak lengkap. Coba kembali.'); }
}
