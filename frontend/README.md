# Frontend GenoPath M11

GenoPath adalah aplikasi web analisis varian genom bawang putih (*Allium sativum*), dikembangkan Kelompok 1 PPL Bioinformatika IPB University. Aplikasi membantu pengguna menjalankan analisis tanpa menggunakan command line.

Alur utama: **login/register → pilih FASTQ → konfigurasi → jalankan analisis → monitoring → tinjau hasil → unduh VCF/CSV**.

Branch `feature/m11-impeccable` adalah **shared frontend foundation berstatus PROPOSED**, bukan produk final. Fondasi ini melanjutkan integrasi M10 (`8b71771aaa10eed2f59142d70408759fdda17357`), dengan navigasi horizontal, Dashboard berbasis analysis records, komponen bersama, light/dark mode, dan ilustrasi workflow beranimasi. Halaman masih dapat berkembang setelah review tim.

Baca juga [PRODUCT.md](../PRODUCT.md) untuk konteks produk dan [DESIGN.md](../DESIGN.md) untuk panduan visual. README ini menjadi panduan kontribusi, bukan pengganti kontrak API atau SKPL.

## Stack aktual

| Bagian | Implementasi |
| --- | --- |
| UI dan bahasa | React, TypeScript, ikon Lucide |
| Build | Vite; `tsc -b` sebelum production build |
| Styling | CSS tokens, CSS komponen/workspace, Tailwind CSS, PostCSS |
| Routing | React Router, `BrowserRouter` dan route terpusat di `src/App.tsx` |
| API client | Native `fetch` melalui `src/services/api.ts`; Axios tercantum sebagai dependency tetapi bukan client utama |
| Authentication | JWT Bearer; `AuthContext` dan profil persisten dari `GET /auth/me` |
| Testing | Vitest, Testing Library, jsdom; ESLint untuk lint |
| Backend | FastAPI untuk API dan ownership, PostgreSQL untuk penyimpanan, Nextflow untuk orkestrasi pipeline |

Versi/range dependency berada di [package.json](./package.json), resolusi terkunci di [package-lock.json](./package-lock.json). Jangan memperbarui dependency sebagai bagian pekerjaan halaman tanpa koordinasi.

## Struktur frontend

Path berikut relatif terhadap direktori `frontend/`.

```text
index.html                      Entry HTML
src/main.tsx                    Mount React dan urutan import stylesheet
src/App.tsx                     Providers, route dan authentication guard
src/components/Layout.tsx       Shell, breadcrumb, skip link dan footer
src/components/Navbar.tsx       Navigasi horizontal dan menu akun
src/components/BrandIdentity.tsx Wordmark dan logo prototype
src/components/ui/Foundation.tsx Primitive UI bersama
src/components/analysis/         AnalysisRecord, AnalysisProvenance,
                                JobTable dan ResultOverview
src/components/ContextHelp.tsx   Bantuan hover/focus/tap melalui portal
src/components/PipelineHero.*    Ilustrasi workflow landing page
src/components/TeamSection.tsx   Identitas, aset dan interaksi kontributor
src/pages/                      Implementasi halaman aktif
src/context/                    AuthContext, ThemeContext dan hooks context
src/hooks/                      Polling Job dan adaptasi komposisi layar sempit
src/services/api.ts             DTO, request, upload, hasil dan download
src/services/submissionDraft.ts  Metadata submission, UUID dan recovery
src/services/resultExport.ts    Helper CSV halaman lama, bukan ekspor server aktif
src/services/displayText.ts     Normalisasi teks tampilan
src/styles/tokens.css           Token light/dark dan typography
src/index.css                   Fondasi existing dan utility styles
src/styles/workspace.css        Komposisi serta interaksi workspace
src/assets/                     Gambar/cutout anggota dan aset existing
public/                         Background kampus, motif bawang, fonts,
                                prototype logo, favicon dan aset statis
public/fonts/                   Font lokal Sora/Instrument Sans dan lisensi OFL
tests/                          Regression tests (*.test.ts/tsx) dan setup
vite.config.ts                  Dev server dan proxy /api
vitest.config.ts                Konfigurasi test jsdom
```

`main.tsx` mengimpor `tokens.css`, `index.css`, lalu `workspace.css`. Periksa cascade sebelum menambahkan style. Beberapa komponen lama masih ada untuk konteks historis; periksa import dan route sebelum menganggapnya sebagai halaman aktif.

## Halaman, route dan data

Semua path API di tabel adalah path backend. Browser memakai prefix `/api`, yang dipotong oleh proxy.

| Route | Komponen di `src/pages/` | Tanggung jawab dan API |
| --- | --- | --- |
| `/` | `LandingPage.tsx` | Informasi produk, foto kampus, ilustrasi pipeline dan Team Section; ilustrasi bukan progress Job |
| `/login` | `LoginPage.tsx` | Login dan tab registrasi: `POST /auth/login`, `POST /auth/register`; profil melalui `GET /auth/me` |
| `/dashboard` | `DashboardPage.tsx` | `GET /jobs`, Completed terbaru, perhatian untuk Job aktif/gagal, provenance dan `GET /jobs/{id}/result` untuk ringkasan aktual |
| `/riwayat` | `HistoryPage.tsx` | `GET /jobs`, pencarian nama/nomor analisis dan filter status milik akun aktif |
| `/analisis-baru` | `NewAnalysisPage.tsx` | `GET /jobs/options` untuk reference, ploidi dan batas runtime; submission eksplisit `POST /samples/upload-and-run` |
| `/jobs/:jobId` | `JobMonitoringPage.tsx` | `GET /jobs/{id}`, polling status, identitas analisis, waktu dan pesan kegagalan |
| `/jobs/:jobId/result` | `JobResultPage.tsx` | `GET /jobs/{id}/result`, `GET /jobs/{id}/variants`, filter/pagination dan unduhan `/jobs/{id}/vcf` serta `/jobs/{id}/csv` |

Route kerja memerlukan autentikasi. Route tidak dikenal kembali ke Beranda. URL memakai **ID Job global**; label menampilkan nama analisis dan nomor persisten per akun. Jangan menukar dua identitas tersebut.

Dashboard memilih Completed terbaru menurut waktu selesai, dengan ID sebagai tie-breaker; jika belum ada, fokus dapat memakai Job aktif. Ringkasan diambil dari Result API, bukan angka turunan rekaan. `useJobPolling` memakai interval 4 detik dengan abort/cleanup. Jangan menambahkan polling kedua untuk data yang sama.

Login menggunakan JSON `username` dan `password`; registrasi juga membutuhkan `nama` dan `email`. Nama lengkap berasal dari `/auth/me`, bukan turunan username. Token tersimpan di localStorage dan dikirim melalui header Authorization. Jangan mencetak token, memasukkannya ke URL, atau mengubah penanganan sesi untuk kebutuhan visual. Proteksi UI tidak menggantikan pemeriksaan ownership backend.

## Design system dan identitas produk

Arah M11 adalah **professional scientific research workspace**: konteks record analisis, provenance yang tersedia, data ilmiah terbaca, navy/mineral dengan aksen botani. Ini arah bersama yang dapat dikembangkan, bukan spesifikasi visual yang dibekukan.

- Pertahankan navigasi horizontal dan konteks breadcrumb. Koordinasikan perubahan route di `App.tsx`.
- Gunakan token semantik `--gp-*`, termasuk pasangan light/dark. Jangan membuat palet terpisah untuk setiap halaman.
- Sora memberi hierarki judul, Instrument Sans untuk kerja, monospace untuk nilai ilmiah. Gunakan surface/grouping seperlunya, bukan nested cards berlebihan.
- Gunakan `Button`, `FormField`, `PageHeader`, `Alert`, `StatePanel`, `StatusBadge`, `TableFrame` dan `Pagination` dari `Foundation.tsx`. Tetapkan `type` tombol dalam form; hubungkan label/hint/error melalui `htmlFor`, `aria-describedby` dan `aria-invalid`.
- Pakai `AnalysisRecord`/`AnalysisProvenance`, `JobTable` dan `ResultOverview` untuk konteks analisis yang konsisten. Nilai yang tidak tersedia tidak boleh berubah menjadi nol atau placeholder ilmiah.
- `ContextHelp` mendukung hover, focus, tap, Escape dan outside click. Pertahankan portal agar bantuan tidak terpotong.
- Label, hint/error, focus terlihat, urutan keyboard, kontras, table scroll dan reflow mobile wajib dijaga. Dashboard memindahkan perhatian aktif/gagal sebelum hasil pada layar sempit melalui `useNarrowWorkspace`, termasuk urutan DOM.
- Motion memberi feedback hover/press, upload dan disclosure. `PipelineHero` menggambarkan empat tahap konseptual, dapat dijeda, berhenti saat tidak terlihat, serta memiliki alternatif statis reduced-motion. Jangan mengubahnya menjadi progress pipeline palsu.
- Gunakan bahasa Indonesia ringkas. **Jangan gunakan em dash U+2014 atau en dash U+2013 pada teks aplikasi.**

### Kontribusi tim yang diteruskan

Frontend awal banyak dikembangkan Azril, termasuk visual Beranda, foto kampus, botanical garlic background, Team Section, Naruto placeholders, cutout, mapping nama/NIM, animasi wave-letter dan hover interactions. Aset sumber berada di `public/` dan `src/assets/`; presentasi tim di `TeamSection.tsx`.

**Preserve the value and continuity of existing contributions, not necessarily every line of code.** Refactor dan perubahan desain boleh dilakukan jika meningkatkan usability atau maintainability. Hindari wholesale rewrite yang membuang kontribusi tanpa alasan. Pertahankan identitas anggota dan mapping gambar saat mengubah komposisi. Naruto adalah placeholder, bukan foto anggota. Logo prototype dari eksplorasi sketsa Azril masih provisional, bukan identitas resmi final.

## Kontrak integrasi dan scope biologis

- Input aktif adalah **FASTQ single-end**, `.fastq` atau `.fastq.gz`. Aligner aktif **Bowtie2**, dengan fastp, SAMtools dan BCFtools melalui Nextflow. Paired-end dan BWA-MEM2 bukan scope implementasi aktif.
- Frontend memeriksa ekstensi, file kosong dan ukuran sesuai opsi server; validasi isi FASTQ dilakukan backend. Memilih, mengganti atau membatalkan pilihan file tidak boleh memicu upload/Job ataupun meninggalkan status file lama yang menyesatkan. Input file tetap uncontrolled; jangan menambahkan `value` yang merusak cancel dan reset.
- Pertahankan UUID, metadata submission yang dibekukan, receipt, replay dan recovery/reconciliation. Jangan membuat UUID baru atau mengirim ulang secara membabi buta ketika hasil request ambigu. Draft recovery tersimpan per username di sessionStorage.
- Nama analisis, reference, ploidi, QUAL dan FORMAT/DP dikonfigurasi sebelum submission. Default UI QUAL 30 dan FORMAT/DP 10, `FILTER=PASS`; jangan mengubah default atau handler hanya untuk desain. Threshold eksekusi berbeda dari filter tampilan hasil.
- Status `Queued`, `Running`, `Completed`, `Failed`, parameter, counts dan metadata harus berasal dari API. Jangan membuat persentase tahap, checksum, reference, genotype atau statistik dummy.
- Result Viewer memakai filter dan pagination server-side. Pertahankan ALT multiallelic, GT, QUAL, DP, null dan `next_offset: null` sesuai respons; jangan menormalkan data biologis untuk tampilan.
- VCF merupakan artefak hasil analisis terkait, bukan ekspor filter tampilan saat ini. CSV mencakup seluruh hasil yang cocok dengan filter server yang diminta, lintas halaman. Gunakan filename dari server, header JWT, serta perilaku download yang sudah ada; jangan merekonstruksi file atau token query.

**Bukti yang tersedia:** runtime M10 pernah menjalankan pipeline nyata menggunakan fixture sintetis dengan reference sekitar 20 kbp. Ini bukan validasi biologis Garlic.V2 atau benchmark biologis nyata. Full Garlic.V2 dan FASTQ 1 GB belum dinyatakan tervalidasi.

Pilihan reference di UI berasal dari catalog API; keberadaan pilihan tersebut tidak membuktikan multi-reference processing sudah berfungsi. Annotation, visualisasi distribusi varian dan QC metrics masih bergantung pada perkembangan implementasi. Jangan mengklaimnya tersedia atau membuat representasi fiktif.

Runtime demo memiliki batas tersendiri: upload 10 MiB dan satu Job aktif global. Angka tersebut bukan kapasitas produksi; UI membaca batas upload dari `/jobs/options`. Contoh FASTQ sintetis melalui `/demo/reads.fastq.gz` adalah fasilitas runtime demo, bukan endpoint yang dijamin tersedia di semua instalasi. Informasi keterbatasan tetap ditampilkan secara kontekstual pada input, reference dan hasil.

## Local development

Gunakan Node.js yang kompatibel dengan dependency terkunci. Vite saat ini mensyaratkan Node `^20.19.0 || >=22.12.0`; fondasi dikembangkan dengan Node 24. Gunakan npm dan pertahankan lockfile.

### Clone dan buat branch pekerjaan

```bash
git clone --origin github --branch feature/m11-impeccable https://github.com/Pembangunan-Perangkat-Lunak-BIF-IPB/kelompok-01.git genopath
cd genopath
# CONTOH nama branch. Sesuaikan dengan tugas yang dikonfirmasi PM.
git switch -c feature/m11-halaman-nama
cd frontend
npm ci
npm run dev -- --host 127.0.0.1 --port 5173
```

Buka `http://localhost:5173`. Konfigurasi Vite default memakai port 3000; contoh memakai 5173 agar tidak bertabrakan dengan runtime demo. Periksa output Vite untuk port aktual.

`src/services/api.ts` mengakses `/api` secara same-origin. `vite.config.ts` meneruskan `/api` ke `http://127.0.0.1:8000` dan memotong prefix tersebut. Jika backend memakai alamat lain, koordinasikan target proxy lokal; jangan memasukkan credential ke source atau mengasumsikan ada konfigurasi `VITE_API_URL` yang belum diimplementasikan. Jika mengakses backend langsung dari origin berbeda, koordinasikan konfigurasi CORS; jangan menonaktifkan proteksi akses.

Backend diperlukan untuk login, data akun, upload, monitoring dan hasil. Setup FastAPI/PostgreSQL mengikuti [README repository](../README.md) dan koordinasi integrator. Tidak semua kontributor perlu menjalankan Nextflow atau pipeline biologis; gunakan runtime/backend yang disepakati dan data Completed yang sah untuk validasi baca. Jangan mengubah database utama, mengunggah data pengguna ke chat, atau membuat backend mock sebagai hasil ilmiah.

```bash
# Jalankan dari frontend/
npm run lint
npm test
npm test -- tests/NewAnalysisPage.test.tsx  # CONTOH test terarah
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

`npm test` menjalankan Vitest sekali, bukan watch mode. `npm run preview` menyajikan build untuk pemeriksaan statis; proxy API pada `server.proxy` ditujukan untuk development. Jangan menganggapnya sebagai deployment production terintegrasi. Hosting SPA harus mendukung fallback direct URL dan proxy `/api` yang benar.

Preview host terintegrasi opsional tersedia melalui `scripts/preview_frontend.py`, dijalankan sebagai `python -B -m scripts.preview_frontend --m10-root <worktree-demo> --port 3001` dari root repository dengan environment Python backend. Launcher ini memerlukan runtime M10 loopback port 3000 dan konfigurasi gate existing, tanpa menjalankan DB/pipeline baru. Ini fasilitas host integrator, bukan syarat setup semua kontributor. Jangan menjalankan proses duplikat. Jika perlu sesi gate, opsi `--unlock` meminta password existing melalui terminal tersamar. Jangan mengirim password ke chat; password gate berbeda dari akun GenoPath. Sesi privat tersimpan di `.runtime/`, yang harus tetap diabaikan Git.

## Workflow kolaborasi Git

Pembagian halaman ditetapkan PM, bukan oleh README ini. Dashboard, Riwayat/Result Viewer dan Analisis Baru dapat dikembangkan paralel pada file halamannya. Monitoring juga memiliki halaman tersendiri; koordinasikan perubahan bila terkait tugas Anda.

Untuk clone existing, periksa `git status` dan `git remote -v` dahulu. Contoh berikut memakai remote `github`; sesuaikan jika nama remote clone Anda berbeda. Jangan memindahkan branch dengan perubahan lokal yang belum diamankan.

```bash
git fetch github
# CONTOH, buat branch baru dari foundation terbaru, bukan otomatis development/main.
git switch -c feature/m11-halaman-nama github/feature/m11-impeccable
# Kerjakan tugas, jalankan validasi, lalu commit perubahan terkait saja.
git add -p frontend/
# Periksa dan pilih hanya perubahan yang terkait tugas Anda.
git commit -m "feat(fe): perbarui halaman sesuai tugas"
git push -u github HEAD
```

- Commit/push hanya ke branch pekerjaan sendiri. Jangan commit langsung ke shared foundation, force push, atau merge sendiri ke `development`/`main`.
- Kirim branch untuk review dan integrasi oleh integrator. Jika memakai PR, targetnya `feature/m11-impeccable` atau branch integrasi yang ditentukan, bukan otomatis `development`/`main`.
- Koordinasikan perubahan shared files: `App.tsx`, `Layout`, `Navbar`, `components/ui/`, `components/analysis/`, styles/tokens, polling, serta layanan API/auth/submission. Gunakan props/children dan primitive existing; jangan menggandakan Button atau tabel hanya untuk menghindari koordinasi.
- Perubahan backend, API contract dan pipeline memerlukan koordinasi terpisah. Jangan mengubahnya untuk mengakomodasi layout.
- Sebelum handoff: lint, tests relevan dan build; cek desktop/mobile, light/dark, keyboard/reduced motion, error/empty/loading states, serta alur terkait. Untuk perubahan shared, jalankan seluruh frontend tests. Jelaskan apa yang diuji, apa yang belum dan file yang berubah.
- Jangan commit `.env`, secret, JWT, sesi, `.runtime/`, `.tools/`, `node_modules/`, `dist/`, database, dataset, index/reference besar, screenshot review atau output Nextflow. Periksa `git diff --cached` sebelum commit.

## Panduan Singkat untuk AI Assistant

Salin konteks berikut saat meminta bantuan, lalu tambahkan tugas dan file yang relevan:

> GenoPath adalah aplikasi analisis varian genom Allium sativum, React/TypeScript/Vite, dengan FastAPI, JWT, PostgreSQL dan Nextflow. Saya mengerjakan frontend dari foundation `feature/m11-impeccable`, bukan produk final. Baca README, PRODUCT.md, DESIGN.md dan source terkait sebelum mengusulkan perubahan. Route di App.tsx, shared shell/primitive di components/, styles/tokens di styles/, API client dan DTO di services/api.ts, auth di context/, tests di tests/. Gunakan komponen existing, navigasi horizontal, light/dark, aksesibilitas dan reduced-motion. Pertahankan nilai kontribusi Azril, aset kampus/bawang/tim, mapping anggota dan animasi yang relevan. Gunakan data API nyata; jangan membuat statistik, progress atau fitur ilmiah fiktif. Pertahankan upload single-end, validasi state file, UUID/recovery, parameter Advanced, ownership, filter/pagination dan ekspor. Jangan mengubah backend, database, API atau pipeline tanpa koordinasi. Buat perubahan terarah dalam scope tugas, minimalkan kerja manual, hindari em/en dash, dan jelaskan validasi serta keterbatasannya. Jika Anda hanya menerima README melalui chat, jangan mengasumsikan akses repository: minta file source yang dibutuhkan, bukan mengarang implementasi. Sebelum menyerahkan hasil, jalankan atau minta bukti lint, test relevan, build dan pemeriksaan UI yang terdampak. Jangan mengklaim pengujian yang tidak dijalankan.

## Status dan langkah berikutnya

Fondasi M11 siap menjadi titik awal pengembangan paralel, dengan desain **PROPOSED** yang masih menerima review tim. Halaman dapat dikembangkan sesuai pembagian PM; integrasi final dan polishing dilakukan setelah perubahan anggota direview dan digabungkan. Pengembangan backend biologis merupakan workstream terpisah. Milestone M11 dan MVP final belum dinyatakan selesai seluruhnya. Perbarui dokumentasi ini jika struktur, route, runtime atau kontrak API berubah.
