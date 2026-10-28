export interface LoginPayload {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface SampleUploadResponse {
  id_sample: number;
  nama_berkas: string;
  ukuran_berkas: number;
  waktu_unggah: string;
}

// Perbaikan ApiError agar sesuai aturan erasableSyntaxOnly
export class ApiError extends Error {
  status: number;
  retryAfter: string | null;

  constructor(status: number, message: string, retryAfter: string | null = null) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

// 1. Endpoint Login: POST /auth/login
export async function loginUser(payload: LoginPayload): Promise<TokenResponse> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof data?.detail === 'string'
        ? data.detail
        : 'Gagal melakukan otentikasi. Periksa kredensial Anda.';
    throw new ApiError(response.status, message);
  }

  return data as TokenResponse;
}

// 2. Endpoint Upload FASTQ: POST /samples/upload
export async function uploadSample(file: File, token: string): Promise<SampleUploadResponse> {
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
        message = 'Sesi Anda telah berakhir. Silakan login kembali.';
        break;
      case 413:
        message = 'Ukuran berkas melebihi batas yang diizinkan server (maks. 1 GB).';
        break;
      case 415:
        message = 'Tipe konten harus berupa multipart/form-data.';
        break;
      case 422:
        message = typeof data?.detail === 'string' 
          ? data.detail 
          : 'Format berkas FASTQ tidak valid atau melampaui batas validasi.';
        break;
      case 503:
        message = retryAfter 
          ? `Server sedang memproses pengunggahan lain. Coba lagi dalam ${retryAfter} detik.`
          : 'Layanan pengunggahan sedang tidak tersedia.';
        break;
      default:
        if (typeof data?.detail === 'string') message = data.detail;
    }

    throw new ApiError(response.status, message, retryAfter);
  }

  return data as SampleUploadResponse;
}