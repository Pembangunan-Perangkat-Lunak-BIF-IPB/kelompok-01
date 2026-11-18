# Demo Swagger M7, manual dan terisolasi

Prosedur untuk SS M7 3 (login) dan SS M7 4 (upload). Semua command berikut
memerlukan approval sesuai tahapnya. Dokumentasi ini bukan izin menjalankan demo.
Helper tidak dijalankan oleh default pytest. Tidak ada perubahan aplikasi utama,
endpoint tambahan, migrasi, Job, Nextflow, atau simulasi limit kecil.

## Setup dan preflight

Gunakan WSL/Linux dan `.venv` proyek yang sudah berisi dependency aplikasi serta
dependency development. Jalankan semua command dari root checkout repo GenoPath,
yaitu direktori yang berisi `pyproject.toml`, `app/`, dan `scripts/`. Path checkout
bebas sesuai mesin operator; contoh command memakai path relatif terhadap root
tersebut. Tidak perlu dependency baru untuk helper. Jangan menjalankan Uvicorn
langsung memakai konfigurasi default aplikasi karena guard testing dipasang oleh
helper.

Setiap command helper membaca konfigurasi secara internal melalui Settings normal,
menolak query options URL dan override `PG*`, lalu membuat parameter koneksi baru
dengan target tetap `genopath_integration_test`. URL asal tidak dipakai membuka
koneksi. Nilai konfigurasi tidak dicetak. Jangan cat `.env`, menaruh credentials
di argumen CLI, menyalakan SQL echo, debug logging, atau shell tracing.

Preflight dan pemeriksaan port, setelah approval read-only:

```bash
env -i PATH=/usr/bin:/bin PYTHONDONTWRITEBYTECODE=1 \
  .venv/bin/python -I -B scripts/manual_upload_postgres_smoke.py --preflight
ss -H -ltn 'sport = :8766'
```

Wajib PASS: database tepat `genopath_integration_test`, revision tepat
`0002_m7_schema`, transaksi READ ONLY, schema/FK dan privilege sesuai. Port 8766
harus kosong. Bila pemeriksaan gagal, berhenti. Jangan memperbaikinya dengan
migrasi, fallback database, atau menghentikan server lain.

## Inisialisasi storage, kemudian akun

State root configurable melalui `--state-root`, dengan default
`~/genopath-demo-state`. Gunakan filesystem persisten WSL/Linux di luar repo.
Contoh variabel berikut berisi path non-sensitif dan diekspansi shell sebelum
`env -i`; jangan mengganti nilai `HOME`:

```bash
DEMO_STATE_ROOT="$HOME/genopath-demo-state"
```

Parent root harus sudah ada. `init` hanya membuat leaf state root bila belum ada,
dengan izin `0700`. Root existing harus milik user aktif dan tepat `0700`; helper
menolak permission yang berbeda tanpa melakukan chmod. Semua komponen path dibuka
tanpa mengikuti symlink, path relatif/traversal dan lokasi di dalam repo ditolak.
Gunakan `--state-root "$DEMO_STATE_ROOT"` yang sama untuk seluruh command run.

Setelah approval pembuatan storage/manifest:

```bash
env -i PATH=/usr/bin:/bin PYTHONDONTWRITEBYTECODE=1 \
  .venv/bin/python -I -B scripts/manual_swagger_demo.py init --state-root "$DEMO_STATE_ROOT"
```

`init` menjalankan preflight read-only lalu membuat direktori baru
`$DEMO_STATE_ROOT/genopath-swagger-<uuid>/storage`. State root, run root, dan storage
berizin `0700`, manifest/lock
`0600`. Nama root unik, inode/pemilik diverifikasi, symlink dan reuse direktori
ditolak. Tidak ada akun atau fixture FASTQ yang dibuat oleh `init`.
Manifest, directory run, dan entri parent di-fsync sebelum init dinyatakan berhasil.
Nama root UUID dan inode tetap mengikat setiap manifest ke run miliknya.

Catat path manifest dari output. Isi variabel berikut dengan path aktual tersebut;
contoh placeholder ini harus diganti sebelum command berikutnya:

```bash
DEMO_MANIFEST="$DEMO_STATE_ROOT/genopath-swagger-REPLACE_WITH_RUN_ID/manifest.jsonl"
```

Setelah approval operasi tulis database, buat satu akun sebelum server berjalan:

```bash
env -i PATH=/usr/bin:/bin PYTHONDONTWRITEBYTECODE=1 \
  .venv/bin/python -I -B scripts/manual_swagger_demo.py create-user \
  --state-root "$DEMO_STATE_ROOT" --manifest "$DEMO_MANIFEST"
```

Username/email unik berdasarkan run UUID; role selalu `user`. Password dummy
dimasukkan dua kali melalui prompt terminal privat tanpa echo. Non-TTY dan
fallback echo ditolak. Jangan masukkan kredensial asli atau mengirim password
melalui chat, pipe, environment, maupun command line. Username boleh dicatat.
Password tidak dicetak; hash hanya disimpan di User database testing. Manifest
tidak menyimpan password, hash password, JWT, JWT secret, atau connection string.

## Startup server demo

Setelah approval startup, gunakan terminal khusus yang tetap terbuka:

```bash
env -i PATH=/usr/bin:/bin PYTHONDONTWRITEBYTECODE=1 \
  .venv/bin/python -I -B scripts/manual_swagger_demo.py serve \
  --state-root "$DEMO_STATE_ROOT" --manifest "$DEMO_MANIFEST"
```

Server selalu memakai `127.0.0.1:8766`, satu worker, tanpa reload, `debug=False`,
tanpa access log. JWT HS256 memakai secret acak sementara hanya dalam memori;
restart membuat token sebelumnya tidak berlaku. Batas file tetap 1.000.000.000
byte. Storage selalu root privat milik manifest, bukan `data/samples`.

App factory memakai source terbaru. Import global app dinetralkan dari konfigurasi
default; Settings demo memiliki `database_url=None`. Auth dan persistensi Sample
memakai factory testing yang sama, dengan Session terpisah sesuai aplikasi.
Koneksi dicek read-only sebelum diizinkan menulis; database/revision diperiksa
lagi sebelum flush/commit. Engine lain, raw connection engine lain, factory
default, serta koneksi native yang tidak sesuai ditolak sebelum koneksi dibuka.
Guard hanya berlaku dalam proses helper. Server lama di 8765 tidak disentuh.

Server memegang lock sepanjang hidupnya; seed dan cleanup ditolak saat lock aktif.
Jangan memakai beberapa helper untuk satu manifest. Setelah restart paksa atau
listrik mati, jangan menganggap lock yang terlepas sebagai bukti shutdown aman.

## Login, Authorize, upload, dan screenshot

1. Buka `http://127.0.0.1:8766/docs` di browser lokal.
2. Pada `POST /auth/login`, isi JSON dengan username demo dan password dummy.
   Execute secara privat. Harapkan HTTP 200 dan `token_type: bearer`.
3. Klik **Authorize**, masukkan access token hasil login ke skema HTTP Bearer,
   lalu tutup dialog. Token hanya dipindahkan secara lokal, tidak ke chat/log.
4. Untuk SS M7 3, screenshot hanya area status 200/kontrak schema yang aman.
   Sembunyikan editor JSON password, response token, serta contoh curl.
5. Pada `POST /samples/upload`, pilih satu FASTQ sintetis kecil pada field `file`.
   Gunakan fixture khusus demo yang sudah disetujui, maksimal 100.000 byte agar
   dapat diverifikasi helper. Jangan membuat file 1 GB atau memakai data sensitif.
6. Execute, harapkan 201 dengan `id_sample`, `nama_berkas`, `ukuran_berkas`, dan
   `waktu_unggah`. Untuk bukti gzip, ulangi dengan `.fastq.gz` valid bila disetujui.
7. Untuk SS M7 4, ambil area file picker/status/metadata respons. Jangan sertakan
   request headers atau curl yang mengandung Authorization.

Swagger standar menampilkan password dalam editor JSON dan token pada response
login. Login/Authorize harus dikerjakan secara privat tanpa screenshot/rekaman.
Jika secrets tidak boleh terlihat di browser sekalipun, hentikan demo Swagger
manual dan review ulang pendekatannya. Jangan mengubah kontrak API untuk screenshot.

Simulasi 413 dengan limit kecil belum disiapkan di helper ini. Pengujian tersebut
memerlukan instance/approval terpisah dan label konfigurasi testing yang jelas.

## Verifikasi Sample dan file

Setelah request selesai, dari terminal lain dan setelah approval verifikasi:

```bash
env -i PATH=/usr/bin:/bin PYTHONDONTWRITEBYTECODE=1 \
  .venv/bin/python -I -B scripts/manual_swagger_demo.py verify \
  --state-root "$DEMO_STATE_ROOT" --manifest "$DEMO_MANIFEST"
```

Query verifikasi database memakai READ ONLY dan rollback. Pemeriksaan membandingkan
User, pemilik Sample, ID, nama, ukuran, timestamp, dan storage key terhadap record
commit di manifest. File diperiksa ownership/mode, inode, ukuran, dan SHA-256,
kemudian divalidasi melalui subprocess existing. Fingerprint dicatat ke manifest.
File tak tercatat, berubah, symlink, atau lebih dari 100.000 byte memblokir proses;
batas verifier ini tidak mengubah batas endpoint 1 GB. Verifier tidak menghapus file.

## Shutdown dan cleanup

1. Selesaikan request, screenshot, dan verifikasi. Logout/bersihkan Authorize lalu
   tutup halaman demo. Tekan Ctrl+C sekali pada terminal helper 8766, tunggu
   `server_stopped`. Jangan menggunakan `pkill`, kill berdasarkan port, atau 8765.
2. Jalankan `verify` lagi jika belum ada fingerprint terbaru.
3. Setelah approval cleanup:

   ```bash
   env -i PATH=/usr/bin:/bin PYTHONDONTWRITEBYTECODE=1 \
     .venv/bin/python -I -B scripts/manual_swagger_demo.py cleanup \
     --state-root "$DEMO_STATE_ROOT" --manifest "$DEMO_MANIFEST"
   ```

Cleanup membutuhkan lifecycle server selesai, tidak ada request/commit yang belum
pasti, semua konfirmasi commit tersedia, dan fingerprint/identitas cocok. User dan
Sample dikunci lalu dihapus memakai ID, pemilik, identitas unik, dan metadata
lengkap. Job/Genotype, storage key bersama, dan FK cascade memblokir cleanup.
Tidak ada DROP, TRUNCATE, migrasi, reset sequence, atau recursive delete.

File baru dihapus setelah commit penghapusan record terkonfirmasi dan query READ
ONLY membuktikan nol record milik run. Inode/hash dicek kembali sebelum unlink
melalui directory descriptor. Report sukses menunjukkan nol User/Sample/file
milik demo. State root/run root/manifest/lock tetap disimpan sebagai audit; cleanup
tidak menghapus direktori persisten atau run lain. File fixture sumber
dan screenshot pengguna tidak dihapus oleh helper.

## Kegagalan, pemadaman, dan rekonsiliasi

Intent dicatat dan di-fsync sebelum COMMIT, konfirmasi sesudah COMMIT kembali
sukses. COMMIT gagal atau proses berhenti di tengahnya meninggalkan intent pending.
Rollback sesudah COMMIT gagal bukan bukti bahwa commit tidak terjadi.

Interupsi request menandai ketidakpastian dalam memori sebelum penulisan manifest.
Kegagalan append/fsync juga menandai instance manifest tidak aman. Shutdown tidak
menulis `server_stopped` bila request aktif, interupsi, penulisan gagal, atau commit
pending terdeteksi. Lifecycle server yang menggantung tetap memblokir cleanup pada
proses berikutnya meskipun lock OS sudah terlepas.

Jika command blocked/interrupted, jangan mengedit manifest, menjalankan ulang seed,
atau memaksa cleanup. Pertahankan artefak dan minta review rekonsiliasi terpisah.
Manifest parsial, request gagal, file tak tercatat, metadata berubah, dan kegagalan
di tengah penghapusan file juga memerlukan review. Jangan hapus record/file lain.

Manifest, lock, storage, dan informasi cleanup sekarang berada di root persisten,
sehingga tidak bergantung pada `/tmp`. Secrets tetap hanya dalam memori; password,
JWT, secret, hash password, dan connection string tidak disimpan sebagai state.
Setelah reboot, lock OS boleh sudah terlepas tetapi lifecycle server/commit pending
di manifest tetap memblokir cleanup otomatis. Jangan menghapus/mengedit lock atau
manifest untuk mengabaikannya. Perubahan device/inode juga memerlukan review.

Filesystem persisten dan fsync bukan pengganti backup. Simpan identitas
run/username/path non-sensitif dalam catatan bukti terpisah. Bila state hilang atau
rusak, pemeriksaan rekonsiliasi harus direncanakan dan disetujui ulang; helper tidak
merekonstruksi kepemilikan atau menghapus berdasarkan prefix saja. Artefak lama di
`/tmp`, jika ditemukan, harus direview terpisah; jangan dipindah/disalin lalu
memaksakan pemeriksaan inode agar lolos.

Filesystem dan PostgreSQL bukan transaksi atomik. Helper memilih mempertahankan
artefak saat ragu, sehingga rekonsiliasi manual tetap mungkin diperlukan.
