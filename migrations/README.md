# Migrasi database GenoPath

Migrasi menargetkan schema `public` pada PostgreSQL. Metadata berasal dari
`app.models` dan menggunakan Base yang sama dengan aplikasi. URL koneksi hanya
dibaca dari `Settings` melalui `DATABASE_URL` saat perintah online dijalankan.
Gunakan driver `postgresql+psycopg://`; jangan menaruh URL pada `alembic.ini`.
Mode offline tidak membaca `.env` dan tidak membuat koneksi.

## Revision

- `0001_m6_baseline`: membuat `user`, `reference_genome`, dan `sample` pada
  database baru, termasuk primary key bersequence, foreign key Sample, dan
  indeks M6. Email hanya menggunakan unique index `ix_user_email`.
- `0002_m7_schema`: menambahkan `user.username` yang NOT NULL dan UNIQUE,
  kemudian membuat `job`, `analysis`, `variant`, dan `genotype`.

Revision ditulis eksplisit, tidak dibuat dengan autogenerate terhadap database
development. Indeks primary key tambahan yang sudah ada tidak dihapus.
Downgrade otomatis kedua revision ditolak agar tidak menghapus tabel M6 maupun
data username dan analisis. Rollback memerlukan rencana yang ditinjau terpisah.

## Pemeriksaan sebelum stamp atau upgrade

Audit jumlah kolom dan baris saja belum membuktikan kecocokan baseline.
Periksa kembali secara read-only:

- Schema default dan `search_path` mengarah ke `public`; pastikan database tujuan.
- Nama, tipe, panjang, nullability, dan default setiap kolom M6 sesuai baseline.
  `sample.ukuran_berkas` harus BIGINT dan `waktu_unggah` TIMESTAMP WITHOUT TIME ZONE.
- Primary key, sequence, kepemilikan sequence, serta default `nextval` atau
  identity yang digunakan. Baseline database baru menggunakan perilaku SERIAL
  dari primary key Integer, bukan mendefinisikan identity baru.
- Target foreign key `sample.id_user`, aturan update/delete, dan deferrability.
- Definisi `ix_user_email`: unique, valid, non-partial, dan hanya pada kolom email.
  Inventarisasi nama serta definisi indeks tambahan tanpa menghapusnya.
- Tidak ada kolom username, tabel M7, atau riwayat Alembic yang sudah dibuat
  melalui jalur lain. Catat constraint, trigger, dan perubahan manual tambahan.
- Jumlah baris terkini dan izin DDL. Jangan memakai hasil audit lama sebagai
  jaminan bahwa User tetap kosong.

Jika ada perbedaan, hentikan proses dan tinjau baseline atau rencana rekonsiliasi
terlebih dahulu. Jangan melakukan stamp untuk menutupi schema yang tidak cocok.

## Username dan transaksi

Revision M7 mengunci tabel User sebelum memeriksa keberadaan baris, lalu menolak
migrasi jika ditemukan satu baris pun. Tidak ada username default atau pengisian
otomatis. Jika sudah ada pengguna, diperlukan rencana backfill eksplisit yang
disetujui sebelum migrasi ini dapat digunakan.

Lock `ACCESS EXCLUSIVE` menahan akses bersamaan selama transaksi. Jadwalkan
maintenance dan hentikan penulisan aplikasi saat penerapan. PostgreSQL menjalankan
DDL dalam transaksi melalui Alembic; perilaku lock, rollback, dan sequence tetap
harus diuji pada PostgreSQL terisolasi sebelum penerapan development.

## Perintah setelah mendapat persetujuan

Jalankan dari root repository. Instalasi berikut mengubah virtual environment:

```bash
.venv/bin/python -m pip install -e '.[dev]'
```

Pemeriksaan lokal yang tidak menghubungi database:

```bash
.venv/bin/python -B -m alembic history
.venv/bin/python -B -m alembic upgrade head --sql
.venv/bin/python -B -m alembic upgrade 0001_m6_baseline:head --sql
```

`--sql` hanya menghasilkan SQL. Jangan menyalurkan hasilnya ke PostgreSQL tanpa
persetujuan. Upgrade offline tanpa rentang dimulai dari baseline, sehingga hasilnya
tidak boleh diterapkan langsung pada database M6 existing.

Untuk database baru yang sudah disiapkan dan masih kosong, setelah disetujui:

```bash
.venv/bin/python -B -m alembic upgrade head
```

Untuk database M6 existing yang telah diverifikasi cocok, setelah disetujui:

```bash
.venv/bin/python -B -m alembic stamp 0001_m6_baseline
.venv/bin/python -B -m alembic upgrade head
```

Stamp menulis riwayat Alembic tanpa membuat tabel M6. Upgrade berikutnya menerapkan
revision M7. Jangan menggunakan `stamp head` karena akan mencatat M7 sebagai selesai
tanpa menerapkan perubahan schema. Perintah online menggunakan konfigurasi koneksi
aktif, sehingga database tujuan harus selalu diverifikasi sebelum eksekusi.
