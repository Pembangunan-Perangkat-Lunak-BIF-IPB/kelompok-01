# Frontend GenoPath M11

Overhaul Stasiun riset GenoPath berstatus PROPOSED, menunggu review tim. Fondasi: source API aktual, navigasi terpusat, token light/dark dan komponen bersama. Baseline fungsional M10: `8b71771aaa10eed2f59142d70408759fdda17357`.

## Mulai bekerja

1. Gunakan commit fondasi M11 yang sudah direview sebagai basis branch halaman Anda.
2. Pertahankan `package-lock.json`. Gunakan versi Node yang kompatibel dengan project (runtime host saat fondasi: Node 24).
3. Jalankan `npm ci` jika dependency belum tersedia pada mesin Anda, lalu `npm run dev -- --host 127.0.0.1 --port 5173`.
4. Proxy development `/api` mengarah ke backend lokal port 8000. Setup backend dan secret tetap lokal; jangan memasukkannya ke Git.
5. `npm run build`, `npm run lint`, `npm test` sebelum menyerahkan perubahan.

## Preview terintegrasi pada PC host

Dari root worktree M11, setelah production build:

```bash
/home/zizi/projects/genopath-backend/.venv/bin/python -B -m scripts.preview_frontend --port 3001
```

Buka `http://localhost:3001`. Preview membaca gate existing dari worktree demo M10 dan meneruskan `/api` ke server M10 loopback 3000. Tidak menjalankan database/pipeline runner baru. Jangan menjalankan launcher kedua jika preview sudah hidup. Tidak ada tunnel publik.

Jika pengujian browser memerlukan sesi, jalankan `python -B -m scripts.preview_frontend --unlock` melalui terminal interaktif dengan environment Python yang sama. Password diketik tersamar; tidak diubah, dicetak atau disimpan. Sesi sah hanya disimpan di `.runtime/` yang diabaikan Git. Password akun GenoPath terpisah.

## Route dan ownership

| Route/file | Pemilik | Batas |
| --- | --- | --- |
| `/dashboard`, `src/pages/DashboardPage.tsx` | Developer Dashboard | Record dari `getJobs`, Completed terbaru dan ringkasan `getJobResult`, provenance, attention aktif/gagal serta analisis lain |
| `/riwayat`, `src/pages/HistoryPage.tsx` | Developer Riwayat | Pencarian/status/empty states riwayat |
| `/jobs/:jobId/result`, `src/pages/JobResultPage.tsx` | Developer Riwayat | Filter server-side, pagination dan ekspor existing |
| `/analisis-baru`, `src/pages/NewAnalysisPage.tsx` | Developer Analisis | Presentasi file/konfigurasi; pertahankan handler, UUID dan recovery |
| `/jobs/:jobId`, `src/pages/JobMonitoringPage.tsx` | Integrator fondasi | Pemantauan Job spesifik, polling dan jalur ke hasil |
| `src/App.tsx`, `components/Navbar.tsx`, `components/Layout.tsx` | Integrator fondasi | Registrasi route, empat tujuan horizontal, active navigation, breadcrumb dan shell |
| `components/ui/`, `components/analysis/`, `styles/`, `hooks/useJobPolling.ts`, `hooks/useNarrowWorkspace.ts` | Shared foundation | Perubahan melalui integrator agar tidak terjadi konflik paralel |

Jangan mengedit shared files sekadar menambahkan konten halaman. Gunakan props/children serta pola class yang sudah tersedia. Ajukan perluasan primitive bersama melalui integrator. Jangan membuat salinan Button atau tabel dengan style baru per halaman.

## Komponen dan aturan data

- `Button`: primary/secondary/ghost, loading dan disabled. Tetapkan `type` secara eksplisit dalam form.
- `FormField`: label/hint/error. Hubungkan input dengan `htmlFor`, `aria-describedby` dan `aria-invalid` yang sesuai.
- `PageHeader`, `Alert`, `StatePanel`: hierarki dan feedback seragam.
- `StatusBadge`: status backend tidak diubah; penjelasan Bahasa Indonesia tersedia.
- `TableFrame`, `Pagination`: tabel ilmiah, scroll keyboard, jumlah record dan batas halaman server.
- `ContextHelp`: portal, hover/focus/tap, Escape dan outside click tetap dipertahankan.
- `useJobPolling`: endpoint dan interval 4 detik dari M10, dengan abort/cleanup dan data stale. Jangan menambah interval kedua.
- `JobTable`: data dari akun aktif; URL tetap memakai ID global, label memakai nomor per akun.
- `AnalysisRecord`, `AnalysisProvenance`: identitas, mode, status, tindakan, Sample ID, Reference ID dan waktu dari Job yang tersimpan. Dipakai Dashboard dan Monitoring.
- `ResultOverview`: GET `/jobs/{id_job}/result` hanya untuk Completed dengan `has_result`; counts, reference, threshold dan konfigurasi caller berasal dari respons aktual. Loading/error/retry berdiri sendiri, metadata Job tetap tersedia, data hilang tidak menjadi nol.
- `useNarrowWorkspace`: media query sampai 900 px. Dashboard memindahkan attention aktif/gagal sebelum hasil dalam DOM agar urutan baca, visual dan tab sesuai; keadaan tenang tetap setelah hasil.

Dashboard memilih Completed terbaru menurut waktu selesai, dengan ID sebagai tie-break, lalu memakai analisis aktif jika belum ada Completed. Attention memuat seluruh Job aktif dan paling banyak dua kegagalan, dengan tautan ke Riwayat jika lebih banyak. Bagian Analisis lain menampilkan paling banyak empat record selain fokus. Tidak ada ledger tiga angka atau perkiraan progress tahap.

`styles/tokens.css` menyimpan nilai semantik; `index.css` memuat fondasi existing dan `styles/workspace.css` menerapkan aturan workspace terakhir. Periksa cascade sebelum menambah aturan. Gunakan lembar record bergaris, tabel dan primitive existing. Form `gp-analysis-form` menyandingkan `gp-analysis-fields` dan `gp-submit-panel` pada desktop, lalu menumpuk sampai 900 px; hindari kartu bertingkat. Motion dibatasi ke umpan balik tombol, reveal lembar dan disclosure. Pertahankan alternatif reduced-motion dan jangan menganimasikan baris ilmiah.

Semua angka berasal dari API. Jangan membuat grafik atau statistik placeholder. Jangan mengubah ALT multiallelic, null, GT, QUAL, DP, filter server, scope ekspor atau filename server. Input file tetap uncontrolled; jangan menambahkan `value` yang merusak cancel dan reset file M10. Memilih file tidak boleh membuat Job.

## Batas yang dilindungi

`services/api.ts`, `services/submissionDraft.ts`, AuthContext, JWT/ownership, API/backend, database dan pipeline bukan sasaran refactor desain. Single-end only. Demo sintetis 20 kbp, 10 MiB, satu Job aktif global; Full Garlic.V2/1 GB belum tervalidasi.

Seluruh foto kampus, Uchiha/u1-u5, nama/NIM/mapping, hover dan animasi normal Azril dipertahankan. Reduced-motion memiliki alternatif tanpa gelombang huruf. Hi-Fi/Lo-Fi lama hanya referensi historis.

Baca `../PRODUCT.md` dan `../DESIGN.md` sebelum mengembangkan halaman. Jangan gunakan Unicode em dash/en dash pada teks aplikasi. Jangan commit `.runtime/`, `.tools/`, screenshot review, session, dataset, DB atau hasil pipeline.
