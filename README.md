# GenoPath Backend: Auth, Job, dan Result API

Backend FastAPI, SQLAlchemy, PostgreSQL, JWT, dan input FASTQ **single-end**.
Branch M8: **`feature/be-m8-bowtie2-e2e`**, berbasis `development` pada `d04a868`
yang sudah memuat fondasi M8, Result API M9, dan registrasi. Perubahan ini tidak
menambah migrasi. Contoh clone branch fitur berlaku setelah branch dipublikasikan;
setelah PR di-merge, anggota dapat memakai `development` terbaru.

| Tersedia pada branch ini | Batas implementasi |
| --- | --- |
| Register JSON, login JWT, password Argon2id, upload FASTQ/FASTQ.gz | Register membuat akun role `user`, tanpa token otomatis. Kebijakan registrasi deployment publik belum diputuskan. |
| Pembuatan, polling, start, dan retry Job dengan ownership | `/samples/upload` tetap menyimpan Sample saja. `/samples/upload-and-run` menambah jalur upload dan dispatch otomatis dengan parameter eksplisit. |
| Runner sintetis dan biologis, persistensi Analysis/Variant/Genotype, rollback | Mode sintetis tetap membuktikan alur software saja; bukti biologis memakai tool nyata dan fixture kecil. |
| Nextflow DSL2: fastp → Bowtie2 → SAMtools → BCFtools | Plain FASTQ/gzip dan indeks `.bt2`/`.bt2l` sudah diuji pada fixture 20 kbp. Full Garlic.V2 dan FASTQ 1 GB belum diuji. |
| Result API: ringkasan, Variant/Genotype, pagination dan filter SQL | Download file dan sorting server dinamis belum tersedia. Data sintetis tetap diberi label `execution_mode=synthetic`. |

## 1. Clone dan Python environment

Linux/WSL direkomendasikan. Python **3.11+**, PostgreSQL lokal, `libpq`, dan Git
harus tersedia. PostgreSQL 18.6 pernah dipakai untuk pengujian terisolasi;
kompatibilitas versi server lain belum diuji dalam checkpoint M8 ini.

```bash
git clone --origin github --branch feature/be-m8-bowtie2-e2e \
  https://github.com/Pembangunan-Perangkat-Lunak-BIF-IPB/kelompok-01.git
cd kelompok-01
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e '.[dev]'
```

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

Tidak ada akun bawaan atau Reference API pada branch ini. **Untuk integrasi
register/login saja, bootstrap akun/reference di bawah tidak diperlukan**: setelah
migrasi, jalankan server dan gunakan `/auth/register`.

Bootstrap berikut opsional untuk demo Job sintetis M8/M9 pada database baru yang
masih kosong. Jalankan sebelum registrasi akun lain jika ingin mencoba kedua alur.
Script membuat akun ber-role `user` dan satu reference fixture, serta menolak
nama database lain, schema bukan head M9, atau akun/reference yang sudah terisi;
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
Sample dapat sudah berhasil, dan endpoint M7 `/samples/upload` tidak memiliki
idempotency key. Untuk submission otomatis dengan receipt, lihat bagian 7.

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

## Kontrak register/login untuk Azril dan QA

Server `127.0.0.1:8000` menyediakan route tanpa prefix `/api`. Pada FE Vite yang
sudah memakai proxy `/api`, panggil **`/api/auth/register`** dan
**`/api/auth/login`**; proxy menghapus `/api`. Tidak ada perubahan CORS atau kode
FE dalam integrasi ini. Setelah PR di-merge, backend yang berjalan perlu memakai
checkout `development` terbaru agar endpoint tersedia pada base URL tim.

`POST /auth/register`, `Content-Type: application/json`, **tanpa JWT**:

```json
{
  "username": "azril_demo",
  "nama": "Peneliti Demo",
  "email": "azril_demo@example.invalid",
  "password": "<ganti-dengan-password-lokal-sendiri>"
}
```

Nilai password di atas placeholder, bukan kredensial atau akun bawaan. Contoh
bentuk respons **HTTP 201** (ID berasal dari server):

```json
{"id_user":1,"username":"azril_demo","nama":"Peneliti Demo","email":"azril_demo@example.invalid","role":"user"}
```

Akun sudah di-commit ke PostgreSQL sebelum 201. Respons tidak memuat password,
hash, atau JWT. Password di-hash Argon2id. Role ditentukan server: field `role`,
`is_admin`, `id_user`, `password_hash`, dan field tambahan lain ditolak.

| Field registrasi | Kontrak |
| --- | --- |
| `username` | Wajib, 3–64 karakter; awal huruf/angka ASCII, sisanya huruf/angka/`_`/`.`/`-`; case-sensitive. |
| `nama` | Wajib, 1–120 karakter printable, tidak boleh kosong. |
| `email` | Wajib, maksimal 254 karakter; email ASCII tanpa quoted local part, domain bertitik; disimpan lowercase. Tidak melakukan verifikasi email/DNS. |
| `password` | Wajib, 12–128 karakter, bukan seluruhnya whitespace; **tidak di-trim**. |

Username/nama/email di-trim saat registrasi. Login tetap mencocokkan username
persis, sehingga gunakan username hasil respons registrasi atau trim input username
di FE; jangan menggantinya dengan email. Password selalu dikirim persis seperti
input pengguna, termasuk spasi yang disengaja.

`POST /auth/login` tetap menerima JSON berikut, tanpa field lain:

```json
{"username":"azril_demo","password":"<password-akun-yang-baru-didaftarkan>"}
```

Respons **HTTP 200**, token ditampilkan sebagai placeholder dalam dokumentasi:

```json
{"access_token":"<disamarkan>","token_type":"bearer"}
```

JWT default **240 menit**, bukan 72 jam. Token hanya membawa `sub`, `iat`, `exp`;
login tidak mengembalikan profil nama/email/role. Label role yang saat ini dibuat
FE bukan otorisasi backend. Header endpoint terlindungi tetap `Authorization:
Bearer <token>`. Jangan mencetak JWT/password di console, log, atau screenshot.

| Status | Arti untuk FE |
| --- | --- |
| Register 201 | Akun tersimpan; lanjut login atau arahkan ke form login. |
| Register 409 | `{"detail":"Username or email already registered."}`; username/email sudah ada, termasuk konflik transaksi. |
| Register/login 422 | Request invalid; `detail` berupa array pesan sanitasi, bukan selalu string. Tidak memantulkan nilai input. |
| Login 401 | Username/password salah; email tidak didukung sebagai identifier login. |
| 503 | Layanan auth/database tidak tersedia; pesan generik `Service unavailable.`. |

Cara mencoba paling singkat: buka `/docs`, Execute register dengan empat field,
lalu Execute login memakai username/password yang sama. Untuk demo auth ini,
tidak perlu seed User, Sample, reference, atau menjalankan pipeline. Gunakan akun
sintetis baru; jangan mengambil screenshot payload password atau respons token.

Kontrak minimum yang dapat diteruskan Azril ke AI coding assistant FE:

1. Tambahkan input **`nama`** pada form register dan kirim tepat
   `{username,nama,email,password}` ke `POST /api/auth/register`.
2. Setelah 201, panggil `login({username: result.username, password})` existing,
   atau pindah ke tab login. Register sendiri tidak membuat sesi/JWT.
3. Ganti label/placeholder login username/email menjadi **Username**. API login
   tetap `{username,password}`; jangan mengirim email sebagai username.
4. Sesuaikan teks sesi menjadi 240 menit atau hindari angka hardcoded. Pada 401,
   panggil logout untuk menghapus token/profile lokal dan minta login ulang.
5. Jangan kirim field role, jangan menganggap profil/role dummy di AuthContext
   sebagai data dari JWT. Map `nama` ke `name` hanya untuk kebutuhan tampilan.
6. Tangani 409/422/503 secara jelas. Integrasi UI belum diuji pada tahap backend
   ini; FE tidak diubah. Endpoint registrasi disiapkan untuk MVP/demo lokal,
   bukan persetujuan kebijakan pendaftaran publik pada deployment.

Verifikasi integrasi registrasi: **906 tests passed**, termasuk regresi M8/M9.
Tambahan **15 pemeriksaan PostgreSQL nyata** pada database baru terisolasi lulus:
Register → akun tersimpan ber-hash → Login → JWT, duplikat, invalid input,
role escalation, unique-race username/email, serta penggunaan JWT pada upload
M7 dan autentikasi Result API M9. Bukti HTTP/satu screenshot asli tersimpan di
luar repository. Database dan fixture M8/M9 sebelumnya tidak diubah.

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

Migrasi `0004_m9_result_indexes` sudah **di-apply melalui Alembic online pada
database baru di cluster disposable terisolasi**, dari schema kosong sampai M9.
Ketiga index diperiksa nama, kolom, serta status valid/ready. Login, upload,
Job sintetis, dan Result API juga dicoba dengan PostgreSQL nyata. Database
fixture M8 tetap pada revision M8, tidak dimigrasi atau diubah untuk pengujian ini.
Ini belum merupakan benchmark dataset besar.

Untuk database lokal anggota **baru dan kosong**, ikuti bagian 2–3 dan gunakan
`python -m alembic upgrade head` sebelum bootstrap akun/reference. Jika database
lokal milik sendiri sudah memakai M8, verifikasi target koneksi dan revision:

```bash
python -m alembic current
# Setelah memastikan target adalah database lokal sendiri pada 0003_m8_pipeline:
python -m alembic upgrade 0004_m9_result_indexes
```

Upgrade dari M8 hanya menambah tiga index; tidak perlu seed ulang akun/reference
atau mengulang Job Completed. Setelah upgrade, jalankan kedua endpoint Result API
pada Job lokal tersebut. CREATE INDEX biasa dapat menahan penulisan: tinjau
maintenance/otorisasi sebelum menerapkannya pada database bersama. Jangan memakai
`stamp` untuk menggantikan upgrade atau memigrasi database pengembang sebagai demo.

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
M9 pada checkpoint awal belum diuji online. Bukti tersimpan di luar repository
dan tidak diperlukan untuk bootstrap anggota.

Verifikasi publikasi M9, 3 November 2026: **171 tests terarah passed, 0 failed**,
dua peringatan dependency. Suite 831 tests sebelumnya tidak diulang seluruhnya.
Satu mismatch contoh Swagger ditemukan dan diperbaiki: field nullable wajib
`next_offset` kini tetap ditampilkan sebagai null pada halaman terakhir.
Tambahan **11 pemeriksaan akhir PostgreSQL nyata** lulus pada database verifikasi
baru: revision M9, tiga index valid/ready, hasil runner sintetis, Result API,
filter/pagination, ownership, serta kontrak README/Swagger. Migrasi online lengkap
dan alur login → upload → Job sintetis telah berjalan pada database baru itu.
Pemeriksaan API terakhir read-only dan fixture M8 beserta fingerprint hasil tetap
utuh. Database verifikasi dipertahankan tanpa DROP. Performa data besar dan
alignment biologis belum diverifikasi pada checkpoint M9 tersebut.

Checkpoint M8, 4 November 2026: tiga eksekusi Nextflow nyata pada CP2 berhasil
(FASTQ, FASTQ.gz, dan indeks `.bt2l` yang dibuat dari fixture kecil). CP3 memiliki
69 pemeriksaan integrasi PostgreSQL nyata; CP4 memiliki 85, termasuk auto-trigger
tanpa Start manual, replay, konkurensi UUID sama, dan kegagalan terkontrol.
Regresi pra-commit CP4: **966 passed, 0 failed**. Ini bukti checkpoint lokal,
bukan hasil CI atau QA independen. Toolchain, database disposable, log, dan
screenshot lokal dalam `build/` tidak otomatis tersedia pada clone baru.

## 7. Konfigurasi pipeline dan batas operasional

| Variabel | Default / kegunaan |
| --- | --- |
| `GENOPATH_UPLOAD_ROOT` | `data/samples`, storage FASTQ; path Sample relatif root ini. |
| `GENOPATH_REFERENCE_ROOT` | `data/reference`, file FASTA yang dirujuk ReferenceGenome. |
| `GENOPATH_PIPELINE_ROOT` | `data/jobs`, satu direktori UUID untuk setiap run. |
| `GENOPATH_PIPELINE_ENABLED` | `false`, gate pembuatan/start Job. |
| `GENOPATH_PIPELINE_ALLOW_SYNTHETIC` | `false`, gate tambahan mode sintetis. |
| `GENOPATH_PIPELINE_THREADS` | `1`, schema 1–64; mode Nextflow hanya menerima 1–4. |
| `GENOPATH_PIPELINE_TIMEOUT_SECONDS` | `3600`, timeout subprocess; tidak membatasi query DB. |
| `GENOPATH_PIPELINE_ALIGNMENT_STRATEGY` | Tidak ada default, identifier strategi operator. |
| `GENOPATH_PIPELINE_ALIGNMENT_ADAPTER` | Path executable adapter yang disetujui. |
| `GENOPATH_PIPELINE_BOWTIE2_EXECUTABLE` | Path executable `bowtie2`. |
| `GENOPATH_PIPELINE_BOWTIE2_INSPECT_EXECUTABLE` | Path executable `bowtie2-inspect`. |
| `GENOPATH_PIPELINE_BOWTIE2_INDEX_PREFIX` | Prefix enam indeks `.bt2` atau `.bt2l`, tanpa suffix; wajib berada dalam reference root. |
| `GENOPATH_PIPELINE_NEXTFLOW_EXECUTABLE` | Path executable Nextflow. |
| `GENOPATH_PIPELINE_FASTP_EXECUTABLE` | Path executable fastp. |
| `GENOPATH_PIPELINE_SAMTOOLS_EXECUTABLE` | Path executable SAMtools. |
| `GENOPATH_PIPELINE_BCFTOOLS_EXECUTABLE` | Path executable BCFtools. |
| `GENOPATH_PIPELINE_NEXTFLOW_PROFILE` | `local`, satu-satunya profile saat ini. |

Mode `nextflow` memerlukan Java, Nextflow (workflow menetapkan minimal 24.10.0),
fastp, Bowtie2 termasuk `bowtie2-inspect`, SAMtools, BCFtools, dan reference/index
yang cocok. Quickstart sintetis tidak memasang tool tersebut.

Adapter menerima `--reads`, `--reference`, `--output`, `--sample-name`, dan
`--threads`, lalu menghasilkan SAM dengan read-group sample yang sesuai.
Adapter Bowtie2 bawaan adalah `app/services/bowtie2_adapter.py`; ia juga menerima
executable Bowtie2/inspect dan prefix index secara eksplisit. Tidak ada indexing
per Job. Adapter membandingkan sekuens/nama contig hasil rekonstruksi indeks
dengan FASTA, bukan hanya filename. SAM memiliki read group sesuai `vcf_sample`.
Downstream menghasilkan BAM terurut, indeks CSI, dan VCF teks. `variant_ploidy`
wajib diberikan: Nextflow mendukung 1 atau 2; angka 2 pada panduan ini hanya
untuk fixture. Persetujuan ilmiah reference/ploidy produksi tetap milik tim.

Runner meluncurkan subprocess tanpa shell, membatasi timeout dan menghentikan
grup proses pada timeout POSIX, serta tidak mewariskan environment kredensial.
Environment subprocess hanya memasok PATH sistem dan dua flag Nextflow; tidak
mewariskan JAVA_HOME/HOME dari terminal backend. Gunakan wrapper eksplisit di
bawah, seperti pada eksekusi biologis CP1–CP4, tanpa melonggarkan runner.

Dispatch memakai FastAPI BackgroundTasks dalam proses. Ini belum queue tahan
restart. Crash dapat menyisakan Job Queued/Running yang perlu rekonsiliasi
operator; tidak ada cancel, auto-resume, atau pengulangan Job Running otomatis.
Direktori run gagal dipertahankan untuk review. Transaksi DB menulis Analysis,
Variant, Genotype, dan status Completed bersama; filesystem/DB tidak atomik.
File tersisa setelah transaksi gagal bukan hasil Completed.
Receipt di `GENOPATH_PIPELINE_ROOT/.submissions` wajib dipertahankan bersama
storage dan database. Receipt hilang tidak dapat direkonstruksi otomatis dan
dapat menyebabkan Sample tambahan ketika upload diulang. File lock memerlukan
filesystem Linux bersama yang mendukung `flock`; root terpisah antar-worker
tidak aman untuk replay. Upload slot bersifat per proses. Batas Nextflow berlaku
per workflow, bukan antrean resource global antar-user. Adapter membatasi address
space 4 GiB, thread 1–4, pemeriksaan index 120 detik, dan alignment 600 detik.
Ini batas smoke test M8, bukan konfigurasi final full genome M10.

Parser `summarize_vcf` tetap menghitung record ALT mentah. Ingestion memakai
satu Variant per record multiallelic (ALT dipertahankan), GT asli dan FORMAT/DP;
INFO/DP tidak menggantikan FORMAT/DP. Missing QUAL/DP dikecualikan walau threshold
nol. FILTER wajib PASS jika `require_pass=true`. Raw counts dan selected counts
terpisah dalam metadata. Belum ada normalisasi/left-alignment atau validasi alel
terhadap reference. VCF UTF-8 tak terkompresi, tepat satu sample dengan nama
cocok persis, dan batas input ingestion 1 GB.

### 7.1 Toolchain QA Linux/WSL

Versi yang berhasil dipakai CP1–CP4: **Temurin Java 21.0.13+9, Nextflow 25.10.9,
fastp 1.0.1, Bowtie2 2.5.4, SAMtools 1.22.1, BCFtools 1.22**. Ini versi bukti,
bukan klaim versi terbaru. Toolchain CP1 berupa instalasi lokal dalam `build/`
yang diabaikan Git. Jangan menyalin path absolut developer ke mesin QA.

Gunakan checkout/storage pada filesystem Linux WSL, bukan `/mnt/c` atau `/tmp`
tmpfs. Periksa `free -h`, `df -h .`, dan `ulimit -a`; RAM WSL dapat berbeda dari
RAM fisik Windows. Jangan mengubah limit/global config untuk melewati error.
Contoh berikut hanya untuk mesin QA sendiri, setelah persetujuan pemasangan
paket. Jika executable sudah tersedia dan sesuai, lewati instalasi:

```bash
apt-cache policy openjdk-21-jre-headless fastp bowtie2 samtools bcftools
sudo apt update
sudo apt install --no-upgrade openjdk-21-jre-headless fastp bowtie2 samtools bcftools curl ca-certificates
java -version
fastp --version
bowtie2 --version
bowtie2-build --version
bowtie2-inspect --version
samtools --version
bcftools --version
```

Paket Ubuntu dapat memiliki patch/version berbeda, termasuk Java OpenJDK alih-alih
Temurin; catat hasil dan verifikasi smoke test pada mesin itu. Jangan mencampur
paket dari rilis Ubuntu lain atau melakukan upgrade distribusi. Untuk Temurin
yang sama dengan bukti, gunakan [rilis resmi Adoptium](https://github.com/adoptium/temurin21-binaries/releases/tag/jdk-21.0.13%2B9)
dan verifikasi checksum upstream sebelum ekstraksi ke direktori lokal baru.

Berikut memakai [distribusi standalone Nextflow](https://docs.seqera.io/nextflow/install)
resmi, tanpa `curl | bash`. Jalankan dari root repository dengan `.venv` aktif,
dalam terminal yang nantinya menjalankan backend. Root baru harus belum ada:

```bash
umask 077
mkdir -p build
export GENOPATH_QA_ROOT="$PWD/build/qa-m8-$(date +%Y%m%d-%H%M%S)"
mkdir "$GENOPATH_QA_ROOT"
mkdir "$GENOPATH_QA_ROOT"/{bin,home,nextflow-home,tmp,uploads,jobs}
export GENOPATH_QA_JAVA_HOME="$(dirname "$(dirname "$(readlink -f "$(command -v java)")")")"
test -x "$GENOPATH_QA_JAVA_HOME/bin/java"
curl --fail --location --output "$GENOPATH_QA_ROOT/bin/nextflow-25.10.9-dist" \
  https://github.com/nextflow-io/nextflow/releases/download/v25.10.9/nextflow-25.10.9-dist
printf '%s  %s\n' 8f3e6efe3b700c298aedf45ba2d5ec0d17bd5f480362b1b46145ea6bfbe46987 \
  "$GENOPATH_QA_ROOT/bin/nextflow-25.10.9-dist" | sha256sum --check
chmod 700 "$GENOPATH_QA_ROOT/bin/nextflow-25.10.9-dist"
python - <<'PY'
import os
import shlex
from pathlib import Path

root = Path(os.environ['GENOPATH_QA_ROOT']).resolve(strict=True)
java = Path(os.environ['GENOPATH_QA_JAVA_HOME']).resolve(strict=True)
environment = {
    'PATH': '/usr/bin:/bin', 'HOME': str(root / 'home'),
    'JAVA_HOME': str(java), 'NXF_JAVA_HOME': str(java),
    'NXF_HOME': str(root / 'nextflow-home'), 'TMPDIR': str(root / 'tmp'),
    'NXF_OPTS': '-Xms64m -Xmx512m', 'NXF_OFFLINE': 'true',
    'NXF_DISABLE_CHECK_LATEST': 'true', 'NXF_PLUGINS_DEFAULT': 'false',
    'NXF_PLUGINS_ALLOWED': '', 'NXF_ANSI_LOG': 'false', 'LANG': 'C.UTF-8',
}
command = ['/usr/bin/env', '-i', *[f'{k}={v}' for k, v in environment.items()],
           str(root / 'bin/nextflow-25.10.9-dist')]
wrapper = root / 'bin/nextflow'
with wrapper.open('x') as stream:
    stream.write('#!/bin/sh\nset -eu\nexec ' + shlex.join(command) + ' "$@"\n')
wrapper.chmod(0o700)
PY
"$GENOPATH_QA_ROOT/bin/nextflow" -version
```

Checksum tersebut berasal dari artefak distribusi yang diverifikasi pada CP1.
Jika tidak cocok, hentikan, jangan menonaktifkan verifikasi. Wrapper memberi
[Java/cache environment eksplisit](https://docs.seqera.io/nextflow/reference/env-vars),
tanpa membawa secret backend. Ia mengasumsikan tool Ubuntu ada pada `/usr/bin`
atau `/bin`; instalasi lokal lain memerlukan wrapper/path dependensi yang
disetujui operator. Jangan menambah inheritance environment pada runner.

### 7.2 Fixture biologis dan konfigurasi backend QA

Gunakan database **baru milik QA** dari bagian 2, terapkan `alembic upgrade head`
bagian 3, lalu lewati bootstrap reference sintetis `tiny.fa` jika hanya mencoba
jalur biologis. Jangan menggunakan database/cluster CP3/CP4 atau database developer.
Gunakan `/auth/register` untuk membuat akun QA dan jangan memasukkan secret ke log.

Helper berikut tidak memasang tool, membuat indeks, atau mengakses database.
Ia menolak direktori output existing dan menghasilkan reference 20.000 bp,
dua haplotype truth, 7.942 reads single-end 150 bp Q40, FASTQ/gzip, `truth.vcf`,
serta `fixture.json` dengan checksum. Seed tetap 20261104, coverage nominal 59,6×.
Truth VCF adalah oracle sintetis, **bukan** keluaran caller.

```bash
python -m scripts.generate_bowtie2_fixture --output-dir "$GENOPATH_QA_ROOT/fixture"
mkdir "$GENOPATH_QA_ROOT/fixture/index"
bowtie2-build --threads 2 --seed 20261104 "$GENOPATH_QA_ROOT/fixture/reference.fa" \
  "$GENOPATH_QA_ROOT/fixture/index/fixture"
bowtie2-inspect -s "$GENOPATH_QA_ROOT/fixture/index/fixture"

export GENOPATH_UPLOAD_ROOT="$GENOPATH_QA_ROOT/uploads"
export GENOPATH_REFERENCE_ROOT="$GENOPATH_QA_ROOT/fixture"
export GENOPATH_PIPELINE_ROOT="$GENOPATH_QA_ROOT/jobs"
export GENOPATH_PIPELINE_ENABLED=true
export GENOPATH_PIPELINE_ALLOW_SYNTHETIC=false
export GENOPATH_PIPELINE_THREADS=2
export GENOPATH_PIPELINE_TIMEOUT_SECONDS=180
export GENOPATH_PIPELINE_ALIGNMENT_STRATEGY=bowtie2
export GENOPATH_PIPELINE_ALIGNMENT_ADAPTER="$PWD/app/services/bowtie2_adapter.py"
export GENOPATH_PIPELINE_BOWTIE2_EXECUTABLE="$(command -v bowtie2)"
export GENOPATH_PIPELINE_BOWTIE2_INSPECT_EXECUTABLE="$(command -v bowtie2-inspect)"
export GENOPATH_PIPELINE_BOWTIE2_INDEX_PREFIX="$GENOPATH_QA_ROOT/fixture/index/fixture"
export GENOPATH_PIPELINE_NEXTFLOW_EXECUTABLE="$GENOPATH_QA_ROOT/bin/nextflow"
export GENOPATH_PIPELINE_FASTP_EXECUTABLE="$(command -v fastp)"
export GENOPATH_PIPELINE_SAMTOOLS_EXECUTABLE="$(command -v samtools)"
export GENOPATH_PIPELINE_BCFTOOLS_EXECUTABLE="$(command -v bcftools)"
export GENOPATH_PIPELINE_NEXTFLOW_PROFILE=local
```

Prefix harus memiliki tepat enam file `.bt2` atau `.bt2l` yang tidak kosong,
tidak boleh campuran. Prefix ini konfigurasi operator, bukan input path dari
klien; reference lain harus cocok dengan indeks atau Job akan gagal. Tidak perlu
memaksa format `.bt2l` pada fixture QA rutin. Angka timeout di atas untuk fixture
kecil; jangan menggunakannya sebagai estimasi full genome. Gunakan path Linux
tanpa karakter shell khusus dan tanpa symlink pada input/root storage.

Karena Reference API belum ada, tambahkan tepat satu row pada **database QA baru**.
Contoh ini memakai nama database bagian 2 dan memeriksa revision serta reference
kosong sebelum insert. Jika bootstrap sintetis sudah dijalankan, jangan hapus
row lama atau melewati guard; siapkan target QA baru secara sadar.

```bash
python - <<'PY'
from sqlalchemy import select, text
from sqlalchemy.orm import Session
from app.core.config import Settings
from app.database import get_engine
from app.models import ReferenceGenome
from app.services.pipeline import confined_file

settings = Settings()
fasta = confined_file(settings.reference_root, 'reference.fa')
engine = get_engine(settings.database_url)
with Session(engine) as db, db.begin():
    if db.scalar(text('SELECT current_database()')) != 'genopath_m8_local':
        raise SystemExit('Ditolak: target bukan database QA baru dari bagian 2.')
    if db.scalar(text('SELECT version_num FROM public.alembic_version')) != '0004_m9_result_indexes':
        raise SystemExit('Ditolak: migrasi belum sampai head.')
    if db.scalar(select(ReferenceGenome.id_reference_genome).limit(1)) is not None:
        raise SystemExit('Ditolak: reference sudah terisi; jangan seed ulang.')
    reference = ReferenceGenome(nama_genom='QA controlled 20kb, not Garlic.V2',
                               versi='20261104', sumber='Deterministic QA fixture',
                               path_fasta=str(fasta))
    db.add(reference)
    db.flush()
    identifier = reference.id_reference_genome
engine.dispose()
print('Reference ID QA:', identifier)
PY
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Simpan root/path konfigurasi untuk menjalankan ulang server. Jangan membuat root
baru ketika memulihkan submission lama. Root dan receipt harus tetap sama.

### 7.3 Satu submission otomatis dan pemeriksaan hasil

Pada Swagger, login dan Authorize seperti bagian 4, lalu pilih
`POST /samples/upload-and-run`. Multipart berisi tepat satu field `file` berupa
`reads.fastq` atau `reads.fastq.gz`. **Sembilan query parameter wajib**:

| Parameter | Nilai fixture / sumber |
| --- | --- |
| `id_reference_genome` | ID aktual dari bootstrap QA, jangan hardcode `1`. |
| `request_id` | UUID baru; simpan untuk replay submission yang sama. |
| `vcf_sample` | `m8_fixture_diploid` |
| `parameter_qual` | `30` |
| `parameter_dp` | `10` |
| `require_pass` | `true` |
| `execution_mode` | `nextflow` |
| `variant_ploidy` | `2`, hanya untuk fixture ini. |
| `alignment_strategy` | `bowtie2`, harus cocok dengan konfigurasi server. |

Contoh HTTP berikut memakai `httpx` dari dependency dev. Jalankan di terminal
kedua dari root clone dengan `.venv` aktif; masukkan root QA yang sama saat diminta.
JWT hanya berada di memori. Password diminta tersembunyi, bukan argumen shell.
Untuk UUID baru, jalankan `python -c 'import uuid; print(uuid.uuid4())'` dan simpan
nilainya. Registrasi akun dilakukan sekali melalui `/auth/register`.

```bash
python - <<'PY'
import getpass
import json
import time
from pathlib import Path
from uuid import UUID
import httpx

root = Path(input('Root QA yang sudah dibuat: ')).resolve(strict=True)
request_id = str(UUID(input('UUID submission baru atau replay identik: ')))
parameters = {
    'id_reference_genome': int(input('Reference ID QA: ')), 'request_id': request_id,
    'vcf_sample': 'm8_fixture_diploid', 'parameter_qual': 30, 'parameter_dp': 10,
    'require_pass': 'true', 'execution_mode': 'nextflow', 'variant_ploidy': 2,
    'alignment_strategy': 'bowtie2',
}
name = input('File fixture (reads.fastq atau reads.fastq.gz): ')
if name not in ('reads.fastq', 'reads.fastq.gz'):
    raise SystemExit('Pilih salah satu file fixture.')
with httpx.Client(base_url='http://127.0.0.1:8000', timeout=240) as client:
    login = client.post('/auth/login', json={
        'username': input('Username QA: '), 'password': getpass.getpass('Password akun QA: '),
    })
    if login.status_code != 200:
        raise SystemExit(f'Login gagal: HTTP {login.status_code}; token tidak ditampilkan.')
    headers = {'Authorization': 'Bearer ' + login.json()['access_token']}
    with (root / 'fixture' / name).open('rb') as stream:
        response = client.post('/samples/upload-and-run', params=parameters, headers=headers,
                               files={'file': (name, stream, 'application/octet-stream')})
    body = response.json()
    print('Submission HTTP', response.status_code, json.dumps(body))
    if response.status_code != 202:
        raise SystemExit('Periksa kebijakan error/replay di bawah sebelum mengulang.')
    job_id = body['job']['id_job']
    deadline = time.monotonic() + 240
    while time.monotonic() < deadline:
        status_response = client.get(f'/jobs/{job_id}', headers=headers)
        status_response.raise_for_status()
        status = status_response.json()
        print('Job', job_id, status['status'])
        if status['status'] in ('Completed', 'Failed'):
            break
        time.sleep(1)
    else:
        raise SystemExit('Polling timeout; periksa Job yang sama, jangan upload ulang.')
    if status['status'] != 'Completed':
        raise SystemExit('Job Failed; periksa pesan aman dan log run, jangan ganti UUID untuk upload ulang.')
    for endpoint in ('result', 'variants'):
        result = client.get(f'/jobs/{job_id}/{endpoint}', headers=headers)
        result.raise_for_status()
        print(endpoint, json.dumps(result.json()))
PY
```

Tidak ada pemanggilan `/start`. HTTP **202** berarti submission diterima atau
direplay; Job pada respons dapat masih `Queued`. Poll status hingga terminal.
`dispatch_scheduled=true` berarti task dijadwalkan dalam proses, bukan selesai.
`Completed` hanya ditulis bersama persistensi hasil. Result API memerlukan JWT
pemilik; cocokkan Sample/Reference/Job/Analysis ID dari respons aktual.

Expected result dengan threshold di atas: **2 Variant dan 2 Genotype, 1 SNP dan
1 InDel, other 0**, pada `fixture_chr1`: SNP **5001 A>C** dan insertion
**12001 A>ACGT**. Pada versi tool bukti: GT `0/1`, FORMAT/DP `60`, QUAL `222.406`,
FILTER `PASS`. Truth menyimpan fase `0|1`, sedangkan caller menghasilkan GT
unphased; jangan menuntut phase separator sama. QUAL dapat berubah jika versi
tool berubah. Ini smoke test tool biologis pada input terkontrol, bukan validasi
akurasi ilmiah atau kapasitas full genome. Untuk gzip gunakan UUID baru setelah
Job pertama terminal; expected variants sama. Jangan memakai ulang UUID plain
untuk file gzip karena fingerprint byte dan filename berbeda.

Untuk memeriksa artefak lokal, query database QA sendiri dengan Job ID aktual:

```sql
-- Ganti 1 dengan Job ID dari respons submission.
SELECT id_job, parameter_pipeline->>'run_id' AS run_id
FROM public.job WHERE id_job = 1;
```

Direktori run adalah `GENOPATH_PIPELINE_ROOT/<run_id>`, bukan direktori terbaru
yang ditebak. Pada direktori run itu:
`samtools quickcheck -v sorted.bam`, `samtools view -H sorted.bam` (SO coordinate
dan RG/SM sesuai sample), `samtools idxstats sorted.bam` dengan `sorted.bam.csi`,
serta `bcftools view result.vcf`. Ingestion menyimpan `selected.vcf`; query SQL
bagian 4 dan Result API harus menunjukkan jumlah/GT/DP yang sama. Raw VCF dapat
memiliki FILTER `.`; workflow memberi `PASS` pada yang lolos dan
`LowQualOrDepth` pada missing/di bawah QUAL atau FORMAT/DP. Ingestion mengecualikan
missing QUAL/DP dan, jika `require_pass=true`, semua record selain PASS.

Kebijakan error dan replay (jangan hanya memeriksa status HTTP):

| Hasil | Tindakan |
| --- | --- |
| 202 `accepted` / `replayed` | Simpan ID; poll Job. Replay Completed/Failed tidak menjalankan ulang. |
| 400 / 413 / 415 | Multipart rusak, batas resource, atau media type salah; periksa error dan keadaan submission sebelum mengulang. |
| 401 | Login ulang, gunakan akun pemilik dan UUID submission yang sama jika melanjutkan. |
| 422 | `detail` dapat berupa daftar validation error yang disanitasi atau string error FASTQ/konfigurasi. Input invalid tidak membuat Job; UUID yang sudah mendapat receipt `rejected` memerlukan UUID baru untuk koreksi. |
| 409 dengan `detail` string | Konflik parameter/file UUID, lock sibuk, atau Job aktif. Jangan mengubah payload UUID yang sudah dipakai; poll/reconcile dahulu. |
| 409/503 `sample_stored` | Sample dipertahankan. Perbaiki penyebab, lalu ulang dengan UUID, seluruh parameter, filename, dan byte file **identik**; jangan unggah ke M7 sebagai jalan pintas. |
| 503 `reconciliation_required`, timeout, atau respons terputus | Hasil commit/dispatch dapat ambigu. Pertahankan receipt, file dan ID, periksa Job jika diketahui, minta operator merekonsiliasi. Jangan memakai UUID baru untuk mengulang upload. |

Hashing membaca file per 1 MiB; multipart/upload tetap berbatas, tetapi ada satu
pass pembacaan tambahan. Belum ada benchmark upload 1 GB. Pengujian SQLite/mocks
default tidak menggantikan bukti PostgreSQL atau tool biologis. Konfirmasi PM/SA
bahwa endpoint tambahan memenuhi auto-trigger masih diperlukan; endpoint M7 lama
tetap upload-only dan FE belum diubah untuk memakai jalur baru.

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
adalah tooling opt-in terpisah, bukan jalur setup M8. Registrasi sudah tersedia;
kebijakan pendaftaran deployment publik tetap belum diputuskan dan frontend
tidak diubah.
