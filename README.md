# GenoPath - Kelompok 1

Repository untuk platform web variant calling berbasis FastAPI dan PostgreSQL.

## Skema Basis Data (PostgreSQL)

Baseline M6 mencakup tiga tabel yang dipetakan melalui SQLAlchemy:

1. **`user`**
   - Atribut: `id_user`, `nama`, `email`, `password_hash`, `role`
   - Keterangan: Mengelola informasi akun dan peran pengguna dalam sistem.

2. **`reference_genome`**
   - Atribut: `id_reference_genome`, `nama_genom`, `versi`, `sumber`, `path_fasta`
   - Keterangan: Menyimpan metadata dan lokasi berkas FASTA untuk genom referensi.

3. **`sample`**
   - Atribut: `id_sample`, `id_user`, `nama_berkas`, `path_penyimpanan`, `ukuran_berkas`, `waktu_unggah`
   - Keterangan: Menyimpan metadata berkas sekuens (FASTQ) yang diunggah pengguna.

ORM M7 menambahkan `user.username` serta entitas `job`, `analysis`, `variant`,
dan `genotype`. Perubahan ORM baru berlaku pada database setelah migrasi diterapkan.

## Konfigurasi Database dan Pengujian

Backend menggunakan Psycopg 3. Konfigurasi database tetap bernama `DATABASE_URL`
dan dapat diberikan melalui environment atau `.env`. Gunakan skema URL
`postgresql+psycopg://` diikuti kredensial, host, port, dan nama database milik
environment masing-masing. Jangan menyimpan kredensial di source code atau Git.
Psycopg tanpa extra `binary` memerlukan library sistem `libpq`.

Impor aplikasi, pemanggilan `create_app()`, dan akses `/health` tidak membuat tabel atau membuka
koneksi database. Engine baru disiapkan ketika dependency database digunakan.
Pembuatan dan perubahan skema dikelola secara eksplisit melalui Alembic.
Lihat [panduan migrasi](migrations/README.md) untuk membedakan database baru dan
database M6 existing. Menambahkan source migrasi tidak mengubah PostgreSQL secara otomatis.

Untuk menyiapkan dependency pengembangan, jalankan dari root repository:

```bash
.venv/bin/python -m pip install -e '.[dev]'
.venv/bin/python -B -m pytest -p no:cacheprovider
```

Perintah instalasi mengubah virtual environment. Pengujian menggunakan konfigurasi
tanpa `.env` dan tidak membutuhkan PostgreSQL. Endpoint yang menggunakan database
dapat diuji dengan `application.dependency_overrides[get_db]` atau override
`get_session_factory` untuk menyediakan session testing yang terisolasi.

## Fondasi keamanan autentikasi (Checkpoint 3B.1)

`app/core/security.py` menyediakan `hash_password`, `verify_password`,
`create_access_token`, dan `decode_access_token`. Hash password menggunakan
Argon2id melalui `pwdlib[argon2]`, dengan salt acak yang dibuat library.
Verifikasi mengembalikan `False` untuk password salah atau hash rusak/tidak
didukung. Hash selain Argon2id tidak diterima dan tidak diubah otomatis.

Konfigurasi JWT mengikuti prefix Settings existing:

| Environment variable | Ketentuan |
| --- | --- |
| `GENOPATH_JWT_SECRET` | Wajib saat operasi JWT; tidak memiliki default; minimal 32 byte UTF-8. |
| `GENOPATH_JWT_ALGORITHM` | Hanya `HS256`, sekaligus nilai default. |
| `GENOPATH_ACCESS_TOKEN_EXPIRE_MINUTES` | Integer positif, default `240` menit. |

Secret harus berasal dari generator acak kriptografis, disediakan melalui
environment, dan tidak disimpan di repository. Batas panjang tidak membuktikan
keacakan secret. Jangan memakai password manusia, placeholder, atau contoh
publik sebagai secret. Secret disimpan sebagai `SecretStr` dan tidak dimasukkan
ke representasi Settings.

Token ditandatangani dengan HS256 melalui PyJWT. Payload yang diterbitkan hanya
berisi `sub` (string ID pengguna positif sesuai PostgreSQL INTEGER), `iat`
(waktu penerbitan), dan `exp` (waktu kedaluwarsa). Waktu menggunakan UTC dalam
detik Unix; `exp - iat` default adalah 14.400 detik. JWT ditandatangani, bukan
dienkripsi, sehingga payload tidak boleh berisi password atau informasi rahasia.
Verifikasi memeriksa signature, algoritma yang diizinkan, claim wajib, tipe dan
urutan waktu, serta format subject. Role tidak dimasukkan ke token.

Secret yang hilang atau terlalu pendek ditolak saat utilitas JWT dipanggil,
sehingga import aplikasi dan `/health` tetap dapat berjalan tanpa secret.
`SecurityConfigurationError` menandakan konfigurasi auth tidak dapat digunakan;
`InvalidAccessTokenError` menandakan token ditolak. Unit tests menggunakan
key sementara dan waktu terkontrol,
tanpa membaca `.env` atau membutuhkan PostgreSQL.

## Login JSON dan autentikasi (Checkpoint 3B.2)

`POST /auth/login` menerima `Content-Type: application/json`:

```json
{"username": "pengguna_contoh", "password": "password-uji-contoh"}
```

Nilai di atas hanya contoh, bukan akun yang dibuat oleh aplikasi. Username
dicocokkan persis dengan `User.username`, tanpa trim, perubahan kapitalisasi,
atau pencarian email. Kedua field wajib berupa string tidak kosong; field
tambahan ditolak. Password request ditampung sebagai `SecretStr`.

Respons sukses (200):

```json
{"access_token": "<JWT-hasil-login>", "token_type": "bearer"}
```

Respons token memakai `Cache-Control: no-store` dan `Pragma: no-cache`.
Login memakai session dari `get_db`, memverifikasi hash Argon2id, lalu menerbitkan
JWT menggunakan Settings milik instance aplikasi. Tidak ada penulisan database.
Username tidak ditemukan tetap menjalankan verifikasi terhadap hash dummy yang
dibuat secara lazy dan disimpan dalam memori proses. Ini mitigasi timing sederhana,
bukan jaminan waktu konstan (terutama pada akses pertama atau hash akun yang rusak).

Endpoint bisnis nantinya memakai `Depends(get_current_user)` dari
`app.api.dependencies`. Client mengirim `Authorization: Bearer <access_token>`.
Token diverifikasi sebelum session database dibuka; setelah itu `User` dicari
berdasarkan ID pada `sub`. Role berasal dari baris User aktual, bukan payload JWT.
Dependency ini mengautentikasi pengguna, belum menetapkan izin atas resource.
Endpoint harus tetap menggunakan response schema eksplisit agar tidak
menserialisasikan ORM User beserta `password_hash` secara langsung.

| Status | Kontrak |
| --- | --- |
| 200 | Login berhasil, `access_token` dan `token_type`. |
| 401 | Kredensial salah, token invalid/expired/hilang, atau User tidak ditemukan. Detail generik `Could not authenticate.` dan `WWW-Authenticate: Bearer`. |
| 422 | Request tidak memenuhi schema/JSON; detail disamarkan agar input tidak dipantulkan kembali. |
| 503 | Konfigurasi auth/database tidak tersedia, error driver DBAPI, atau timeout pool; detail generik `Service unavailable.`. |

Handler 503 hanya menangani kelas exception layanan yang dikenali, bukan seluruh
exception aplikasi. Handler validasi 422 berlaku pada app factory dan tidak
menyertakan input, context, atau pesan exception mentah. Tidak ada logging
kredensial/token atau detail exception layanan pada implementasi ini.

OpenAPI `/openapi.json` dan Swagger `/docs` menyediakan skema HTTP Bearer/JWT.
Masukkan token yang diperoleh dari login JSON ke tombol Authorize. Login dan
`/health` tetap publik; tidak ada security requirement global. Belum ada endpoint
bisnis production, sehingga hanya tests yang menambahkan route terproteksi.
Tidak tersedia registrasi, refresh token, remember-me, atau RBAC.

Tests auth memakai session mock melalui override `get_session_factory`/`get_db`,
key sementara, dan waktu terkontrol. Tests memverifikasi session ditutup pada
sukses/gagal, status HTTP, sanitasi error, dan penolakan token sebelum akses DB.
Pengujian ini belum membuktikan perilaku terhadap PostgreSQL sungguhan; pengujian
integrasi terpisah memerlukan database testing dan persetujuan sebelum penulisan
fixture akun, bukan memakai `genopath_db`.
