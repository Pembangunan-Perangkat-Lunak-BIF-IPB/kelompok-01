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
`/health` tetap publik; tidak ada security requirement global. Endpoint
`/samples/upload` kini memakai dependency autentikasi yang sama.
Tidak tersedia registrasi, refresh token, remember-me, atau RBAC.

Tests auth memakai session mock melalui override `get_session_factory`/`get_db`,
key sementara, dan waktu terkontrol. Tests memverifikasi session ditutup pada
sukses/gagal, status HTTP, sanitasi error, dan penolakan token sebelum akses DB.
Pengujian ini belum membuktikan perilaku terhadap PostgreSQL sungguhan; pengujian
integrasi terpisah memerlukan database testing dan persetujuan sebelum penulisan
fixture akun, bukan memakai `genopath_db`.

## Validasi FASTQ dan local storage (Checkpoint 4A)

`app.services.fastq` memvalidasi filename dan struktur FASTQ secara streaming.
Sequence dan quality boleh multiline; jumlah karakter quality harus sama dengan
sequence. Karakter `@` dan `+` pada quality diproses berdasarkan panjang, bukan
dianggap sebagai awal record. Separator `+` boleh kosong atau mengulangi header
secara persis. Mendukung LF, CRLF, dan quality terakhir tanpa newline.

Parser menerima header ASCII printable yang tidak kosong, serta sequence/quality
ASCII printable tanpa whitespace. Baris kosong, record terpotong, separator salah,
dan perbedaan panjang ditolak. Ini validasi struktur, tanpa pembatasan alfabet
nukleotida, perhitungan kualitas biologis, trimming, atau inferensi single/paired-end.
Kontrak input tetap satu file single-end per pemanggilan layanan. Record dan baris
dibaca sampai EOF, tanpa menggabungkan sequence/quality ke dalam satu buffer.

| Environment variable | Default / ketentuan |
| --- | --- |
| `GENOPATH_UPLOAD_ROOT` | `data/samples`, relatif terhadap working directory aplikasi. |
| `GENOPATH_UPLOAD_MAX_BYTES` | `1000000000`, inklusif; boleh diturunkan, tidak boleh melebihi 1 GB desimal. |
| `GENOPATH_UPLOAD_MAX_DECOMPRESSED_BYTES` | `4294967296` (4 GiB), positif; batas seluruh data hasil dekompresi termasuk newline. |
| `GENOPATH_UPLOAD_CHUNK_BYTES` | `1048576` (1 MiB), positif; batas setiap pembacaan sumber saat penyalinan. |
| `GENOPATH_UPLOAD_MAX_LINE_BYTES` | `1048576` (1 MiB), positif; panjang isi baris tanpa terminator LF/CRLF. |

Settings hanya dibaca oleh pemanggil, lalu diberikan ke `LocalStorage(settings)`.
Layanan tidak membaca `.env` sendiri dan tidak membuat direktori saat import atau
konstruksi. Root default sudah diabaikan Git. Root kustom harus di luar repository
atau diabaikan Git secara eksplisit, dan tidak boleh dipublikasikan oleh web server.

Filename menerima suffix case-sensitive `.fastq` atau `.fastq.gz`, maksimal 255
byte UTF-8. Separator path, drive/ADS colon, karakter kontrol/format, dan whitespace
di awal/akhir ditolak. Filename hanya metadata; nama fisik memakai UUID server.
Upload gzip disimpan tetap terkompresi dan ukuran upload dihitung dari byte
terkompresi. Validasi membuka gzip secara streaming hingga EOF, termasuk CRC dan
trailer. Gzip rusak/truncated dan data melewati batas dekompresi ditolak; tidak ada
file hasil dekompresi yang ditulis ke disk.

`gzip.GzipFile` tidak menyediakan parameter publik untuk membatasi jumlah member
atau panjang header opsional. Banyak member kosong atau header filename/comment
yang panjang dapat menghabiskan CPU tanpa melewati batas hasil dekompresi. Batas
upload terkompresi tetap berlaku, tetapi bukan batas waktu validasi. Tidak ada
parser gzip custom atau klaim proteksi CPU penuh pada pemanggilan langsung API 4A.
Endpoint upload menggunakan subprocess dengan batas CPU/waktu sebagaimana dijelaskan
di bawah. Timeout coroutine saja tidak menghentikan worker sinkron.

API internal sinkron, tanpa endpoint HTTP atau database:

```python
storage = LocalStorage(settings)
with storage.stage(source, "reads.fastq.gz") as upload:
    metadata = upload.metadata  # original_name, storage_key relatif root, size_bytes
    upload.finalize()
    upload.retain()  # Simpan file setelah keluar context, tanpa transaksi eksternal.
```

Untuk integrasi 4B, panggil `upload.preserve_for_reconciliation()` sesudah
`finalize()` dan **sebelum** mencoba commit Sample. Metode tersebut mempertahankan
file meskipun caller kemudian menerima exception, termasuk hasil commit yang
belum pasti. Database dan filesystem tidak atomik. Caller wajib merekonsiliasi
hasil commit dan file secara terpisah; jangan menghapus file hanya karena commit
melempar exception. Proteksi ini sengaja bisa menyisakan orphan bila commit gagal
secara pasti, sampai rekonsiliasi membuktikan file tidak direferensikan.

`source` adalah binary file-like dengan `read(size)`; pemanggil tetap memiliki dan
menutup sumber tersebut. Sebelum context menghasilkan `upload`, seluruh file sudah
disalin dalam chunk terbatas dan divalidasi. Staging memakai file `.part` eksklusif
dengan mode `0600`. Finalisasi memakai hard link dalam direktori yang sama, lalu
melepas nama staging: publikasi file lengkap bersifat atomic dan target existing
tidak pernah ditimpa. Data file dan publikasi direktori di-fsync.
Status finalisasi baru sukses setelah unlink staging dan fsync direktori selesai.
Jika salah satunya gagal, `retain()` dan `preserve_for_reconciliation()` ditolak,
meskipun caller menangkap exception finalisasi.

Context membersihkan file miliknya ketika validasi/copy gagal atau bila keluar
tanpa `retain()`, termasuk jika sudah difinalisasi. Cleanup hanya menyentuh inode
yang dibuat context tersebut. Root dan setiap ancestor dibuka dengan directory
descriptor dan `O_NOFOLLOW`; target file/symlink existing tidak ditimpa. Root harus
dimiliki akun service, tidak writable oleh group/others, dan berada di parent yang
tepercaya. Direktori baru memakai mode `0700`; permission existing tidak diubah.
Setiap entri direktori yang dilewati dipersist melalui `fsync` parent sebelum
melanjutkan ke komponen berikutnya, termasuk entri existing agar retry setelah
setup gagal tetap aman. Kegagalan sinkronisasi menghentikan upload sebelum staging
atau Session tulis Sample dibuat. Direktori kosong yang terlanjur dibuat dapat
tetap ada; proses tidak menghapus direktori tanpa bukti bahwa aman untuk dihapus.
Implementasi ini menargetkan server Linux/POSIX dengan dukungan hard link.

Descriptor tetap dimiliki context saat setup wrapper gagal dan selalu dicoba
ditutup. Bila `fstat()` gagal sesudah pembuatan `.part`, cleanup mencoba memperoleh
identitas dari descriptor yang masih terbuka menggunakan `stat(fd)`. Jika kedua
inspeksi gagal, file tidak dihapus tanpa bukti kepemilikan. Cleanup mencoba tiap
nama miliknya secara independen; kegagalan satu file tidak melewati file lain.
Error utama dipertahankan dengan catatan sanitasi bila cleanup tidak lengkap.
Jika tidak ada error utama, kegagalan cleanup menghasilkan `StorageError`.

`InvalidFilenameError`, `InvalidFastqError`, `UploadLimitError`, dan `StorageError`
merupakan error internal yang dipetakan oleh endpoint ke HTTP 422, 422, 413, dan
503. Error storage tidak menyertakan path atau exception OS mentah. Tidak ada
logging isi file. Proses crash/power loss atau kegagalan cleanup
dapat meninggalkan file yang perlu direkonsiliasi; tidak ada background cleaner.
Filesystem dan database bukan satu transaksi: hasil commit Sample yang ambigu
memerlukan proteksi sebelum commit dan rekonsiliasi agar file yang mungkin sudah
direferensikan tidak langsung dihapus. Root harus tetap eksklusif bagi service;
pemeriksaan inode dan unlink berbasis nama bukan perlindungan terhadap proses
berbahaya yang berjalan dengan UID service yang sama.

Tests memakai `tmp_path`, FASTQ/gzip kecil, dan limit kecil yang di-inject. Tidak
ada fixture 1 GB, akses database sungguhan, atau perubahan storage aplikasi.
Endpoint di bawah mengintegrasikan fondasi ini dari thread yang ditunggu selesai,
sehingga disk I/O, validasi, dan persistence tidak memblokir event loop.

## Upload FASTQ dan metadata Sample (Checkpoint 4B-2)

Scope M7 mencakup upload, validasi struktur FASTQ, penyimpanan file, dan metadata
Sample. Pembuatan Job serta integrasi pipeline Nextflow tetap menjadi scope M8;
endpoint upload tidak menjalankan analisis biologis atau pipeline tersebut.

`POST /samples/upload` membutuhkan JWT HTTP Bearer melalui `get_current_user` dan
menerima tepat satu file pada field `file`, tanpa field teks/tambahan. Swagger
menyediakan file picker melalui schema OpenAPI eksplisit. Tidak ada parameter
runtime `File`, `Form`, atau `Body`: dependency autentikasi selesai sebelum parser
dibuat atau aplikasi memanggil ASGI `receive`. Token invalid tetap menghasilkan
401 meskipun Content-Length besar. Buffer TCP/Uvicorn/proxy berada di luar jaminan
aplikasi ini; tidak ada middleware yang membaca body sebelum autentikasi.

Respons sukses HTTP **201 Created**, setelah file difinalisasi dan commit Sample
berhasil:

```json
{
  "id_sample": 42,
  "nama_berkas": "reads.fastq.gz",
  "ukuran_berkas": 1234,
  "waktu_unggah": "2030-01-02T03:04:05Z"
}
```

Angka, waktu, dan nama di atas hanya contoh. Response tidak memuat ID pemilik,
storage key, path server, password, atau JWT. `Sample.id_user` berasal dari User
yang sudah diautentikasi; parameter pemilik dari client tidak diterima. Model Sample
existing mencukupi, tanpa migrasi dan tanpa membuat Job atau menjalankan pipeline.

`get_upload_owner_id` mengambil snapshot ID dari `get_current_user`, kemudian
menutup session baca yang sama **sebelum body dibaca**. Penutupan idempotent dari
dependency `get_db` tetap berjalan saat teardown. Koneksi dan transaksi baca tidak
ditahan sepanjang transfer/validasi. Session tulis terpisah dibuat, dipakai, dan
ditutup dalam satu thread setelah seluruh validasi subprocess berhasil.

`nama_berkas` menyimpan nama asli tervalidasi, `path_penyimpanan` storage key relatif
UUID buatan server, dan `ukuran_berkas` ukuran payload upload (terkompresi untuk
gzip). Waktu berasal dari server dalam UTC: kolom `DateTime` existing menyimpan
UTC tanpa timezone, sementara response menampilkan UTC dengan `Z`.

Parser menggunakan callback publik `python-multipart==0.0.32`, bukan parser format
multipart buatan sendiri. Payload file dibatasi 1.000.000.000 byte inklusif (atau
nilai `GENOPATH_UPLOAD_MAX_BYTES` yang lebih kecil); total body dibatasi nilai
tersebut + 65.536 byte. Total header part, termasuk CRLF, maksimal 16 KiB. Boundary
dibatasi 70 byte, nama header duplikat dan Content-Transfer-Encoding ditolak.
Byte file diperiksa sebelum ditulis, termasuk tanpa Content-Length; panjang yang
dideklarasikan juga diverifikasi terhadap byte aktual saat EOF. Closing boundary
wajib lengkap. Preamble/epilogue/overhead dibatasi terpisah 65.536 byte, dengan
lookbehind parser kecil selama penerimaan dan pemeriksaan persis saat selesai.

Feed parser dan penulisan file memakai chunk maksimal 64 KiB. Temporary upload
anonim milik context dibuat memakai `TemporaryFile` di direktori temporary sistem,
lalu disalin ke staging 4A. Seluruh disk I/O dan parsing berjalan di thread yang
ditunggu selesai sebelum file ditutup. Tidak ada seluruh body yang digabung ke
RAM. Kebutuhan disk sesaat mendekati dua kali ukuran upload, pada temporary
filesystem dan storage. Kedua lokasi membutuhkan kapasitas yang cukup.

Satu lock nonblocking membatasi **satu upload aktif per proses**, termasuk antar
instance aplikasi di proses yang sama. Request tambahan menerima 503 dan
`Retry-After: 1` sebelum body dibaca. Lock meliputi penerimaan, validasi, dan
cleanup, lalu dilepas pada sukses, error, atau cancellation. Beberapa Uvicorn worker
masing-masing memiliki slot sendiri; ini belum merupakan limit global.

Validasi FASTQ dan gzip dijalankan dalam subprocess satu kali pada Linux/WSL.
Proses utama memiliki staging; worker hanya menerima descriptor baca dan batas
numerik. Worker memakai `-I -B`, environment kosong, output dibuang, tidak membaca
Settings/.env atau mengimpor modul database. Batas CPU dipasang di dalam worker
melalui `resource.setrlimit`, tanpa `preexec_fn`. Core dump dinonaktifkan.

| Environment variable | Default / ketentuan |
| --- | --- |
| `GENOPATH_UPLOAD_VALIDATION_CPU_SECONDS` | `60`, integer positif; soft CPU limit dan hard limit satu detik kemudian. |
| `GENOPATH_UPLOAD_VALIDATION_WALL_SECONDS` | `120`, angka positif finite; khusus fase validasi. |

Saat budget habis atau request dibatalkan, supervisor menghentikan subprocess dan
menunggunya selesai **sebelum** staging dibersihkan. Thread tidak ditinggalkan saat
cancellation; pembacaan/penulisan yang sedang berjalan ditunggu sebelum cleanup.
Pembatasan CPU/waktu melindungi dari biaya member/header gzip yang banyak/panjang,
bukan menetapkan jumlah member. File valid yang terlalu mahal juga dapat ditolak.
Nilai awal perlu dikalibrasi terhadap mesin dan data aktual.

| Status | Kondisi |
| --- | --- |
| 201 | File permanen dan commit Sample berhasil; metadata dikembalikan. |
| 400 | Multipart rusak/terpotong, disconnect, atau Content-Length tidak cocok. |
| 401 | Token hilang/invalid/expired atau User tidak ditemukan. |
| 413 | Batas byte file/body/header/hasil dekompresi/panjang baris terlampaui. |
| 415 | Content-Type bukan multipart/form-data. |
| 422 | Field/file tambahan, filename/FASTQ/gzip invalid, atau budget validasi habis. |
| 503 | Slot penuh, storage/worker tidak tersedia, layanan auth/database gagal, atau commit tidak dapat dikonfirmasi. |

Error memakai pesan tetap, tanpa isi file, token, path server, atau exception OS
mentah. Automated tests memakai file kecil, batas kecil, `tmp_path`, dependency
overrides, serta worker subprocess dengan input sintetis. Session di-mock atau
dibuat tanpa koneksi database dengan operasi terkait di-mock; fixture memblokir
koneksi nyata pada test terkait dan menonaktifkan pembacaan `.env`. Default pytest
suite tidak mengakses PostgreSQL sungguhan. Tooling smoke PostgreSQL dan demo
Swagger berada terpisah di `scripts/`, bersifat manual/opt-in, dan tidak dijalankan
oleh pytest. Pengujian PostgreSQL nyata hanya boleh memakai
`genopath_integration_test` setelah approval terpisah.

Urutan persistence di dalam context staging:

```text
transfer multipart -> staging + validasi subprocess -> buat Session tulis
-> add/flush Sample -> siapkan response DTO -> finalize file
-> preserve_for_reconciliation -> commit Sample -> tutup Session -> HTTP 201
```

Response DTO dibuat sesudah `flush()` dan sebelum commit. Tidak ada `refresh()`,
akses atribut ORM yang sudah expired, atau pemanggilan `retain()` ulang setelah
commit. `preserve_for_reconciliation()` sudah mempertahankan file sebelumnya.
Transaksi database hanya meliputi metadata dan finalisasi filesystem, tidak
transfer file atau validasi yang lama.

Kegagalan sebelum commit dicoba melakukan rollback dan cleanup file milik context,
termasuk hasil finalisasi yang belum dipertahankan. Kegagalan rollback/close tidak
menutupi error utama. Setelah commit dicoba, semua kegagalan diperlakukan secara
konservatif: file tetap dipertahankan meskipun rollback berhasil, karena rollback
tersebut tidak membuktikan COMMIT sebelumnya tidak diterima server. Log rekonsiliasi
hanya mencatat storage key buatan server dan id_sample, tanpa filename client atau
exception driver/SQL. Kegagalan menutup session setelah commit terkonfirmasi
dicatat dengan pesan tetap; tidak mengubah hasil commit menjadi kegagalan upload.

Cancellation sebelum checkpoint terakhir menyebabkan rollback dan cleanup. Setelah
masuk fase preserve/commit, thread menyelesaikan upaya commit walaupun request
dibatalkan; caller menunggu sampai thread selesai sebelum menutup temporary file
dan melepas slot. Commit sukses saat client sudah pergi tetap menyimpan Sample dan
file. Commit ambigu saat cancellation juga mempertahankan file. Timeout thread
tidak dapat menghentikan I/O database: policy timeout koneksi/statement perlu
diverifikasi sebelum pengujian PostgreSQL nyata. Driver yang macet bisa menahan
slot sampai operasi selesai.

Filesystem, database, dan pengiriman respons bukan satu transaksi atomik. File
orphan dapat tersisa jika commit gagal/ambigu setelah preserve, atau proses crash.
Client dapat tidak menerima respons meskipun commit berhasil; retry belum memiliki
idempotency key sehingga bisa membuat Sample duplikat. Tidak ada auto-delete untuk
file dengan hasil commit belum pasti.

Prosedur rekonsiliasi manual (setelah approval akses database terpisah):

1. Identifikasi storage key/id_sample dari log sanitasi dan pastikan operasi asal
   sudah berhenti. Pastikan transaksi COMMIT tidak masih berjalan atau belum pasti.
2. Baca database primary yang authoritative dengan session baru; cari seluruh
   Sample yang mereferensikan `path_penyimpanan` tersebut. Bila ada referensi,
   pertahankan file dan periksa keberadaannya. Jangan menjadikan 503 sebagai bukti
   bahwa Sample tidak tercipta.
3. Hanya setelah transaksi asal dipastikan selesai dan tidak ada referensi,
   file dapat dianggap kandidat orphan. Query yang belum menemukan row saat
   COMMIT masih mungkin berjalan **tidak cukup** untuk mengizinkan penghapusan.
4. Penghapusan memerlukan approval tersendiri, identitas file yang terverifikasi,
   root storage tepercaya, serta koordinasi agar tidak berbenturan dengan upload
   aktif. Jangan menghapus semua `.part` atau file UUID berdasarkan umur saja.

Endpoint tidak menjalankan rekonsiliasi atau migrasi otomatis. Verifikasi dan
cleanup database/storage melalui tooling manual memerlukan approval terpisah.
Sequence ID yang sudah dipakai oleh flush dapat memiliki gap sesudah
rollback; itu bukan bukti adanya Sample yang hilang.

Keterbatasan MVP: belum ada timeout khusus penerimaan/slow upload, kuota disk global,
atau cleaner crash/orphan. Upload lambat dapat memegang satu slot sampai disconnect
atau timeout dari transport. Tidak ada perubahan konfigurasi Uvicorn/proxy pada
checkpoint ini. Cancellation/error normal tetap mencoba cleanup seluruh file
milik context; kegagalan OS atau crash memerlukan rekonsiliasi.
