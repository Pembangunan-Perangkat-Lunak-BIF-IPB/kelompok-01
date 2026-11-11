---
name: "GenoPath"
description: "Stasiun riset kampus untuk analisis varian Allium sativum."
colors:
  bg: "#f2f3ee"
  surface: "#fcfcf8"
  subtle: "#e8ece5"
  text: "#172e30"
  muted: "#536765"
  border: "#cbd6d1"
  control-border: "#718795"
  brand: "#245b8f"
  brand-hover: "#19466f"
  link: "#205787"
  focus: "#2877b5"
  selected: "#e3edf6"
  success: "#216342"
  success-bg: "#e8f3eb"
  warning: "#7d4c0a"
  warning-bg: "#fff3da"
  danger: "#a32f42"
  danger-bg: "#fceef0"
  rail: "#102f45"
  rail-muted: "#b4c8d7"
  botanical: "#365d42"
  botanical-soft: "#e8f0df"
  rail-botanical: "#d9e8b8"
  sheet-rule: "#526e64"
  rail-selected: "#23464e"
  dark-bg: "#111f24"
  dark-surface: "#192b30"
  dark-subtle: "#22363a"
  dark-text: "#e9f0f5"
  dark-muted: "#b3c4d0"
  dark-border: "#3a5262"
  dark-control-border: "#7793a6"
  dark-brand: "#8bc4ee"
  dark-brand-hover: "#b1d9f5"
  dark-link: "#9dcef2"
  dark-focus: "#a6d8fc"
  dark-selected: "#28485f"
  dark-success: "#a4d9b8"
  dark-success-bg: "#203e33"
  dark-warning: "#f0d18c"
  dark-warning-bg: "#493c22"
  dark-danger: "#ffb5c0"
  dark-danger-bg: "#4c2934"
  dark-rail: "#0a1d2b"
  dark-rail-muted: "#b4c8d7"
  dark-botanical: "#c5dcb1"
  dark-botanical-soft: "#293e33"
  dark-rail-botanical: "#d9e8b8"
  dark-sheet-rule: "#94b9a3"
  dark-rail-selected: "#23464e"
typography:
  display:
    fontFamily: "Sora, 'Instrument Sans', sans-serif"
    fontSize: "clamp(36px, 3.8vw, 56px)"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Sora, 'Instrument Sans', sans-serif"
    fontSize: "clamp(32px, 2.6vw, 44px)"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Sora, 'Instrument Sans', sans-serif"
    fontSize: "21px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.025em"
  body:
    fontFamily: "'Instrument Sans', system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "'Instrument Sans', system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.6
  action:
    fontFamily: "'Instrument Sans', system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.4
  data:
    fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  panel: "12px"
  control: "8px"
  status: "5px"
  table: "14px"
  sheet: "16px"
  toolbar: "14px"
  flat: "0px"
spacing:
  base: "8px"
  section: "24px"
  page: "32px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.surface}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "10px 18px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.brand-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "10px 18px"
    height: "48px"
  button-secondary-hover:
    backgroundColor: "{colors.subtle}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.link}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "10px 18px"
    height: "48px"
  button-ghost-hover:
    backgroundColor: "{colors.subtle}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "10px 13px"
    height: "46px"
  review-summary:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.sheet}"
    padding: "0px"
  analysis-sheet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    padding: "26px 28px 0"
  status-completed:
    backgroundColor: "{colors.success-bg}"
    textColor: "{colors.success}"
    rounded: "{rounded.status}"
    padding: "4px 10px"
  table-frame:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.table}"
---

# Design System: GenoPath

## Overview

**Creative North Star: "Stasiun riset GenoPath"**

Ruang kerja kampus untuk analisis genom yang menempatkan record analisis, sumber data dan tindakan berikutnya di depan. Navigasi horizontal tinta biru memberi orientasi; kanvas mineral hangat, lembar analisis dan garis pembagi menjaga halaman kerja tenang. Beranda lebih ekspresif melalui judul editorial dan foto kampus asli.

Dokumen ini merekam overhaul M11 berstatus PROPOSED. Arah code-led sudah dipilih pengguna; penerimaan visual akhir oleh tim masih menunggu review. PRODUCT.md memegang kebenaran produk dan surface brief memegang strategi halaman. Nilai runtime berasal dari frontend/src/styles/tokens.css, dengan aturan komponen dan cascade pada index.css serta styles/workspace.css.

**Key Characteristics:**

- Navigasi horizontal, kanvas luas dan lembar analisis dengan provenance.
- Sora untuk orientasi, Instrument Sans untuk kerja, monospace untuk nilai ilmiah.
- Status nyata dan tindakan eksplisit; tidak membuat metrik atau hasil contoh.
- Satu fondasi light/dark untuk halaman yang dikerjakan tiga developer.

## Colors

Biru mineral memandu tindakan di atas netral mineral hangat. Hijau botani memberi identitas dan garis lembar; pasangan hijau, amber dan merah semantik menjelaskan keadaan. Nilai normatif berada di frontmatter, mengikuti nama token runtime tanpa prefix `--gp-`; prefix `dark-` merekam override `.dark`.

### Primary

- **Biru mineral:** `brand` untuk tindakan utama, `brand-hover` untuk hover, `link` untuk tautan dan `focus` untuk outline keyboard. Pasang dengan token `dark-` yang sepadan pada mode malam.
- **Tinta stasiun:** `rail` untuk latar navigasi horizontal; `rail-selected` menandai tujuan aktif dengan teks terang pada kedua mode. `rail-botanical` tetap menjadi aksen wordmark, bukan latar tujuan aktif.
- **Aturan lembar:** `sheet-rule` dan `dark-sheet-rule` memberi garis pembuka lembar analisis, formulir dan filter.

### Neutral

| Peran | Light | Dark | Penggunaan |
| --- | --- | --- | --- |
| Kanvas | `bg` | `dark-bg` | Latar halaman |
| Permukaan | `surface` | `dark-surface` | Field dan tabel |
| Lapisan lembut | `subtle` | `dark-subtle` | Header tabel, hover dan ringkasan |
| Teks | `text` | `dark-text` | Informasi utama |
| Teks pendamping | `muted` | `dark-muted` | Deskripsi dan metadata |
| Garis struktur | `border` | `dark-border` | Divider, bingkai tabel dan bagian |
| Tepi kontrol | `control-border` | `dark-control-border` | Input, select dan tombol pemilih file |
| Seleksi antrean | `selected` | `dark-selected` | Badge Queued |
| Teks navigasi | `rail-muted` | `dark-rail-muted` | Spesies dan metadata identitas |

Tepi kontrol wajib terbaca terhadap permukaan yang bersebelahan (target 3:1). Garis struktur sengaja lebih tenang dan tidak menggantikan tepi field. Secondary button tetap dikenali melalui teks dan bentuknya. Target contrast teks normal adalah 4.5:1; dokumen ini tidak menyatakan semua pasangan telah mendapat sertifikasi aksesibilitas.

### Semantic states

`success`/`success-bg`, `warning`/`warning-bg`, `danger`/`danger-bg` dan pasangan `dark-` menjaga kontras pesan serta status. Status memakai teks dan titik, bukan warna saja. Aksen hijau pucat CTA beranda adalah perlakuan lokal, bukan warna utama baru untuk workspace.

**The Semantic Pair Rule.** Pakai pasangan warna per mode dari sumber token. Border kontrol membedakan field dari kanvas; border struktural hanya mengatur pembagian ruang.

## Typography

**Display Font:** Sora, dengan Instrument Sans dan sans-serif sebagai fallback.
**Body Font:** Instrument Sans, dengan system-ui dan sans-serif sebagai fallback.
**Label/Mono Font:** ui-monospace, SFMono-Regular, Consolas, monospace untuk nilai ilmiah.

Pasangan ini memberi orientasi yang tegas tanpa mengubah tabel menjadi dekorasi. Semua ukuran frontmatter berasal dari stylesheet saat ini; ukuran dan weight khusus komponen tetap mengikuti sumber komponennya.

| Hierarki | Pemakaian dan adaptasi |
| --- | --- |
| Display | Judul beranda, maksimum 16ch; menjadi 38 px sampai 640 px |
| Headline | Judul halaman kerja dengan weight 600; 34 px di laptop/mobile |
| Title | Judul bagian dan attention; judul section form tetap 17 px |
| Body | Teks kerja; deskripsi halaman 16 px, maksimum 70ch |
| Label/action | Label field dan tombol; hint 13 px, metadata/status 12 px |
| Data | Isi tabel ilmiah dan ID sumber; angka tabular untuk posisi, hasil dan waktu |

Font disajikan lokal dari `frontend/public/fonts/` menggunakan `font-display: swap`: Sora variable (weight 100 sampai 800), Instrument Sans variable (400 sampai 700). Asalnya Google Fonts resmi dengan lisensi SIL Open Font License 1.1 tersimpan di `OFL-Sora.txt` dan `OFL-InstrumentSans.txt`; copyright menunjuk Sora Project Authors dan Instrument Sans Project Authors.

- Sora: [font sumber](https://raw.githubusercontent.com/google/fonts/main/ofl/sora/Sora%5Bwght%5D.ttf), [OFL](https://raw.githubusercontent.com/google/fonts/main/ofl/sora/OFL.txt). SHA256 lokal `84ff7096ae3ec6c8be47d906d1a0ba4de7f2ce78c615275c77301964a316e16c`.
- Instrument Sans: [font sumber](https://raw.githubusercontent.com/google/fonts/main/ofl/instrumentsans/InstrumentSans%5Bwdth,wght%5D.ttf), [OFL](https://raw.githubusercontent.com/google/fonts/main/ofl/instrumentsans/OFL.txt). SHA256 lokal `b24f1812584816958afcf22e22d08e44318c5e51651e25d2438efdde389b33b1`.

**The Scientific Integrity Rule.** Monospace dan lebar kolom membantu membaca data, tanpa menyingkat, menyusun ulang atau mengubah REF, ALT, GT, QUAL, DP dan null.

## Layout

Navigasi utama horizontal berada dalam alur dokumen pada semua route yang memakai shell. Desktop menempatkan identitas, empat tujuan dan kontrol akun/tema dalam tiga kolom; profil disembunyikan sampai 1150 px. Sampai 900 px, tujuan pindah ke baris kedua. Sampai 640 px, empat tujuan menjadi grid empat kolom dengan ikon di atas label dan tinggi minimum 60 px. Breadcrumb menghubungkan Ruang kerja ke konteks halaman saat ini. Halaman monitoring dan hasil tetap berada dalam tujuan Riwayat.

Main workspace dibatasi 1920 px dengan padding horizontal clamp(24px, 3vw, 56px); konten tidak diberi cap 1440 px lagi. Pada viewport 1920 px, area konten terukur 1808 px. Deskripsi tetap maksimum 70ch agar lebar kerja tidak memanjangkan narasi. Sampai 640 px, padding menjadi 20 px 16 px 32 px. Ritme dasar 8 px diterapkan bersama jarak kerja 16, 24 dan 32 px; jangan memaksakan kelipatan delapan pada padding kontrol atau tabel yang sudah terukur.

Dashboard memakai dua kolom untuk lembar hasil dan attention: rasio 2.2:1, minimum attention 300 px, gap 32 px. Sampai 1150 px, rasionya 1.7:1, minimum attention 250 px dan gap 24 px. Sampai 900 px, konten menjadi satu kolom. Saat ada analisis aktif atau gagal, useNarrowWorkspace memindahkan attention sebelum lembar hasil dalam DOM, urutan baca dan tab. Keadaan tenang tetap setelah lembar hasil. Attention sendiri memakai dua kolom pada 641 sampai 900 px dan satu kolom sampai 640 px. Lembar hasil memakai padding 30 px 32 px 8 px, radius 16 px dan shadow panel; pada mobile padding 24 px 20 px 4 px. Selection summary memakai dua kolom pada desktop, provenance empat kolom di desktop lebar dan dua kolom di laptop/mobile.

Form analisis dibatasi 1720 px, dengan field dan review berdampingan dalam grid 1fr clamp(330px,26vw,420px) dan gap 32 px. Sampai 1150 px, review menjadi 320 px dan gap 24 px. Sampai 900 px, keduanya menumpuk. Panel review sticky pada desktop di atas 1100 px dan mengikuti alur dokumen di bawahnya. Panel review menjadi surface utama tersendiri dengan padding 26 px, radius 16 px dan shadow panel; isi ringkasan tidak dibungkus kartu tambahan. Monitoring menggunakan lembar record dan provenance yang sama dengan Dashboard.

Tabel umum memiliki lebar minimum 680 px; tabel ilmiah 980 px, sehingga overflow berada pada region tabel yang bisa difokuskan dan digeser. REF/ALT mendapat minimum 100 px dan maksimum 320 px. Alel panjang boleh membungkus dengan overflow-wrap: anywhere, tanpa pemotongan. Hint scroll tampil di bawah 768 px. Beranda memakai foto dan copy dua kolom, menjadi satu kolom sampai 640 px. Urutan proses empat langkah juga menjadi satu kolom vertikal pada mobile.

Motif line-art bawang original Azril (frontend/public/garlic-pattern.png) tampil hanya di background workspace, dengan ukuran 340 px, opacity 0.035 pada light dan 0.045 plus invert pada dark. Lapisan konten dan footer opaque melindungi teks, formulir dan tabel; motif tidak menangkap pointer. Beranda mempertahankan foto kampus dan tim tanpa panel panduan demo. Batas operasional tetap berada di halaman tugas terkait.

## Elevation & Depth

Surface hasil terakhir, identitas hasil, toolbar dan panel review memakai bayangan panel lembut dengan offset. Attention dan ringkasan varian memakai lapisan tonal tanpa shadow yang sama. Garis tipis tetap membantu metadata dan tabel, tetapi tidak menjadi satu-satunya pembatas section. Nilai shadow light/dark disimpan pada token CSS dan extension sidecar.

**The Functional Surface Rule.** Gunakan depth untuk membedakan record utama, review yang akan dikirim dan kontrol pencarian. Jangan membungkus setiap field atau metadata menjadi kartu. Hover menambah feedback sementara pada tindakan dan record interaktif, bukan animasi konstan pada data ilmiah.

## Shapes

Record utama/review memakai radius 16 px; attention, toolbar, tabel dan upload 14 px. Control 8 px dan status 5 px tetap. Upload memakai garis putus 2 px serta feedback drag aktual. Field tetap memiliki tepi yang terbaca. Motif bawang, kampus, scene tim, gambar dan mapping original tetap menjadi bagian produk.

## Components

### Buttons and fields

`Button` menyediakan primary, secondary dan ghost, dengan tinggi minimum 44 px, padding 10 px 18 px, serta loading yang menonaktifkan tombol dan memberi `aria-busy`. Angka `height` di frontmatter merekam minimum sumber, bukan tinggi kaku. Tetapkan `type` secara eksplisit di dalam form. Hover mengganti warna melalui transisi 180 ms. Tekanan tombol memberi perpindahan 1 px selama 120 ms dengan easing `cubic-bezier(.22,1,.36,1)`. Reveal lembar berlangsung 200 ms melalui opacity dan clip-path; disclosure lanjutan memakai opacity serta perpindahan 3 px selama 180 ms. Data dan baris ilmiah tidak dianimasikan. Reduced-motion menonaktifkan efek tersebut dan transform tekanan tombol.

Field memiliki tinggi minimum 46 px, padding 10 px 13 px dan tepi kontrol semantik. Hubungkan `FormField` dengan `htmlFor`, hint/error melalui `aria-describedby`, serta `aria-invalid`. Error mengganti tepi menjadi warna danger. Disabled button memakai opacity .55 dan cursor not-allowed; disabled field .6. File input tetap native dan uncontrolled; memilih file tidak membuat Job.

Focus keyboard menggunakan outline 3 px berwarna focus dengan offset 4 px. Pertahankan rekomendasi target interaksi minimum 44 px, skip link, nama aksesibel dan urutan tab logis. Ikon Lucide SVG mendampingi label atau aria-label, bukan pengganti teks status.

### Feedback and data

`Alert` menyediakan error/info/success/warning; error memakai role alert, lainnya status. `StatePanel` menyatukan loading, kosong, gagal dan tindakan lanjut, tanpa menyiratkan progress palsu. `StatusBadge` mempertahankan enum Queued/Running/Completed/Failed dan penjelasan Bahasa Indonesia. `TableFrame` memberi region berlabel, fokus keyboard dan scroll horizontal; `Pagination` memakai total serta batas halaman server. `ContextHelp` mempertahankan hover/focus/tap, portal, Escape dan outside click.

AnalysisRecord menyatukan nama, nomor analisis per akun, mode eksekusi, status, waktu dan tindakan yang sesuai ketersediaan hasil. AnalysisProvenance menampilkan Sample ID, Reference ID, waktu mulai dan selesai. ResultOverview memuat ringkasan melalui GET /jobs/{id_job}/result untuk Job Completed dengan has_result. Jumlah varian, reference, threshold dan konfigurasi caller mengikuti respons API; error menampilkan retry tanpa mengubah data hilang menjadi nol. Review konfigurasi berada di samping field pada desktop dan sebelum tombol kirim, tanpa kartu statistik rekaan. Tabel mempertahankan caption, header kolom, nilai asli dan cakupan ekspor. Tidak ada perubahan desain yang mengubah null menjadi nol, menggabungkan record multiallelic, atau menulis ulang pemisah GT.

### Navigation and identity

Navigasi horizontal selalu menawarkan Beranda, Dashboard, Riwayat dan Analisis Baru. `aria-current` menyatakan halaman aktif; route `/jobs/:jobId` dan `/jobs/:jobId/result` berada di konteks Riwayat. Tema membaca preferensi tersimpan atau sistem dan tetap bisa diganti melalui tombol berlabel. Shell mempertahankan main landmark dan skip link.

Campus `bg-day.png`/`bg-night.png`, `Uchiha.jpg` dan `u1.png` sampai `u5.png` adalah aset existing/user-supplied placeholders dari snapshot `ca03a33`; pembuat atau lisensi asli raster belum terverifikasi. Pertahankan byte dan metadata asli. Mapping yang dilindungi adalah u1 Roni, u2 Fajar, u3 Rafif, u4 Azril dan u5 Aldo, berikut nama lengkap/NIM/peran pada `TeamSection.tsx`. Scene tim mempertahankan komposisi, cutout, normal hover/focus dan gelombang huruf per 60 ms, selesai setelah panjang nama dikali 60 ms ditambah 200 ms. Reduced-motion melewati gelombang huruf serta menonaktifkan animasi/transisi; pertahankan alternatif tersebut.

### Brand refinement, PROPOSED

Status menunggu review Farrel dan Azril. Ini bukan logo atau identitas final.

- `BrandIdentity` menyatukan wordmark dan nama spesies pada navigasi/login. Aksen botani memakai hijau existing pada hero sebagai pendamping biru tinta; bukan perubahan palet menjadi ungu. Active navigation memakai aksen yang sama tanpa mengubah warna status ilmiah.
- `public/brand/genopath-prototype-v2.png` adalah salinan byte-identik lampiran pengguna `logo genopath sementara no background v2.png`. Asal: sketsa awal Azril yang dikembangkan dengan AI, lalu background remover online. Keputusan tim dan file sumber lebih baik dari Azril masih ditunggu. Bukan favicon atau logo resmi; tidak ada tracing, perubahan bentuk, cleanup atau generasi ulang.
- Screenshot asli 500 x 441 memiliki background putih/abu. V2 mempertahankan bentuk/gradient utama, tetapi ada fringe terang tipis di latar gelap dan detail G/DNA menyatu pada 32 px. Pemakaian sementara dibatasi sebagai pendamping wordmark pada slot 50 x 44 px pada desktop dan 46 x 44 px pada mobile, bukan ikon standalone kecil.
- Topline workspace menampilkan breadcrumb konteks halaman dan spesies; spesies disembunyikan sampai 640 px. Empat langkah Beranda kini berupa urutan sampel/configuration/execution/output; diagram konseptual, bukan progress atau hasil Job. Copy dan aset tim tetap milik implementasi existing.
- Motif bawang original, kampus, Naruto/cutout, mapping dan animasi tim tidak diubah. Tidak mengubah kontrak route, API, gate, ownership atau pembagian kerja.

### Shared ownership

`frontend/README.md` adalah matriks ownership yang berlaku: Developer Dashboard memegang `/dashboard`; Developer Riwayat memegang `/riwayat` serta hasil; Developer Analisis memegang `/analisis-baru`. Integrator memegang monitoring dan registrasi route/shell. `components/ui/`, `components/analysis/`, `styles/`, `useJobPolling` dan `useNarrowWorkspace` adalah fondasi bersama melalui integrator. Perluas lewat props/children dan primitive existing, tanpa salinan per halaman.

Backend/API, AuthContext, JWT/ownership, gate privat, handler submission/UUID/recovery, polling dan data ilmiah tetap dilindungi. Dokumen ini bukan bukti push, persetujuan visual akhir, validasi biologis, atau pengujian Full Garlic.V2/1 GB. Scan dokumentasi memakai sumber final; screenshot review dan verdict dikelola pada pass review terpisah. Sidecar menyimpan snippet mandiri dan ramp tonal turunan untuk panel, bukan token warna runtime tambahan.

### Visual depth and interaction refinement, PROPOSED

Shared workspace.css mempertahankan arsitektur record dan navbar. Primary/secondary buttons minimum 48 px; field 50 px. Header hasil dan unduhan diberi surface terpisah, toolbar/filter dikelompokkan, table headers 13 px dan cells 15 px. Record ilmiah tidak bergerak terus-menerus. Beranda memakai area body maksimum 1760 px dan Team Section mengikuti lebar area tersebut, dengan aset dan interaksi original tetap.

Hover tombol naik 2 px dengan shadow ber-offset; press kembali ke posisi dasar dengan scale .98. Arrow tindakan record bergeser 2 px. Drag enter/leave/drop memakai state visual dan nested counter agar feedback tidak berkedip pada child; handler validasi/submission tetap. Advanced Mode membuka panel tonal dalam 240 ms, contextual help/alert muncul dalam 160 ms. Reduced-motion menonaktifkan animasi dan transform hover/press. Tidak ada delay loading buatan atau progress palsu.

## Do's and Don'ts

### Do:

- **Do** gunakan primitive bersama dan token semantik agar light/dark tetap berpasangan.
- **Do** pertahankan focus terlihat, label, pesan status, akses keyboard, zoom dan rekomendasi target minimum 44 px.
- **Do** tampilkan loading, kosong, gagal, retry dan data stale sesuai keadaan API yang sebenarnya.
- **Do** pertahankan aset identitas, mapping kontributor dan interaksi normal tim; sediakan alternatif reduced-motion.
- **Do** koordinasikan perubahan shell, token dan primitive melalui integrator sesuai frontend/README.md.

### Don't:

- **Don't** membuat dummy data, persentase progress, grafik atau temuan biologis untuk mengisi layar.
- **Don't** menghilangkan ALT multiallelic, pemisah GT, null atau batas filter dan ekspor demi kerapian visual.
- **Don't** menggandakan Button, tabel atau shell dengan gaya baru pada setiap halaman.
- **Don't** menjadikan glass, badge uppercase dan bayangan scene tim sebagai pola baru halaman kerja.
- **Don't** mengubah backend, JWT, ownership, gate privat atau perilaku submission dalam pekerjaan desain.
