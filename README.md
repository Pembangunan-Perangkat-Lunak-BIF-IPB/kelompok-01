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
`InvalidAccessTokenError` menandakan token ditolak. Keduanya belum dipetakan ke
HTTP pada tahap ini. Endpoint login JSON dan dependency `get_current_user`
belum dibuat. Unit tests menggunakan key sementara dan waktu terkontrol,
tanpa membaca `.env` atau membutuhkan PostgreSQL.
