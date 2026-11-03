# GenoPath Backend, M9 Result API (berbasis M8)

Backend FastAPI, SQLAlchemy, PostgreSQL, JWT, dan input FASTQ **single-end**.
Branch ini: **`feature/be-result-api`**, dibangun dari M8 `100ba5c`.
M8 PR #16 masih terbuka; M9 belum dipush. Setelah review, PR M9 sebaiknya
sementara berbasis `feature/be-pipeline-runner` agar diff hanya berisi M9.
Target integrasi akhir tetap `development`, setelah M8 masuk dan diff ditinjau ulang.

| Tersedia pada branch ini | Batas implementasi |
| --- | --- |
| Login JSON dengan JWT, password Argon2id, upload FASTQ/FASTQ.gz | Tidak ada `/auth/register`; registrasi Tahap A masih di branch terpisah `feature/be-register-integration`. |
| Pembuatan, polling, start, dan retry Job dengan ownership | Upload hanya menyimpan Sample; tidak otomatis menjalankan Job. |
| Runner subprocess sintetis, persistensi Analysis/Variant/Genotype, rollback | VCF sintetis membuktikan alur software, bukan alignment atau variant calling biologis. |
| Kontrak adapter alignment dan workflow Nextflow DSL2 | Toolchain dan pipeline biologis end-to-end belum diverifikasi. Aligner/reference belum diputuskan. |
| Result API: ringkasan, Variant/Genotype, pagination dan filter SQL | Download file dan sorting server dinamis belum tersedia. Data sintetis tetap diberi label `execution_mode=synthetic`. |

## 1. Clone dan Python environment

Linux/WSL direkomendasikan. Python **3.11+**, PostgreSQL lokal, `libpq`, dan Git
harus tersedia. PostgreSQL 18.6 pernah dipakai untuk pengujian terisolasi;
kompatibilitas versi server lain belum diuji dalam checkpoint M8 ini.

```bash
git clone --origin github --branch feature/be-result-api \
  https://github.com/Pembangunan-Perangkat-Lunak-BIF-IPB/kelompok-01.git
cd kelompok-01
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e '.[dev]'
```

**Branch M9 saat ini masih lokal dan belum tersedia untuk clone anggota.**
Contoh clone di atas berlaku sesudah publikasi disetujui; sebelum itu M8 yang
sudah tersedia memakai `--branch feature/be-pipeline-runner`, tanpa Result API.

Jika sudah memiliki clone, simpan pekerjaan lokal sebelum berpindah branch.
Gunakan nama remote milik clone sendiri; contoh di atas menetapkan `github`.
Pada Ubuntu yang belum memiliki prasyarat, pasang seperlunya:

```bash
sudo apt update
sudo apt install python3-venv postgresql postgresql-client libpq5
sudo service postgresql start
```

Perintah tersebut untuk mesin lokal anggota, bukan server/database bersama.
Tidak perlu Java, Nextflow, atau aligner untuk menjalankan API dan demo sintetis.
Gunakan checkout Linux di WSL untuk validasi upload: worker memakai descriptor
POSIX dan batas CPU `resource`. Menjalankan seluruh backend langsung dengan
Python Windows belum didukung jalur worker ini. Browser Windows tetap dapat
membuka Swagger WSL. pgAdmin bersifat opsional.

## 2. Buat database lokal baru dan `.env`

Contoh ini memakai database **baru, kosong, milik anggota sendiri** bernama
`genopath_m8_local`, PostgreSQL TCP `127.0.0.1:5432`. Jika nama sudah ada, hentikan
dan pilih database baru secara sadar, jangan memakai ulang atau menghapusnya.
Jangan menargetkan database utama, praktikum, atau database bersama.

```bash
sudo -u postgres createuser --pwprompt genopath_m8_local
sudo -u postgres createdb --owner=genopath_m8_local genopath_m8_local
```

`createuser` meminta password role database secara tersembunyi. Langkah berikut
meminta password yang sama, membuat JWT secret acak, dan menulis `.env` dengan
izin `600`. Tidak ada secret yang dicetak atau ditaruh dalam history command.
Jalankan dari root repository; pembuatan ditolak jika `.env` sudah ada.

```bash
python - <<'PY'
import getpass
import json
import os
import secrets
from sqlalchemy.engine import URL

url = URL.create(
    'postgresql+psycopg', username='genopath_m8_local',
    password=getpass.getpass('Password role PostgreSQL lokal: '),
    host='127.0.0.1', port=5432, database='genopath_m8_local',
)
lines = [
    'DATABASE_URL=' + json.dumps(url.render_as_string(hide_password=False)),
    'GENOPATH_JWT_SECRET=' + secrets.token_urlsafe(48),
    'GENOPATH_PIPELINE_ENABLED=true',
    'GENOPATH_PIPELINE_ALLOW_SYNTHETIC=true',
]
fd = os.open('.env', os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w') as output:
    output.write('\n'.join(lines) + '\n')
print('.env lokal dibuat; secret tidak ditampilkan.')
PY
```

`DATABASE_URL` tidak memakai prefix `GENOPATH_`. URL harus menggunakan driver
`postgresql+psycopg://`. Settings membaca `.env` relatif working directory.
JWT memakai HS256, secret minimal 32 byte, masa sesi default **240 menit**.
Jangan mencetak `.env`, membagikan JWT, atau memasukkan password ke source code.
Variabel environment aktif mengalahkan `.env`; hapus override lama yang salah.

Gates pipeline default aplikasi adalah **false**. Contoh lokal di atas secara
sengaja membuka gate Job dan gate sintetis. Tidak ada aligner/reference biologis
yang dipilih oleh konfigurasi tersebut.

## 3. Migrasi, akun lokal, dan reference sintetis

Pada database baru dan kosong yang baru dibuat:

```bash
python -m alembic upgrade head
```

Head branch ini adalah `0004_m9_result_indexes`: M6 membuat tiga tabel dasar, M7
menambahkan username dan tabel analisis, M8 menambahkan lima kolom metadata
nullable. M9 menambahkan tiga index untuk pagination/filter Variant dan lookup
Genotype, tanpa kolom/tabel baru. Alembic tidak dijalankan otomatis saat API mulai.
**Database existing memerlukan audit dan persetujuan terpisah**, termasuk
backfill username jika tabel User sudah berisi data. Jangan memakai `stamp head`
untuk melewati migrasi. Lihat [panduan migrasi](migrations/README.md).

Tidak ada akun bawaan atau Reference API pada branch ini. Untuk database lokal
baru tadi, buat akun ber-role `user` dan satu reference fixture. Script menolak
nama database lain, schema bukan M8, atau akun/reference yang sudah terisi;
tidak mengubah akun existing. Password akun diminta tersembunyi dan di-hash.

```bash
python - <<'PY'
import getpass
from pathlib import Path
from sqlalchemy import select, text
from sqlalchemy.orm import Session
from app.core.config import Settings
from app.core.security import hash_password
from app.database import get_engine
from app.models import ReferenceGenome, User

settings = Settings()
engine = get_engine(settings.database_url)
password = getpass.getpass('Password akun demo lokal (minimal 12 karakter): ')
if len(password) < 12:
    raise SystemExit('Gunakan password lokal minimal 12 karakter.')
root = settings.reference_root
root.mkdir(parents=True, exist_ok=True)
with Session(engine) as db, db.begin():
    if db.scalar(text('SELECT current_database()')) != 'genopath_m8_local':
        raise SystemExit('Ditolak: database tujuan bukan database lokal contoh.')
    if db.scalar(text('SELECT version_num FROM public.alembic_version')) != '0004_m9_result_indexes':
        raise SystemExit('Ditolak: migrasi branch M9 belum lengkap.')
    if (db.scalar(select(User.id_user).limit(1)) is not None
            or db.scalar(select(ReferenceGenome.id_reference_genome).limit(1)) is not None):
        raise SystemExit('Ditolak: akun/reference sudah terisi; jangan seed ulang.')
    with (root / 'tiny.fa').open('x') as fasta:
        fasta.write('>synthetic_chr\nACGTACGT\n')
    user = User(username='local_demo', nama='Local synthetic demo',
                email='local_demo@example.invalid', role='user',
                password_hash=hash_password(password))
    reference = ReferenceGenome(nama_genom='SYNTHETIC, not an approved genome',
                                versi='fixture', sumber='Generated locally', path_fasta='tiny.fa')
    db.add_all([user, reference])
    db.flush()
    identifiers = (user.id_user, reference.id_reference_genome)
engine.dispose()
print('Username: local_demo; User ID: %s; Reference ID: %s' % identifiers)
PY
python -m scripts.generate_dummy_fastq \
  --output data/samples/synthetic.fastq --reads 3 --read-length 12
```

Catat Reference ID yang dicetak, jangan mengasumsikan ID selalu `1`. FASTQ kecil
berisi sequence acak sintetis. `tiny.fa` hanya memenuhi kontrak input sintetis,
bukan genom referensi yang telah disetujui. Mode sintetis tidak membaca sequence
untuk menentukan varian: subprocess menghasilkan tiga record VCF tetap.
Password akun berbeda kegunaan dari password role PostgreSQL.

Seed di atas hanya untuk bootstrap lokal sekali. File FASTA dibuat secara
exclusive dan transaksi row database atomik; filesystem dan database bukan satu
transaksi. Jika commit gagal setelah file dibuat, jangan menjalankan ulang atau
menghapus file secara buta: periksa database/file yang tersisa terlebih dahulu.

## 4. FastAPI, Swagger, dan alur demo

```bash
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Buka [Swagger](http://127.0.0.1:8000/docs) atau `/openapi.json`. `/health` HTTP 200
hanya membuktikan proses API hidup, bukan koneksi atau kesiapan database.
Jalankan dari root repository agar `.env`, `pipeline/`, dan storage konsisten.

1. `POST /auth/login`, JSON `{"username":"local_demo","password":"<password akun lokal>"}`.
   Login menggunakan **username**, bukan email. Salin JWT hasil login hanya ke
   tombol **Authorize** Swagger, jangan ke chat atau screenshot. Token bukan
   contoh akun atau nilai bawaan; tidak ada refresh token/remember-me.
2. `POST /samples/upload`, pilih field multipart **`file`** dan file
   `data/samples/synthetic.fastq`. Respons 201 berisi `id_sample`; catat nilainya.
   Sample/file tersimpan, belum ada Job. FASTQ.gz juga didukung.
3. `POST /jobs` dengan JSON berikut. Ganti kedua ID dengan hasil aktual dan
   gunakan UUID baru untuk setiap submission baru (`python -c 'import uuid; print(uuid.uuid4())'`).

   ```json
   {
     "id_sample": 1,
     "id_reference_genome": 1,
     "request_id": "195097c9-9ced-47b5-8124-e0a03c31ca24",
     "vcf_sample": "local_sample",
     "parameter_qual": 30.0,
     "parameter_dp": 10,
     "require_pass": true,
     "execution_mode": "synthetic",
     "variant_ploidy": 2
   }
   ```

4. Respons 201 berstatus `Queued`. `POST /jobs/{id_job}/start` memberi 202 sebagai
   acknowledgment dispatch, lalu polling `GET /jobs/{id_job}` sampai `Completed`
   atau `Failed`. `has_result=true` menunjukkan Analysis tersedia. Respons start
   dapat masih `Queued`, karena pekerjaan berlangsung setelah respons.
5. `POST /jobs/{id_job}/retry` hanya untuk Job **Failed**, menghasilkan Job baru
   berstatus Queued, yang harus di-start lagi secara eksplisit.

Seluruh Job API memakai JWT dan ownership. UUID sama dengan body sama
mengembalikan Job yang sama; UUID sama dengan body berbeda mendapat 409.
Satu Job `Queued`/`Running` per user diserialisasi dengan row lock PostgreSQL.
Jangan upload ulang secara buta jika respons upload terputus atau 503: COMMIT
Sample dapat sudah berhasil, dan upload belum memiliki idempotency key.

Untuk fixture default ini, hasil terseleksi adalah **3 Variant dan 3 Genotype**:
1 SNP, 1 InDel, dan 1 `other` (ALT campuran). GT default fixture `0/1`, FORMAT/DP
`25`; angka tersebut bukan temuan biologis. Pada branch M9, hasil dapat dibaca melalui Result API di bawah, SQL/ORM lokal,
dan file run. Download file belum tersedia.

Query baca saja, melalui `psql` atau Query Tool pada database lokal sendiri;
ganti `1` pada filter dengan Job ID aktual:

```sql
SELECT j.id_job AS job, j.status, v.chromosome AS chrom, v.position AS pos,
       v.ref_allele AS ref, v.alt_allele AS alt, v.variant_type AS type,
       v.qual, g.genotype_call AS gt, g.dp
FROM public.job j
JOIN public.analysis a ON a.id_job = j.id_job
JOIN public.variant v ON v.id_analysis = a.id_analysis
JOIN public.genotype g ON g.id_variant = v.id_variant AND g.id_sample = j.id_sample
WHERE j.id_job = 1
ORDER BY v.id_variant;
```

Misalnya `psql -h 127.0.0.1 -U genopath_m8_local -d genopath_m8_local -W` meminta
password tanpa menaruhnya pada command. Tidak perlu membuka pgAdmin.

## 5. Result API untuk FE dan QA

Kedua endpoint berikut **GET**, memerlukan Bearer JWT yang sama dengan Job API.
Swagger `/docs` dan `/openapi.json` memuat schema serta contoh respons aktual
fixture sintetis. ID pada contoh bukan akun/reference bawaan untuk anggota.
Tidak ada pipeline yang dijalankan atau row database yang diubah oleh Result API.

| Endpoint | Kegunaan |
| --- | --- |
| `GET /jobs/{id_job}/result` | Ringkasan semua Variant tersimpan untuk grafik, parameter Analysis, mode eksekusi, dan timestamp UTC. |
| `GET /jobs/{id_job}/variants` | Halaman tabel Variant dan daftar Genotype milik Sample yang dipetakan Job. |

Contoh respons ringkasan aktual Job sintetis pada pengujian PostgreSQL:

```json
{
  "id_job": 11,
  "id_analysis": 11,
  "id_sample": 3,
  "id_reference_genome": 3,
  "status": "Completed",
  "counts": {
    "total_variants": 3,
    "snps": 1,
    "indels": 1,
    "other": 1,
    "unclassified": 0
  },
  "parameters": {
    "parameter_qual": 30.0,
    "parameter_dp": 10,
    "require_pass": true,
    "variant_ploidy": 2
  },
  "execution_mode": "synthetic",
  "waktu_mulai": "2026-11-03T11:39:46.265060Z",
  "waktu_selesai": "2026-11-03T11:39:46.391799Z"
}
```

Contoh request tabel: `GET /jobs/11/variants?min_qual=60&limit=1&offset=2`.
Respons aktual (ID hanya untuk menjelaskan kontrak):

```json
{
  "id_job": 11,
  "id_analysis": 11,
  "items": [
    {
      "id_variant": 419,
      "chromosome": "synthetic_chr",
      "position": 3,
      "ref_allele": "A",
      "alt_allele": "C,AT",
      "qual": 60.0,
      "variant_type": "other",
      "filter_status": "PASS",
      "info": {
        "DP": "999"
      },
      "genotypes": [
        {
          "id_genotype": 419,
          "id_sample": 3,
          "genotype_call": "0/1",
          "dp": 25
        }
      ]
    }
  ],
  "total": 3,
  "limit": 1,
  "offset": 2,
  "returned": 1,
  "has_more": false,
  "next_offset": null,
  "filters": {
    "variant_type": null,
    "min_qual": 60.0,
    "max_qual": null
  }
}
```

Gunakan ID Job **lokal sendiri** yang sudah Completed saat mencoba di Swagger,
kemudian Execute kedua endpoint. Untuk membandingkan pagination, coba `limit=1`
dengan `offset=0`, `1`, dan `2`. Untuk fixture default, `variant_type=snp`
menghasilkan satu Variant dan `min_qual=61` menghasilkan total nol. Tidak perlu
menyalin database pengembang atau menjalankan seed tambahan.

Parameter tabel:

| Parameter | Default / validasi |
| --- | --- |
| `limit` | `50`, integer 1–500. |
| `offset` | `0`, integer 0–2147483647. |
| `variant_type` | Opsional: `snp`, `indel`, `other`, `unclassified`, case-sensitive. |
| `min_qual`, `max_qual` | Opsional, finite dan nonnegatif, batas inklusif; min tidak boleh melebihi max. |

`total` adalah jumlah Variant **setelah filter**, sebelum limit/offset. `returned`
adalah panjang `items`; `has_more` dan `next_offset` menuntun halaman berikutnya.
Urutan selalu `id_variant ASC`; sorting server lain belum tersedia. Offset di luar
hasil tetap memberi 200 dengan `items=[]`, total aktual, dan `next_offset=null`.
Unknown query parameter ditolak 422 agar salah nama filter tidak diabaikan.
QUAL NULL tidak cocok dengan batas numerik; tanpa filter tetap dapat dikembalikan.

Ringkasan grafik tidak mengikuti filter tabel. Counts dihitung melalui SQL dari
Variant yang benar-benar tersimpan, bukan menebak dari GT atau mengandalkan counter
Analysis yang mungkin lama. Tipe NULL/tidak dikenal dihitung sebagai `unclassified`,
tidak diubah menjadi `other`. ALT multiallelic dan GT berfase/missing dipertahankan;
`info` tetap string/null sesuai VCF. Genotype dari Sample lain tidak dikirim.
Variant tanpa Genotype tetap muncul dengan `genotypes=[]`; jumlah GT tidak
menggandakan pagination/count Variant.

Job/Analysis milik akun lain dan Job tidak ada sama-sama memberi 404. Job milik
sendiri yang belum Completed atau tidak memiliki Analysis memberi 409. JWT salah,
hilang, atau expired memberi 401; query/path invalid 422; kegagalan DB yang
dikenali 503 dengan pesan generik. Respons sukses memakai `Cache-Control: private,
no-store`. Path storage, parameter executable, JWT, dan metadata QC mentah tidak
dikirim oleh Result API. Mode eksekusi legacy yang tidak tercatat tetap null.

Untuk FE Vite dengan proxy `/api`, gunakan `/api/jobs/{id}/result` dan
`/api/jobs/{id}/variants`, sertakan header Authorization. Ubah offset kembali ke
0 saat filter berubah, tangani 401 dengan login ulang, dan 409 dengan polling Job.
FE/Result Viewer tidak diubah di tahap ini; kontrak Result belum ada pada
`api.ts` branch FE yang diperiksa. Tidak ada CORS tambahan.

Query count/page/genotype dibatasi ke Analysis terotorisasi. Genotype diambil
dalam satu query untuk ID Variant pada halaman, tanpa N+1. PostgreSQL menggunakan
transaksi REPEATABLE READ READ ONLY dan statement timeout 10 detik agar count dan
page konsisten pada satu request. Request ringkasan dan tabel yang terpisah bukan
satu snapshot bersama. Offset besar dan exact count masih memerlukan benchmark
pada data besar; ini bukan klaim performa genom penuh.

Index M9 tersedia sebagai source migrasi `0004_m9_result_indexes`. Migrasi index
baru diuji offline/SQLite, **belum diterapkan ke cluster fixture PostgreSQL M8**.
API read-only juga diverifikasi pada schema M8 tersebut, karena index tidak
mengubah kontrak kolom. Pada database anggota baru gunakan `alembic upgrade head`;
pada database existing, tinjau target dan kebutuhan lock/maintenance sebelum DDL.

## 6. Pengujian yang terisolasi

```bash
python -B -m pytest -p no:cacheprovider
# Subset M8 untuk iterasi cepat:
python -B -m pytest -p no:cacheprovider \
  tests/test_jobs.py tests/test_job_http.py tests/test_pipeline.py \
  tests/test_vcf_records.py tests/test_vcf_summary.py tests/test_m8_smoke_guard.py
# Subset Result API:
python -B -m pytest -p no:cacheprovider tests/test_results.py
# Validasi migrasi offline, tanpa koneksi database:
python -m alembic upgrade head --sql > /tmp/genopath-m9-schema.sql
```

Pytest menggunakan mock, SQLite in-memory, temporary storage, dan subprocess
sintetis. Fixture menonaktifkan `.env` dan mengisolasi konfigurasi terkait;
pengujian ini tidak memerlukan atau menulis PostgreSQL. SQLite tidak membuktikan
semantik row lock PostgreSQL. Script manual di `scripts/` tidak dijalankan oleh
pytest; jangan menjalankannya sebagai pengganti tests default tanpa memahami
guard dan targetnya.

Checkpoint 3 November 2026: **765 tests passed** pada suite M8 sebelum publikasi;
**8 skenario PostgreSQL 18.6 nyata** juga sudah lulus pada cluster disposable
terisolasi (bukti dari Tahap B, tidak dijalankan ulang saat publikasi). Skenario
mencakup persistensi 3 varian/GT, rollback parsing dan FK, ownership, idempotency,
retry, satu Job aktif per user, serta klaim worker bersamaan. Tidak ada klaim
bahwa 8 skenario tersebut adalah tests mock atau eksekusi biologis.

`scripts/m8_disposable_smoke.py` adalah harness khusus pengujian terisolasi yang
memerlukan manifest kepemilikan dari penyiapan cluster terpisah. Harness dipin
ke revision M8 dan tidak menerapkan migrasi M9. Repository ini
belum menyediakan provisioning cluster/manifest generik untuk harness tersebut.
Gunakan demo lokal di atas untuk mencoba API; jangan membuat manifest tiruan
atau mengarahkan harness ke database existing. Bukti dan database pengembang
tidak diperlukan untuk mengikuti README ini.

Checkpoint M9, 3 November 2026: **831 tests passed, 0 failed**, dua peringatan
dependency. Suite mencakup regresi M8 dan Result API, termasuk ownership, expiry,
filter/pagination, data kosong, query tanpa N+1, dan migrasi index offline.
Tambahan **8 pemeriksaan read-only PostgreSQL 18.6 nyata** pada fixture sintetis
M8 lulus, termasuk count/page/filter dan penolakan akses. Dua screenshot Chrome
berasal dari API Uvicorn yang benar-benar berjalan, dengan JSON diperbesar untuk
keterbacaan. Tidak ada row fixture atau schema cluster M8 yang diubah. Index
M9 belum diuji online atau dibenchmark pada dataset besar. Bukti tersimpan di
luar repository dan tidak diperlukan untuk bootstrap anggota.

## 7. Konfigurasi pipeline dan batas operasional

| Variabel | Default / kegunaan |
| --- | --- |
| `GENOPATH_UPLOAD_ROOT` | `data/samples`, storage FASTQ; path Sample relatif root ini. |
| `GENOPATH_REFERENCE_ROOT` | `data/reference`, file FASTA yang dirujuk ReferenceGenome. |
| `GENOPATH_PIPELINE_ROOT` | `data/jobs`, satu direktori UUID untuk setiap run. |
| `GENOPATH_PIPELINE_ENABLED` | `false`, gate pembuatan/start Job. |
| `GENOPATH_PIPELINE_ALLOW_SYNTHETIC` | `false`, gate tambahan mode sintetis. |
| `GENOPATH_PIPELINE_THREADS` | `1`, batas konfigurasi 1–64. |
| `GENOPATH_PIPELINE_TIMEOUT_SECONDS` | `3600`, timeout subprocess; tidak membatasi query DB. |
| `GENOPATH_PIPELINE_ALIGNMENT_STRATEGY` | Tidak ada default, identifier strategi operator. |
| `GENOPATH_PIPELINE_ALIGNMENT_ADAPTER` | Path executable adapter yang disetujui. |
| `GENOPATH_PIPELINE_NEXTFLOW_EXECUTABLE` | Path executable Nextflow. |
| `GENOPATH_PIPELINE_FASTP_EXECUTABLE` | Path executable fastp. |
| `GENOPATH_PIPELINE_SAMTOOLS_EXECUTABLE` | Path executable SAMtools. |
| `GENOPATH_PIPELINE_BCFTOOLS_EXECUTABLE` | Path executable BCFtools. |
| `GENOPATH_PIPELINE_NEXTFLOW_PROFILE` | `local`, satu-satunya profile saat ini. |

Mode `nextflow` memerlukan Java yang cocok dengan versi Nextflow, Nextflow
(`nextflow.config` menetapkan minimal 24.10.0), fastp, SAMtools, BCFtools,
reference/index yang cocok, serta adapter alignment. Toolchain belum lengkap
pada checkpoint ini; tidak dipasang atau dijalankan oleh quickstart sintetis.

Adapter menerima `--reads`, `--reference`, `--output`, `--sample-name`, dan
`--threads`, lalu menghasilkan SAM dengan read-group sample yang sesuai.
Adapter mengelola tool dan index strateginya sendiri. Downstream memakai SAM,
BAM terurut/terindeks, dan VCF. Tidak ada adapter BWA-MEM2/Bowtie2 bawaan;
perubahan strategi pada M10 tidak memerlukan Result API memahami command aligner.
Kesesuaian ilmiah alternatif, reference, dan ploidy tetap perlu keputusan tim.
`variant_ploidy` wajib diberikan, bukan default biologis.

Runner meluncurkan subprocess tanpa shell, membatasi timeout dan menghentikan
grup proses pada timeout POSIX, serta tidak mewariskan environment kredensial.
Environment subprocess minimal; konfigurasi tambahan seperti Java/Nextflow home
masih perlu diverifikasi saat toolchain disiapkan. Workflow DSL2 di `pipeline/`
belum diverifikasi eksekusinya, sehingga belum disebut pipeline biologis lengkap.

Dispatch memakai FastAPI BackgroundTasks dalam proses. Ini belum queue tahan
restart. Crash dapat menyisakan Job Queued/Running yang perlu rekonsiliasi
operator; tidak ada cancel, auto-resume, atau pengulangan Job Running otomatis.
Direktori run gagal dipertahankan untuk review. Transaksi DB menulis Analysis,
Variant, Genotype, dan status Completed bersama; filesystem/DB tidak atomik.
File tersisa setelah transaksi gagal bukan hasil Completed.

Parser `summarize_vcf` tetap menghitung record ALT mentah. Ingestion memakai
satu Variant per record multiallelic (ALT dipertahankan), GT asli dan FORMAT/DP;
INFO/DP tidak menggantikan FORMAT/DP. Missing QUAL/DP dikecualikan walau threshold
nol. FILTER wajib PASS jika `require_pass=true`. Raw counts dan selected counts
terpisah dalam metadata. Belum ada normalisasi/left-alignment atau validasi alel
terhadap reference. VCF UTF-8 tak terkompresi, tepat satu sample dengan nama
cocok persis, dan batas input ingestion 1 GB.

## Troubleshooting dan referensi

- `libpq library not found`: pasang `libpq5` pada Linux/WSL, lalu pastikan memakai
  Python dari `.venv` yang benar. Psycopg dependency tidak memakai extra binary.
- Koneksi ditolak/password gagal: periksa service PostgreSQL, host/port dan role
  lokal. Jangan menampilkan `.env` atau connection string saat meminta bantuan.
- Login 401: periksa username, password akun (bukan password role database),
  token expired, dan akun yang benar. Login 503 dapat berarti JWT secret atau
  database belum siap. `/health` tidak menguji keduanya.
- `column ... does not exist`: periksa target database dan Alembic revision;
  database baru branch M9 harus mencapai `0004_m9_result_indexes`. Jangan stamp schema yang salah.
- Job 503: periksa kedua gate sintetis, file input/reference dan root storage.
  Jangan mengaktifkan mode nextflow sebelum tool/reference/adapter disetujui.
- Job 409: ada Job aktif, status tidak cocok untuk start/retry, atau UUID dipakai
  dengan parameter berbeda. Poll Job terkait sebelum membuat submission lain.
- Job 404: Job/Sample tidak ada atau bukan milik akun. Reference tidak valid
  mendapat 422. Tidak tersedia endpoint daftar reference pada M8.
- Generator/file fixture sudah ada: pembuatan exclusive memang menolak overwrite;
  gunakan hasil sebelumnya atau nama baru yang direncanakan, jangan cleanup buta.
- Port 8000 dipakai: pilih port kosong melalui `--port`, sesuaikan base URL klien.
  FE memakai kontrak login JSON username/password; upload 201 bukan Job Completed.

[Kontrak FE/QA M7](BACKEND_INTEGRATION_GUIDE.md) menjelaskan detail autentikasi,
FASTQ, storage, dan error. Bagian M8/future pada panduan lama harus dibaca bersama
README ini untuk status Job terbaru. [Prosedur Swagger M7](scripts/SWAGGER_DEMO.md)
adalah tooling opt-in terpisah, bukan jalur setup M8. Registrasi Tahap A tetap
terpisah sampai integrasinya disetujui; README tidak mengaktifkan pendaftaran
publik atau mengubah frontend.
