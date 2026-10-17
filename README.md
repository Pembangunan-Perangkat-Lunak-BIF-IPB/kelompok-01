# GenoPath - Kelompok 1

Repository untuk platform web variant calling berbasis FastAPI dan PostgreSQL.

## Skema Basis Data (PostgreSQL)

Saat ini model basis data dibangun menggunakan SQLAlchemy dengan 3 entitas utama yang telah diinisialisasi:

1. **`user`**
   - Atribut: `id_user`, `nama`, `email`, `password_hash`, `role`
   - Keterangan: Mengelola informasi akun dan peran pengguna dalam sistem.

2. **`reference_genome`**
   - Atribut: `id_reference_genome`, `nama_genom`, `versi`, `sumber`, `path_fasta`
   - Keterangan: Menyimpan metadata dan lokasi berkas FASTA untuk genom referensi.

3. **`sample`**
   - Atribut: `id_sample`, `id_user`, `nama_berkas`, `path_penyimpanan`, `ukuran_berkas`, `waktu_unggah`
   - Keterangan: Menyimpan metadata berkas sekuens (FASTQ) yang diunggah pengguna.

## Konfigurasi Database dan Pengujian

Backend menggunakan Psycopg 3. Konfigurasi database tetap bernama `DATABASE_URL`
dan dapat diberikan melalui environment atau `.env`. Gunakan skema URL
`postgresql+psycopg://` diikuti kredensial, host, port, dan nama database milik
environment masing-masing. Jangan menyimpan kredensial di source code atau Git.
Psycopg tanpa extra `binary` memerlukan library sistem `libpq`.

Impor aplikasi, pemanggilan `create_app()`, dan akses `/health` tidak membuat tabel atau membuka
koneksi database. Engine baru disiapkan ketika dependency database digunakan.
Pembuatan dan perubahan skema harus dilakukan secara eksplisit; belum tersedia
perintah migrasi pada tahap ini.

Untuk menyiapkan dependency pengembangan, jalankan dari root repository:

```bash
.venv/bin/python -m pip install -e '.[dev]'
.venv/bin/python -B -m pytest -p no:cacheprovider
```

Perintah instalasi mengubah virtual environment. Pengujian menggunakan konfigurasi
tanpa `.env` dan tidak membutuhkan PostgreSQL. Endpoint yang menggunakan database
dapat diuji dengan `application.dependency_overrides[get_db]` atau override
`get_session_factory` untuk menyediakan session testing yang terisolasi.
