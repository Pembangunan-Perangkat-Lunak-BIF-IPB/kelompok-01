# Panduan Integrasi Backend GenoPath M7

Panduan untuk Frontend (FE), QA, dan System Analyst (SA), berdasarkan implementasi
M7 di repository. Mulai dari [orientasi](#orientasi), lalu pilih bagian
[quickstart](#quickstart-lokal), [FE](#frontend-react), [QA](#qa-dan-pengujian-aman),
atau [SA](#system-analyst-dan-alur-data). Aturan untuk AI ada di
[bagian terakhir](#bekerja-dengan-ai).

## Orientasi

Backend menyediakan FastAPI, tujuh model SQLAlchemy, migrasi Alembic, login JSON
dengan JWT, serta upload satu FASTQ/FASTQ.gz yang divalidasi dan disimpan bersama
metadata Sample. **HTTP 201 pada upload berarti file dan Sample berhasil disimpan,
bukan analisis varian selesai.** Upload tidak membuat Job atau menjalankan Nextflow.

Belum tersedia API registrasi, refresh token, profil pengguna, daftar/detail Sample,
status Job, hasil analisis, atau download hasil. Tidak ada akun default maupun
database yang otomatis dibuat. Role ada di model User, tetapi RBAC lengkap belum
diimplementasikan. Job runner dan integrasi Nextflow direncanakan pada M8.

| Kebutuhan anggota | Jalur yang digunakan |
| --- | --- |
| Memakai backend siap pakai | Minta base URL, waktu penggunaan, dan akun testing melalui kanal privat kepada operator/BE. Tidak perlu memasang Python atau menyentuh database. |
| Menjalankan backend lokal | Ikuti quickstart berikut setelah operator menyiapkan environment terisolasi dan akun. Instalasi dependency tidak menyiapkan schema atau akun. |
| Demo Swagger terisolasi | Ikuti [prosedur demo](scripts/SWAGGER_DEMO.md), dengan approval per tahap. Helper memakai database testing dan storage privat, bukan konfigurasi Uvicorn biasa. |

Alamat `127.0.0.1` menunjuk mesin tempat browser/command berjalan. Jangan menyalin
alamat loopback operator sebagai alamat server bersama. Minta alamat yang benar;
jangan membuka bind publik atau mematikan server lain untuk mencoba integrasi.

## Quickstart lokal

### Prasyarat

- Python **3.11 atau lebih baru**, modul `venv`, dan pip.
- Linux/WSL untuk alur upload: worker memakai `resource`, `/proc`, directory
  descriptor, dan hard link. Upload pada Windows native belum menjadi target.
- Library sistem `libpq` untuk Psycopg 3 tanpa extra binary. Dependency sistem
  dipasang sesuai distribusi dan approval pengelola mesin.
- Untuk login/upload: PostgreSQL yang disiapkan operator pada revision
  `0002_m7_schema`, privilege yang sesuai, serta User dengan hash Argon2id.
  Repository tidak menetapkan versi minimum server PostgreSQL secara eksplisit.
- Ruang disk pada direktori temporary sistem dan storage privat. Kebutuhan sesaat
  mendekati dua kali ukuran upload. Jangan memakai storage data asli untuk QA.

Jalankan command dari root checkout, yaitu direktori berisi `pyproject.toml`.
Jika `.venv` belum ada, buat sekali; jangan menimpa environment yang masih dipakai:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -e '.[dev]'
```

Command ini mengubah virtual environment, bukan database. Rentang dependency resmi
ada di [pyproject.toml](pyproject.toml); tidak ada langkah instalasi Nextflow untuk M7.

### Konfigurasi privat dan kesiapan environment

Operator menyediakan nilai konfigurasi secara privat, misalnya melalui environment
proses. Variabel harus diekspor agar tersedia bagi proses server, bukan hanya
disimpan sebagai variabel lokal shell. Jangan menaruh nilai secret pada command line, chat, screenshot, source FE,
atau output AI. Jangan mencetak environment atau isi `.env`, dan jangan memakai
shell tracing (`set -x`) saat menangani konfigurasi privat.

| Variabel | Ketentuan |
| --- | --- |
| `DATABASE_URL` | Koneksi PostgreSQL dengan driver `postgresql+psycopg`; target terisolasi diverifikasi operator. Tidak ada default database. |
| `GENOPATH_JWT_SECRET` | Secret acak kriptografis, minimal 32 byte UTF-8, tanpa default. Jangan memakai contoh publik. |
| `GENOPATH_JWT_ALGORITHM` | Hanya `HS256`, sekaligus default. |
| `GENOPATH_ACCESS_TOKEN_EXPIRE_MINUTES` | Default 240 menit; token tidak memiliki refresh flow. |
| `GENOPATH_DEBUG` | Gunakan `false`. |
| `GENOPATH_UPLOAD_ROOT` | Path storage privat yang tidak dipublikasikan; default `data/samples`, relatif terhadap working directory. Untuk QA gunakan root khusus di luar repo. |

Settings biasa juga dapat membaca `.env` jika tersedia. Jangan menjalankan server
dengan konfigurasi yang target databasenya belum diketahui. **Uvicorn biasa tidak
memiliki guard database testing milik helper.** Untuk smoke/demo tim, target yang
diizinkan adalah `genopath_integration_test`; keberadaannya harus dikonfirmasi,
bukan diasumsikan. Jangan menggunakan `genopath_db` untuk fixture atau pengujian.

Untuk database lokal baru, minta operator mengikuti [panduan migrasi](migrations/README.md)
setelah approval. Jangan menjalankan migrasi, `stamp`, atau membuat User hanya
karena mengikuti quickstart. Akun dibuat melalui prosedur yang disetujui, bukan
endpoint registrasi. Contoh username di dokumentasi tidak dapat dipakai login.

### Startup dan health

Setelah operator memverifikasi target dan menyiapkan environment privat, jalankan
di terminal khusus. Pemeriksaan berikut hanya memeriksa keberadaan dua variabel,
bukan membuktikan koneksi, panjang secret, revision, atau permission sudah benar:

```bash
export DATABASE_URL GENOPATH_JWT_SECRET
if [ -z "${DATABASE_URL:-}" ] || [ -z "${GENOPATH_JWT_SECRET:-}" ]; then
  printf '%s\n' 'Minta operator menyiapkan konfigurasi environment privat terlebih dahulu.'
else
  GENOPATH_DEBUG=false .venv/bin/python -B -m uvicorn app.main:app \
    --host 127.0.0.1 --port 8000 --workers 1 --no-access-log
fi
```

Port 8000 adalah contoh untuk instance lokal yang disetujui; jangan menghentikan
proses lain jika port terpakai. Helper demo selalu memakai 8766. Jangan menjalankan
kedua cara startup untuk satu storage/manifest demo.

Buka `http://127.0.0.1:8000/docs`; schema ada di `/openapi.json`. Di terminal lain:

```bash
curl --fail --silent --show-error http://127.0.0.1:8000/health
```

Respons yang diharapkan adalah HTTP 200 dengan `{"status":"ok"}`. Health bersifat
publik dan hanya membuktikan API merespons, **bukan** database, JWT, storage, atau
worker siap. Import/startup tidak membuat tabel atau membuka koneksi database.
Untuk instance lokal biasa, hentikan melalui Ctrl+C pada terminalnya setelah
request selesai. Shutdown dan cleanup helper demo mengikuti panduan demo tersendiri.

## Endpoint M7

Path berikut adalah path backend asli, tanpa prefix `/api`.

| Method dan path | Autentikasi | Request | Sukses | Error yang dipetakan |
| --- | --- | --- | --- | --- |
| `GET /health` | Publik | Tanpa body | 200, `{"status":"ok"}` | Tidak memiliki error bisnis khusus. |
| `POST /auth/login` | Publik | JSON `username`, `password` | 200, `access_token`, `token_type` | 401, 422, 503 |
| `POST /samples/upload` | HTTP Bearer JWT | Multipart, tepat satu file pada field `file` | 201, empat field Sample di bawah | 400, 401, 413, 415, 422, 503 |

Daftar ini tidak menjanjikan bahwa proxy/transport atau bug tak terduga tidak dapat
menghasilkan status lain. Tidak ada security requirement global: login dan health
tetap publik. Route test seperti `/_test/protected` bukan endpoint aplikasi.

### Login JSON

Ambil `username` dan `password` dari form pengguna; kirim JSON dengan dua field
tersebut dan `Content-Type: application/json`. Keduanya wajib string tidak kosong,
field tambahan ditolak. Username dicocokkan **persis**, tanpa trim, perubahan huruf,
atau pencarian email. Jangan mengubah password atau username di client.

Response 200 memuat `access_token` berupa string JWT dan `token_type` bernilai
`bearer`, tanpa objek User atau role. Header respons memakai `Cache-Control: no-store`
dan `Pragma: no-cache`. JWT berisi `sub` berupa string ID User, `iat`, dan `exp`;
masa berlaku default empat jam. Role aktual dibaca backend dari database, bukan
claim JWT. Gunakan hasil login langsung, jangan membuat token sendiri di FE.

### Upload

Kirim `Authorization: Bearer <access_token>` dan FormData dengan satu field `file`.
Jangan kirim `id_user`, jenis read, genom referensi, atau field konfigurasi pipeline.
Pemilik Sample berasal dari User terautentikasi. JWT diperiksa sebelum body dibaca.

- Ekstensi case-sensitive `.fastq` atau `.fastq.gz`, satu file single-end.
- Batas file default **1.000.000.000 byte inklusif**. Untuk gzip, yang dihitung
  adalah ukuran terkompresi; hasil dekompresi dibatasi terpisah, default 4 GiB.
- Struktur FASTQ diperiksa sampai EOF, termasuk integritas gzip. Lolos ekstensi
  saja tidak cukup. Tidak ada QC biologis atau inferensi pairing.
- Batas body adalah batas file + 65.536 byte, total header multipart 16 KiB.
  Filename maksimal 255 byte UTF-8, tanpa path/traversal atau karakter berbahaya.
- Satu upload aktif per proses. Request tambahan mendapat 503 dan `Retry-After: 1`.
  Ini berbeda dari aturan Job per pengguna yang direncanakan pada M8.
- Validasi worker memiliki default CPU 60 detik dan wall-clock 120 detik, khusus
  fase validasi. Durasi total juga mencakup transfer, disk I/O, dan persistence.

Contoh respons 201, dengan metadata sintetis:

```json
{
  "id_sample": 42,
  "nama_berkas": "reads.fastq.gz",
  "ukuran_berkas": 1234,
  "waktu_unggah": "2030-01-02T03:04:05Z"
}
```

Tidak ada `id_job`, path internal, storage key, atau URL download dalam respons.
Ukuran berupa byte, timestamp server berupa UTC. Batas configurable, parser,
staging, dan aturan retensi dijelaskan lebih rinci di [README](README.md#validasi-fastq-dan-local-storage-checkpoint-4a).

## Frontend React

### Origin dan proxy

Backend saat ini **belum memasang CORS middleware**. Browser tidak otomatis boleh
mengakses backend dari origin FE yang berbeda. Swagger pada origin backend tidak
membuktikan integrasi React lintas origin sudah didukung. Bedanya port/host juga
dapat berarti beda origin, sesuai [penjelasan CORS MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS).

Opsi integrasi adalah satu origin melalui reverse proxy, atau development proxy
di server FE. Penambahan CORS backend harus diputuskan terpisah. Jangan menggunakan
`mode: 'no-cors'`, mematikan keamanan browser, atau menaruh secret backend di bundle FE.

Jika proyek React memakai Vite, gabungkan contoh berikut ke konfigurasi FE yang
sudah ada, sambil mempertahankan plugin React dan opsi lainnya. Ini contoh untuk
backend lokal pada 8000, bukan konfigurasi yang ditambahkan ke repository backend:

```ts
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
```

Browser memanggil `/api/auth/login` pada origin FE; Vite meneruskan ke
`/auth/login` pada backend. Aturan yang sama berlaku untuk `/api/samples/upload`.
Sesuaikan target hanya ke instance yang disetujui dan restart dev server FE setelah
mengubah konfigurasinya. [Proxy Vite](https://vite.dev/config/server-options.html#server-proxy)
hanya berlaku untuk development; hasil build memerlukan routing reverse proxy
yang setara atau keputusan CORS terpisah. Jangan menonaktifkan validasi TLS untuk
server bersama. Di luar loopback lokal, gunakan HTTPS yang disiapkan operator.

### Contoh fetch dan state React

Contoh TypeScript berikut memakai `/api` setelah proxy/routing di atas disiapkan.
Token hanya disimpan dalam state React, tidak ditulis ke storage browser atau log.
Reload/unmount menghilangkan token dan pengguna perlu login lagi. Memori tetap
tidak kebal XSS; hindari menampilkan token, HTML mentah, atau respons login penuh.
`localStorage`/`sessionStorage` dapat dibaca JavaScript dan bukan tempat aman dari
XSS, sebagaimana [panduan OWASP](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html#local-storage).
Backend ini tidak menyediakan auth cookie HttpOnly atau refresh flow.

```ts
import { useState } from 'react';

type TokenResponse = { access_token: string; token_type: 'bearer' };
type SampleResponse = {
  id_sample: number; nama_berkas: string;
  ukuran_berkas: number; waktu_unggah: string;
};

class ApiError extends Error {
  constructor(public status: number, message: string, public retryAfter: string | null) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch('/api' + path, { ...init, cache: 'no-store' });
  } catch {
    throw new Error('Jaringan/CORS gagal. Untuk upload, pastikan hasilnya sebelum mencoba ulang.');
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof body?.detail === 'string' ? body.detail
      : Array.isArray(body?.detail) ? 'Request tidak valid.' : 'HTTP ' + response.status;
    throw new ApiError(response.status, message, response.headers.get('Retry-After'));
  }
  if (!body || typeof body !== 'object') throw new Error('Respons tidak sesuai kontrak.');
  return body as T;
}

export function useGenoPath() {
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [sample, setSample] = useState<SampleResponse | null>(null);

  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setMessage('Menunggu server, termasuk validasi jika mengunggah file...');
    try { await action(); }
    catch (error) {
      if (error instanceof ApiError && error.status === 401) setToken(null);
      setMessage(error instanceof Error ? error.message : 'Permintaan gagal.');
    } finally { setBusy(false); }
  }

  async function login(username: string, password: string) {
    setToken(null);
    setSample(null);
    await perform(async () => {
      const result = await request<TokenResponse>('/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      setToken(result.access_token);
      setMessage('Login berhasil.');
    });
  }

  async function upload(file: File) {
    setSample(null);
    await perform(async () => {
      if (!token) throw new Error('Login terlebih dahulu.');
      if (file.size > 1_000_000_000) throw new Error('Berkas melebihi 1 GB desimal.');
      const form = new FormData();
      form.append('file', file);
      const result = await request<SampleResponse>('/samples/upload', {
        method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: form,
      });
      setSample(result);
      setMessage('Sample tersimpan; analisis varian belum dijalankan.');
    });
  }

  function clearSession() { setToken(null); setSample(null); setMessage('Sesi lokal dihapus.'); }
  return { login, upload, clearSession, busy, message, sample, isAuthenticated: token !== null };
}
```

Panggil hook sekali pada komponen pemilik sesi dan bagikan melalui props/context
jika perlu. Form login memanggil `event.preventDefault()` lalu `login(username,
password)`; kosongkan input password setelah percobaan. File diperoleh dari
`input.files?.[0]`, dengan `type="file"` dan `accept=".fastq,.fastq.gz"`. Setelah
dipilih, panggil `upload(file)` dari aksi submit pengguna, bukan effect otomatis.
Nonaktifkan tombol login/upload selama `busy`, tampilkan `message` sebagai teks
React, dan tampilkan metadata dari `sample` hanya setelah sukses.

Filter file/ukuran di client hanya bantuan UI, bukan pengganti validasi backend.
Jangan menetapkan `Content-Type` multipart sendiri: browser harus menambahkan
boundary, sesuai [panduan FormData MDN](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest_API/Using_FormData_Objects).
Contoh ini tidak membuat persentase upload atau status Job. Tetap tampilkan loading
sampai respons diterima; transfer selesai belum berarti validasi/commit selesai.
`clearSession()` hanya menghapus token lokal, bukan memanggil endpoint logout atau
mencabut token yang sudah diterbitkan. Pada 401, login kembali; jangan membuat refresh
flow sendiri. Tidak ada retry otomatis, termasuk untuk 503 atau network error.

## QA dan pengujian aman

### Jenis pengujian

| Jenis | Penggunaan dan batas keselamatan |
| --- | --- |
| Unit/integration-style offline | Mock Session, dependency overrides, `tmp_path`, fixture kecil, dan fault injection. Tidak mengakses PostgreSQL nyata. |
| Automated regression | Default pytest menjalankan seluruh suite di `tests/`, termasuk worker lokal dan test helper dengan koneksi/server dimock. Tidak menjalankan CLI smoke/demo nyata. |
| PostgreSQL integration smoke | [Runner manual](scripts/manual_upload_postgres_smoke.py): `--preflight` memakai transaksi read-only; `--run` membuat User/Sample/file lalu cleanup spesifik. Keduanya butuh approval sesuai tahap; target tetap `genopath_integration_test`. |
| Swagger manual demo | [Prosedur operator](scripts/SWAGGER_DEMO.md): server 8766, akun sementara, storage privat, manifest, verifikasi dan cleanup. Upload manual memang menulis database testing. |

Command regression berikut dijalankan dari root repo dengan dev dependencies yang
sudah tersedia. Environment diwariskan secara minimal dan plugin eksternal tidak
dimuat otomatis; isolasi juga bergantung pada fixture, bukan `env -i` saja:

```bash
env -i PATH=/usr/bin:/bin PYTHONDONTWRITEBYTECODE=1 PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 \
  .venv/bin/python -B -m pytest -q -p no:cacheprovider
```

Jika sandbox macet atau memerlukan akses tambahan, hentikan penarikan kesimpulan
hasil test dan minta approval untuk command yang diaudit. Jangan menganggap timeout
sebagai PASS. Hasil passed/failed/skipped/warnings dicatat dari output run aktual.

### FASTQ dummy kecil

Setelah approval pembuatan fixture, jalankan contoh berikut. `mktemp` memberi
direktori unik di temporary sistem; jangan mengganti output dengan storage aplikasi:

```bash
QA_FIXTURE_DIR="$(mktemp -d)"
.venv/bin/python -B scripts/generate_dummy_fastq.py \
  --output "$QA_FIXTURE_DIR/reads.fastq" --reads 10 --read-length 150 --seed 42
gzip -c -- "$QA_FIXTURE_DIR/reads.fastq" > "$QA_FIXTURE_DIR/reads.fastq.gz"
```

Fixture ini sintetis, bukan bahan validasi biologis. Catat path untuk pemilihan
file di Swagger/FE dan cleanup spesifik setelah selesai. Generator menolak overwrite;
jangan memakai default output-nya yang menuju `data/samples/dummy.fastq`.
Tidak perlu membuat file 1 GB. Uji `limit-1`, `limit`, dan `limit+1` memakai limit
kecil yang di-inject pada automated tests. Jika memakai instance manual berlimit
kecil, minta approval terpisah dan beri label konfigurasi testing.

### Matriks minimum

Status berikut mengasumsikan environment siap, kecuali skenario failure layanan.
Skenario upload selain pengujian autentikasi memakai JWT valid.
Skenario internal/fault injection dilakukan dengan mock, bukan merusak database nyata.

| Skenario | Expected | Cara aman |
| --- | --- | --- |
| Login dengan username persis dan password benar | 200, token Bearer; tanpa password/hash | Akun testing yang disetujui atau mock |
| Username tidak ada, beda kapitalisasi, email sebagai username, password salah, hash rusak | 401 generik | Mock untuk hash rusak; jangan mengubah akun nyata |
| JSON kosong/rusak, field hilang/tambahan, tipe salah, form-urlencoded untuk login | 422 tersanitasi | Automated tests atau akun/environment testing |
| Konfigurasi auth tidak tersedia dengan kredensial valid, database gagal | 503 | Fault injection dengan mock |
| FASTQ dan FASTQ.gz valid | 201, pemilik/metadata benar dan file ada | Mock/tmp_path atau smoke testing setelah approval |
| JWT hilang, malformed, expired, signature salah, atau User sudah hilang | 401, `WWW-Authenticate: Bearer` | Token sintetis/mock; jangan hapus User orang lain |
| Token invalid dengan body besar | 401 sebelum body dibaca | ASGI receive spy di automated tests, bukan file 1 GB |
| `.txt`, filename berbahaya, FASTQ kosong/rusak, gzip rusak | 422 | File kecil pada environment testing |
| Field/file tambahan, field bukan `file`, atau tanpa file | 422 | Multipart terstruktur pada environment testing |
| Content-Type bukan multipart | 415 | Environment testing |
| Multipart terpotong/boundary rusak, Content-Length tidak sesuai | 400 | Automated ASGI tests; transport dapat menolak lebih awal |
| File/body/header/dekompresi/baris melebihi batas | 413; tepat limit diterima jika struktur valid | Limit kecil di automated tests |
| Validasi melewati budget CPU/waktu | 422 | Worker fault injection, tidak membuat gzip bomb besar |
| Upload kedua saat slot proses terpakai | 503 dan `Retry-After: 1` | Automated concurrency test |
| Flush/finalize gagal sebelum commit | 503 untuk kegagalan layanan yang dikenali; cleanup file milik context | Mock; periksa rollback dan tidak ada commit |
| Commit gagal dengan hasil ambigu | 503 untuk error layanan yang dikenali; file dipertahankan | Mock; rollback bukan bukti commit tidak terjadi |
| Cancellation/disconnect | 400 bila parser menangkap disconnect; client yang terputus mungkin tidak menerima respons | Automated tests; setelah commit dimulai, file/row mungkin tetap tersimpan |

Rujukan: [test auth](tests/test_auth.py), [HTTP upload](tests/test_upload_http.py),
[storage](tests/test_upload_storage.py), [persistence](tests/test_sample_persistence.py),
dan [helper demo](tests/test_manual_swagger_demo.py). Jangan memutus PostgreSQL,
menghapus data, atau menambahkan User ke `genopath_db` untuk mereproduksi failure.
Test nyata hanya memakai database testing yang diverifikasi dan storage milik run.
Jika commit ambigu, ownership mismatch, atau manifest rusak, hentikan cleanup
otomatis dan minta rekonsiliasi. Jangan memakai TRUNCATE, DROP, reset, atau delete massal.

## System Analyst dan alur data

Model dan migrasi M7 sudah mendefinisikan tujuh entitas. Keberadaan tabel/ORM
tidak berarti endpoint atau pemrosesan semua entitas sudah tersedia.

| Relasi | Arti pada model |
| --- | --- |
| User 1:N Sample | Setiap Sample memiliki satu pemilik melalui `sample.id_user`. |
| User 1:N Job; Sample 1:N Job | Job merujuk satu User dan satu Sample. M7 belum membuat Job lewat API. |
| ReferenceGenome 1:N Job | Job merujuk satu genom referensi; M7 belum menyediakan API pemilihannya. |
| Job 0..1 Analysis | `analysis.id_job` wajib dan unik. Setiap Analysis punya satu Job; Job belum tentu punya Analysis. |
| Analysis 1:N Variant | Variant terikat pada satu Analysis. |
| Variant 1:N Genotype; Sample 1:N Genotype | Genotype menghubungkan Variant dengan Sample; tidak ada constraint pasangan unik tambahan pada model saat ini. |

Alur M7: JWT diverifikasi, User diambil, ID pemilik disalin, Session baca ditutup;
multipart diterima dan dibatasi; file distaging dan divalidasi worker; Session tulis
dibuat; Sample di-flush; file difinalisasi dan dipertahankan untuk rekonsiliasi;
commit dicoba; respons 201 dikirim jika berhasil. Tidak ada transaksi database
yang ditahan selama transfer/validasi. File memakai key relatif buatan server;
nama asli hanya metadata. Database menyimpan waktu UTC tanpa timezone, respons
memakai UTC dengan `Z`.

| Kebutuhan | Posisi implementasi |
| --- | --- |
| Login JWT, upload satu FASTQ, validasi struktur, file lokal dan Sample | Tersedia pada M7. Role diambil dari database; belum ada RBAC lengkap. |
| Upload langsung membuat Job, referensi/filter analisis, antrean/status Job | Rancangan M8, bukan efek upload 201 saat ini. |
| Nextflow, QC biologis, alignment, variant calling, hasil Analysis/Variant/Genotype dan download | Belum tersedia; pekerjaan pipeline/integrasi berikutnya, termasuk M8. |
| Maksimal satu Job aktif per pengguna | Business rule rancangan Job Manager; belum diimplementasikan. Bukan batas satu upload per proses. |

Validasi API menegakkan filename, struktur, ukuran dan resource upload. Database
menegakkan PK, FK, nullability dan uniqueness yang ditulis dalam migrasi, seperti
username/email serta `analysis.id_job`. Kolom ukuran bertipe BIGINT, tetapi tidak
memiliki SQL CHECK batas 1 GB. Nilai status Job masih String, bukan enum/CHECK;
catatan aturan QUAL/DP/genotype pada rancangan ERD juga bukan otomatis constraint SQL.
Jangan menyimpulkan enforcement hanya dari label pada dokumen desain.

Sebagian SKPL, termasuk AC-01 tentang upload yang membuat Job, dan rancangan LKP4
menggambarkan sistem penuh. Untuk acceptance M7, gunakan pemetaan di atas, bukan
menganggap pipeline sudah tersedia. PDF lokal dalam `docs/` tidak ikut Git;
SA membagikan versi requirement yang disetujui melalui kanal tim jika diperlukan.
Rujukan implementasi: [models](app/models.py), [migrasi M7](migrations/versions/0002_m7_schema.py),
dan [service persistence](app/services/samples.py).

## Troubleshooting dan keamanan

Error HTTP aplikasi memakai JSON. Contoh autentikasi gagal:

```json
{"detail":"Could not authenticate."}
```

Validasi body login memiliki bentuk berbeda, tanpa memantulkan input:

```json
{"detail":[{"loc":["body"],"msg":"Invalid request.","type":"request_validation_error"}]}
```

| Status | Detail aktual dan tindakan |
| --- | --- |
| 400 | `Malformed or incomplete upload request.` Periksa multipart, closing boundary, Content-Length, atau koneksi. |
| 401 | `Could not authenticate.` dengan `WWW-Authenticate: Bearer`. Periksa akun/token, lalu login kembali; bukan alasan membuat akun otomatis. |
| 413 | `Upload resource limit exceeded.` Periksa seluruh batas; file kecil juga dapat melampaui batas dekompresi atau baris. |
| 415 | `Expected multipart/form-data.` Gunakan FormData dengan boundary dari browser. |
| 422 login | Array detail generik di atas. Periksa JSON, field, dan tipe tanpa mencetak password. |
| 422 upload | `Invalid upload or validation budget exceeded.` Periksa field/filename, struktur FASTQ/gzip dan budget. Bukan diagnosis QC biologis. |
| 503 | `Service unavailable.` untuk kegagalan auth/database yang dikenali; `Upload service unavailable.` untuk storage/worker; atau `Upload capacity unavailable.` dengan `Retry-After: 1` untuk slot penuh. |

Client harus menerima `detail` berupa string **atau** array dan menangani respons
non-JSON dari proxy. M7 tidak memakai 403 untuk kredensial/token salah; kondisi
tersebut memakai 401. Network/CORS error mungkin tidak memberikan status HTTP yang
bisa dibaca JavaScript. Periksa URL/proxy dan minta operator memeriksa environment
tanpa membagikan secret. Health 200 tetap tidak membuktikan login/upload siap.

**Jangan retry upload secara otomatis** hanya karena 503, timeout, pembatalan, atau
respons hilang. Commit bisa berhasil saat client sudah pergi; belum ada idempotency
key dan retry dapat membuat Sample duplikat. Operator harus memastikan hasil
melalui prosedur yang disetujui. Belum ada API daftar Sample untuk mengeceknya dari FE.
Rekonsiliasi dan cleanup aman dijelaskan di [README](README.md#upload-fastq-dan-metadata-sample-checkpoint-4b-2)
dan [prosedur demo](scripts/SWAGGER_DEMO.md#kegagalan-pemadaman-dan-rekonsiliasi).

Jangan membagikan file `.env`, password, hash, JWT, JWT secret, connection string,
atau header Authorization. Jangan meletakkan secret pada variabel publik FE seperti
`VITE_*`. Screenshot login/Authorize harus menyembunyikan editor password, token,
headers, dan contoh curl. Jangan mencatat request/response sensitif di console.

## Bekerja dengan AI

Berikan konteks seperlunya, berupa file source/dokumentasi yang sudah aman:

- Semua peran: panduan ini, [README](README.md), serta milestone dan versi source
  yang sedang digunakan. Rancangan masa depan bukan kontrak API aktif.
- FE: [routes auth](app/api/routes/auth.py), [routes samples](app/api/routes/samples.py),
  [schema auth](app/schemas/auth.py), [schema Sample](app/schemas/sample.py),
  [handler error](app/api/errors.py), dan tests auth/HTTP upload.
- QA: file tests yang dirujuk di matriks, konfigurasi pytest di `pyproject.toml`,
  runner smoke, dan panduan Swagger. Jangan memberikan manifest runtime tanpa
  peninjauan kebutuhan dan sanitasi terlebih dahulu.
- SA: `app/models.py`, source migrasi, serta requirement tim yang versinya jelas.
  `docs/` lokal tidak otomatis tersedia bagi AI anggota lain.

Minta AI memeriksa route/tests sebelum menyimpulkan endpoint atau error. Jangan
menambahkan Job, RBAC, registrasi, atau CORS hanya untuk membuat contoh berjalan.
Jika ada perbedaan requirement dan implementasi, catat gap dan minta keputusan tim.
Jangan meminta pengguna menampilkan konfigurasi privat. Command instalasi, migrasi,
seed akun, smoke `--run`, server demo, dan cleanup bukan izin eksekusi otomatis.
Minta approval sesuai tahap dan pastikan target terisolasi sebelum operasi nyata.
AI harus melaporkan pemeriksaan yang benar-benar dilakukan, bukan mengklaim test
atau integrasi lulus hanya karena contoh command tersedia.
