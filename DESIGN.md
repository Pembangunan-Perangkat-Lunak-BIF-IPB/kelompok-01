---
name: "GenoPath"
description: "Stasiun riset kampus untuk analisis varian Allium sativum."
colors:
  bg: "#f3f6f8"
  surface: "#fff"
  subtle: "#eaf0f5"
  text: "#142c3c"
  muted: "#526777"
  border: "#cedae2"
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
  dark-bg: "#101e29"
  dark-surface: "#172b39"
  dark-subtle: "#203746"
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
typography:
  display:
    fontFamily: "Sora, 'Instrument Sans', sans-serif"
    fontSize: "clamp(34px, 4.1vw, 62px)"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Sora, 'Instrument Sans', sans-serif"
    fontSize: "clamp(24px, 2.4vw, 34px)"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Sora, 'Instrument Sans', sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.6
    letterSpacing: "-0.025em"
  body:
    fontFamily: "'Instrument Sans', system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "'Instrument Sans', system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.6
  action:
    fontFamily: "'Instrument Sans', system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.4
  data:
    fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  panel: "12px"
  control: "8px"
  status: "5px"
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
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.brand-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "10px 18px"
    height: "44px"
  button-secondary-hover:
    backgroundColor: "{colors.subtle}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.link}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "10px 18px"
    height: "44px"
  button-ghost-hover:
    backgroundColor: "{colors.subtle}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "10px 13px"
    height: "46px"
  summary:
    backgroundColor: "{colors.subtle}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
    padding: "24px"
  status-completed:
    backgroundColor: "{colors.success-bg}"
    textColor: "{colors.success}"
    rounded: "{rounded.status}"
    padding: "4px 10px"
  table-frame:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
---

# Design System: GenoPath

## Overview

**Creative North Star: "Stasiun riset GenoPath"**

Ruang kerja kampus untuk analisis genom yang menempatkan sampel, status dan tindakan berikutnya di depan. Rail tinta biru memberi identitas; kanvas porselen, garis pembagi dan tipografi terukur menjaga halaman kerja tenang. Beranda lebih ekspresif melalui judul editorial dan foto kampus asli.

Dokumen ini merekam implementasi M11, bukan pemulihan Hi-Fi/Lo-Fi lama atau komposisi final semua halaman. Arah code-led sudah dipilih pengguna; penerimaan visual akhir masih menunggu review preview. PRODUCT.md memegang kebenaran produk, surface brief memegang strategi halaman, dan token di frontend/src/styles/tokens.css memegang nilai runtime.

**Key Characteristics:**

- Rail gelap, kanvas luas dan bagian data bergaris.
- Sora untuk orientasi, Instrument Sans untuk kerja, monospace untuk nilai ilmiah.
- Status nyata dan tindakan eksplisit; tidak membuat metrik atau hasil contoh.
- Satu fondasi light/dark untuk halaman yang dikerjakan tiga developer.

## Colors

Biru mineral memandu tindakan di atas netral dingin; hijau, amber dan merah hanya menjelaskan keadaan. Nilai normatif berada di frontmatter, mengikuti nama token runtime tanpa prefix `--gp-`; prefix `dark-` merekam override `.dark`.

### Primary

- **Biru mineral:** `brand` untuk tindakan utama, `brand-hover` untuk hover, `link` untuk tautan dan `focus` untuk outline keyboard. Pasang dengan token `dark-` yang sepadan pada mode malam.
- **Tinta stasiun:** `rail` untuk identitas navigasi; teks navigasi memiliki pasangan warna lokal tersendiri pada CSS shell. Active navigation tetap berupa bidang terang pada kedua mode.

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
| Teks rail | `rail-muted` | `dark-rail-muted` | Keterangan identitas |

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
| Display | Judul beranda; menjadi 42 px di viewport sampai 900 px, lalu 39 px sampai 640 px |
| Headline | Judul halaman kerja; 26 px pada mobile |
| Title | Judul bagian; variasi 18 px dipakai pada section title |
| Body | Teks kerja; deskripsi halaman 14 px, maksimum 65ch |
| Label/action | Label field dan tombol; hint 13 px, metadata/status 12 px |
| Data | Isi tabel ilmiah; angka tabular untuk posisi, statistik dan ledger |

Font disajikan lokal dari `frontend/public/fonts/` menggunakan `font-display: swap`: Sora variable (weight 100 sampai 800), Instrument Sans variable (400 sampai 700). Asalnya Google Fonts resmi dengan lisensi SIL Open Font License 1.1 tersimpan di `OFL-Sora.txt` dan `OFL-InstrumentSans.txt`; copyright menunjuk Sora Project Authors dan Instrument Sans Project Authors.

- Sora: [font sumber](https://raw.githubusercontent.com/google/fonts/main/ofl/sora/Sora%5Bwght%5D.ttf), [OFL](https://raw.githubusercontent.com/google/fonts/main/ofl/sora/OFL.txt). SHA256 lokal `84ff7096ae3ec6c8be47d906d1a0ba4de7f2ce78c615275c77301964a316e16c`.
- Instrument Sans: [font sumber](https://raw.githubusercontent.com/google/fonts/main/ofl/instrumentsans/InstrumentSans%5Bwdth,wght%5D.ttf), [OFL](https://raw.githubusercontent.com/google/fonts/main/ofl/instrumentsans/OFL.txt). SHA256 lokal `b24f1812584816958afcf22e22d08e44318c5e51651e25d2438efdde389b33b1`.

**The Scientific Integrity Rule.** Monospace dan lebar kolom membantu membaca data, tanpa menyingkat, menyusun ulang atau mengubah REF, ALT, GT, QUAL, DP dan null.

## Layout

Shell kerja desktop memakai rail tetap selebar 236 px; sampai 900 px rail menjadi 196 px. Kanvas mengimbanginya dengan margin kiri yang sama. Area utama dibatasi 1800 px, padding atas 32 px, samping `clamp(20px, 4vw, 64px)` dan bawah 48 px. Form analisis dibatasi 840 px. Ritme dasar 8 px diterapkan bersama jarak kerja 16, 24 dan 32 px; jangan memaksakan kelipatan delapan pada padding kontrol atau tabel yang sudah terukur.

Sampai 640 px, rail berubah menjadi header dalam alur dokumen. Empat tujuan utama tampil lengkap dalam grid empat kolom, dengan ikon di atas label dan tinggi minimum 60 px. Kontrol tema/akun tetap tersedia. Main memakai padding 24 px 16 px 36 px, header halaman menumpuk dan tindakan dapat membungkus. Pada beranda, navigasi juga membungkus pada rentang 641 sampai 1000 px. Foto dan copy beranda menjadi satu kolom pada mobile; bagian proses menjadi dua kolom.

Data memakai garis dan whitespace: ledger tiga bagian, tabel penuh, filter yang membungkus, dan pagination yang tetap terbaca. Tabel umum memiliki lebar minimum 680 px; tabel ilmiah 980 px, sehingga overflow berada pada region tabel yang bisa difokuskan dan digeser. REF/ALT mendapat minimum 100 px dan maksimum 320 px. Alokasi ini menjaga alel pendek terbaca utuh; alel panjang boleh membungkus dengan `overflow-wrap: anywhere`, tanpa pemotongan. Sumber tidak memakai `white-space: nowrap` pada seluruh kolom alel. Hint scroll tampil di bawah 768 px.

Motif line-art bawang original Azril (`frontend/public/garlic-pattern.png`) tampil hanya di background workspace, dengan opacity 0.055 pada light dan 0.065 plus invert pada dark. Lapisan konten dan footer opaque melindungi teks, formulir dan tabel; motif tidak menangkap pointer. Beranda mempertahankan foto kampus dan tim tanpa panel panduan demo. Batas operasional tetap berada di halaman tugas terkait.

## Elevation & Depth

Permukaan kerja datar: pemisahan berasal dari warna tonal dan border tipis. Tidak ada shadow pada surface workspace. Bantuan kontekstual mengambang memakai shadow sumber: light `0 10px 28px rgba(16,47,69,.09)`, dark `0 10px 28px rgba(0,0,0,.2)`. Nilai extension berada di sidecar karena schema frontmatter tidak memiliki properti shadow.

**The Flat Workspace Rule.** Halaman kerja memakai lapisan tonal dan garis; bayangan hanya memberi jarak pada bantuan mengambang. Scene tim asli tetap menjadi pengecualian lokal yang dilindungi.

## Shapes

Kontrol bersudut lembut (8 px); panel, upload dan bingkai tabel (12 px); badge status lebih rapat (5 px). Field dan tabel memakai stroke 1 px, upload memakai garis putus. Panel bantuan (10 px) dan auth form (16 px) adalah bentuk komponen yang sudah ada, bukan alasan menambah skala radius baru. Hindari menumpuk bingkai kartu di dalam bagian workspace yang sudah memiliki struktur garis.

## Components

### Buttons and fields

`Button` menyediakan primary, secondary dan ghost, dengan tinggi minimum 44 px, padding 10 px 18 px, serta loading yang menonaktifkan tombol dan memberi `aria-busy`. Angka `height` di frontmatter merekam minimum sumber, bukan tinggi kaku. Tetapkan `type` secara eksplisit di dalam form. Hover mengganti warna melalui transisi 180 ms. Token easing `cubic-bezier(.22,1,.36,1)` tersedia, tetapi aturan transisi tombol saat ini memakai easing default CSS.

Field memiliki tinggi minimum 46 px, padding 10 px 13 px dan tepi kontrol semantik. Hubungkan `FormField` dengan `htmlFor`, hint/error melalui `aria-describedby`, serta `aria-invalid`. Error mengganti tepi menjadi warna danger. Disabled button memakai opacity .55 dan cursor not-allowed; disabled field .6. File input tetap native dan uncontrolled; memilih file tidak membuat Job.

Focus keyboard menggunakan outline 3 px berwarna focus dengan offset 4 px. Pertahankan rekomendasi target interaksi minimum 44 px, skip link, nama aksesibel dan urutan tab logis. Ikon Lucide SVG mendampingi label atau aria-label, bukan pengganti teks status.

### Feedback and data

`Alert` menyediakan error/info/success/warning; error memakai role alert, lainnya status. `StatePanel` menyatukan loading, kosong, gagal dan tindakan lanjut, tanpa menyiratkan progress palsu. `StatusBadge` mempertahankan enum Queued/Running/Completed/Failed dan penjelasan Bahasa Indonesia. `TableFrame` memberi region berlabel, fokus keyboard dan scroll horizontal; `Pagination` memakai total serta batas halaman server. `ContextHelp` mempertahankan hover/focus/tap, portal, Escape dan outside click.

Ringkasan konfigurasi memakai bidang subtle dan padding 24 px; jangan menggantinya dengan kartu statistik rekaan. Tabel mempertahankan caption, header kolom, nilai asli dan cakupan ekspor. Tidak ada perubahan desain yang mengubah null menjadi nol, menggabungkan record multiallelic, atau menulis ulang pemisah GT.

### Navigation and identity

Navigasi selalu menawarkan Beranda, Dashboard, Riwayat dan Analisis Baru. `aria-current` menyatakan halaman aktif; route `/jobs/:jobId` dan `/jobs/:jobId/result` berada di konteks Riwayat. Tema membaca preferensi tersimpan atau sistem dan tetap bisa diganti melalui tombol berlabel. Shell mempertahankan main landmark dan skip link.

Campus `bg-day.png`/`bg-night.png`, `Uchiha.jpg` dan `u1.png` sampai `u5.png` adalah aset existing/user-supplied placeholders dari snapshot `ca03a33`; pembuat atau lisensi asli raster belum terverifikasi. Pertahankan byte dan metadata asli. Mapping yang dilindungi adalah u1 Roni, u2 Fajar, u3 Rafif, u4 Azril dan u5 Aldo, berikut nama lengkap/NIM/peran pada `TeamSection.tsx`. Scene tim mempertahankan komposisi, cutout, normal hover/focus dan gelombang huruf per 60 ms, selesai setelah panjang nama dikali 60 ms ditambah 200 ms. Reduced-motion melewati gelombang huruf serta menonaktifkan animasi/transisi; pertahankan alternatif tersebut.

### Shared ownership

`frontend/README.md` adalah matriks ownership yang berlaku: Developer Dashboard memegang `/dashboard`; Developer Riwayat memegang `/riwayat` serta hasil; Developer Analisis memegang `/analisis-baru`. Integrator memegang monitoring dan registrasi route/shell. `components/ui/`, `components/analysis/`, `styles/` dan `useJobPolling` adalah fondasi bersama melalui integrator. Perluas lewat props/children dan primitive existing, tanpa salinan per halaman.

Backend/API, AuthContext, JWT/ownership, gate privat, handler submission/UUID/recovery, polling dan data ilmiah tetap dilindungi. Dokumen ini bukan bukti push, persetujuan visual akhir, validasi biologis, atau pengujian Full Garlic.V2/1 GB. Scan dokumentasi memakai sumber final; screenshot review dan verdict dikelola pada pass review terpisah. Sidecar menyimpan snippet mandiri dan ramp tonal turunan untuk panel, bukan token warna runtime tambahan.

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
