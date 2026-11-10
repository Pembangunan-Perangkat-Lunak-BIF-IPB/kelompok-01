# Progres demo GenoPath — 11 November 2026

**Checkpoint A/B telah disetujui; Tahap 2B sedang dijalankan.** Catatan A/B di bawah adalah bukti historis, bukan status akhir 2B.

## Tahap 2B: runtime dan ekspor (10 November, lokal)

- Database baru `genopath_demo_20261110_2231b2`, role terbatas dengan nama sama, schema head `0004_m9_result_indexes`. Identitas database/role diverifikasi sebelum migrasi dan penulisan. `genopath_db` dan `genopath_integration_test` tidak dimutasi.
- Browser Edge nyata berhasil register/login, file/config tanpa POST, submit 202, Queued/Running/Completed, Nextflow, fastp, Bowtie2, SAMtools, BCFtools, ingest PostgreSQL, Result Viewer, serta refresh. Job #1 dan #2 masing-masing berisi 2 varian, 1 SNP posisi 5001 dan 1 InDel posisi 12001, serta 2 genotype.
- Input **sintetis terkontrol**: generator repo seed 20261104, reference 20.000 bp, 7.942 read single-end 150 bp Q40. QUAL 25, FORMAT/DP 8, ploidi 2. Reference/index cocok diverifikasi. Toolchain nyata ini bukan validasi biologis atau Garlic.V2.
- GET `/jobs/{id}/vcf` men-stream `selected.vcf` yang benar dari Job, mencocokkan metadata/run ID, file descriptor tanpa symlink, validitas VCF dan jumlah record. Bukan raw caller VCF atau filter tampilan.
- GET `/jobs/{id}/csv` men-stream seluruh hasil sesuai filter server, batch 200, snapshot read-only, tanpa limit halaman. Null kosong, ALT/GT asli, escaping CSV dan proteksi formula spreadsheet.
- Browser berhasil mengunduh VCF 3.329 byte dan CSV 167 byte Job #2, masing-masing 2 record. JWT hilang/invalid, cross-user, status belum selesai, file invalid/hilang/path tidak aman, ALT multiallelic, null, formula, serta ekspor 509 record diuji pada fixture terisolasi.
- Backend ekspor/result/auth/gate: 167 PASS sebelum tambahan regresi rotasi/favicon. Frontend build/lint dan 39 test PASS. Pengujian tambahan serta freeze masih berjalan.
- Bukti lokal dan artefak ada pada `.runtime/evidence/`, `.runtime/jobs/`, dan `.test-artifacts/`, semuanya diabaikan Git. Secret hanya file privat `.runtime/`, tidak dicetak atau dikomit.
- Tunnel **belum aktif**. Aktivasi publik tetap membutuhkan approval khusus dan password final dari input terminal tersamar pengguna.
- Checkpoint ekspor backend: `b6d16f9`. Frontend memakai endpoint sebenarnya melalui header Bearer, CSV seluruh hasil sesuai filter aktif, VCF seluruh hasil seleksi analisis. Browser Job #3: CSV filter SNP menghasilkan 1 record; replay UUID/file/parameter yang sama mengembalikan Job yang sama tanpa dispatch ulang. JWT tetap wajib setelah gate.
- Validasi terbaru: production build PASS, lint PASS, 44 frontend test PASS, 263 backend regression test PASS. Screenshot browser light/dark dan 390 px ditinjau; tabel tetap memiliki scroll horizontal lokal.
- Gate server mencakup SPA, assets, dan semua `/api`, termasuk auth/upload/start/ekspor. Argon2id, signed HttpOnly/Secure/SameSite cookie 16 jam, CSRF, batas percobaan 6/IP/menit dan 30 global/menit. Password final melalui `scripts.demo_runtime password`, hash/key privat mode 0600, reload tanpa restart. Regresi favicon dan rotasi sesi diuji. Login/JWT GenoPath tetap wajib.
- Serving production `127.0.0.1:3000` menyajikan build dan API same-origin; Vite dan server 8000 dihentikan. Runtime demo membatasi upload 10 MiB, 1 Job Queued/Running global dengan lock PostgreSQL, 2 thread dan timeout 600 detik.
- Uji PostgreSQL tambahan: Job #4 QUAL 999 Completed dengan 0 varian dan ekspor valid; Job #5 reference/index mismatch sengaja menjadi Failed tanpa Analysis. Reference negatif disimpan di `.runtime/negative-evidence/`, tidak tersedia sebagai opsi aktif. Browser menampilkan empty/failed states dan refresh dengan benar.
- Browser Job #6 menggunakan FASTQ gzip yang diunduh melalui tombol contoh sintetis setelah login; bytes sama dengan fixture, pipeline nyata, hasil/VCF/CSV/filter/replay/ownership PASS. Peserta tidak perlu mengambil dataset dari filesystem host.

## Baseline dan commit lokal

- Worktree: /home/zizi/projects/genopath-demo-20261110
- Branch: codex/demo-integration-20261110
- Backend: development@e0b94af42bc1b12f7d7b19cc83daea2f1a966367.
- Frontend Azril: snapshot ca03a33c4b3e37a027a88cc33c69d3f88610469e, hanya direktori frontend/.
- 85fc09b — feat(fe): integrasikan frontend Azril dengan baseline backend GenoPath (A).
- aaa136b — feat(be): sediakan riwayat job dan pilihan referensi terautentikasi.
- 7ba500f — fix(fe): benahi submission idempoten dan penyajian hasil analisis (B).
- Catatan hasil akhir ini disimpan pada commit dokumentasi terpisah.

Workspace utama tetap pada feature/be-m8-bowtie2-e2e@3a90689 dan bersih. Stash dipertahankan. Tidak ada push, PR, merge, atau perubahan branch Azril/development/main. Git worktree valid pada path di atas. Tool attachment Codex belum mengenali path setelah pemindahan dari lokasi managed ke path permintaan pengguna; semua perintah menggunakan path eksplisit. Ini tidak menghalangi penggunaan Git atau validasi.

## Perubahan Checkpoint B

- GET /jobs mengembalikan Job milik pengguna, urutan terbaru. GET /jobs/options terautentikasi mengembalikan reference yang file-nya tersedia beserta constraint publik, tanpa path internal. Respons baru private, no-store.
- Guard JWT/ownership, validasi FASTQ, storage, receipt/flock, sanitasi error, dan runner tetap dari baseline backend. Tidak mengimpor pelemahan guard maupun debug logging body dari branch FE.
- Alur: pilih FASTQ single-end → pilih reference/ploidi → konfigurasi QUAL/FORMAT-DP → Jalankan Analisis → pemantauan Job yang diakui server. Pemilihan berkas tidak mengirim POST.
- Submission menggunakan POST /samples/upload-and-run. UUID, metadata file, dan parameter dibekukan sebelum pengiriman; retry/reload pada tab yang sama mempertahankan identitas. Penanganan accepted/replayed, sample_stored, reconciliation_required, HTTP 413/422, dan hasil jaringan ambigu berbeda.
- Rekonsiliasi menghentikan retry otomatis. Penolakan definitif membuka konfigurasi untuk perbaikan dengan UUID baru. Double submission saat sibuk diblokir.
- QUAL finite ≥ 0; FORMAT/DP integer 0–2147483647. Nilai nondefault diuji hingga parameter Job tersimpan sebelum dispatch. Missing QUAL/DP tetap dikecualikan oleh backend walaupun threshold nol.
- Autentikasi hanya memakai DTO login yang sebenarnya; tidak mengarang profile/role server. Provider ganda dihapus, respons 401 memperbarui sesi, route analisis dilindungi, dan login kembali ke route yang diminta.
- Monitoring menggunakan endpoint Job spesifik untuk direct link, polling tidak overlap, alasan gagal terbaca, serta timestamp mulai/selesai sebenarnya.
- Result Viewer memakai counts/parameters/timestamp/ID backend, mempertahankan ALT dan GT asli serta null. Tidak ada angka, reference, genotype, checksum, atau validasi VCF fallback palsu. Mode synthetic dilabeli jelas.
- Filter tipe dan batas QUAL dijalankan server sebelum pagination; respons lama diabaikan. Search/genotype client-side yang memberi hasil parsial dihapus.
- VCF download dinonaktifkan dengan penjelasan karena endpoint belum ada. CSV hanya halaman aktif, diberi label eksplisit, dengan escaping koma/kutip/newline dan proteksi formula spreadsheet.
- Identitas/navigasi/tema/styles kelompok dipertahankan. Copy homepage yang tidak sesuai kontrak diperbaiki tanpa redesign. NBSP dan trailing whitespace salinan FE dinormalisasi untuk lint.
- Keputusan client: **single-end only**. Full Garlic.V2 dan FASTQ 1 GB tetap target final, di luar sesi ini.

## Validasi aktual

| Pemeriksaan | Hasil |
| --- | --- |
| Frontend production build (TypeScript + Vite) | PASS |
| ESLint | PASS, 0 error/warning |
| Vitest: 5 file, kontrak API dan komponen | PASS, 39 test |
| Backend targeted regression: 13 file test | PASS, 657 test |
| Git diff --check | PASS |
| Live E2E Nextflow/PostgreSQL, browser terhadap service nyata | SKIP, batas sesi |
| Full genome/indexing, tunnel, rehearsal, Impeccable, polish besar | SKIP, batas sesi |

Backend targeted mencakup demo_integration, auth, register, security, upload_storage, upload_http, jobs, job_http, submissions, results, pipeline, bowtie2_adapter, dan migrations. Dua warning deprecation berasal dari Starlette/httpx/anyio; tidak ada kegagalan akhir.

Uji kontrak Nextflow memakai HTTP/upload/SQLite dan runner stub, index fixture bukan index biologis. Replay membuat hanya satu Sample tambahan dan satu Job. Tidak ada Nextflow biologis atau PostgreSQL yang dijalankan. Test data tidak diklaim sebagai hasil biologis.

FAIL awal yang sudah diperbaiki: direktori induk basetemp belum dibuat, inventaris route OpenAPI belum mencakup /jobs/options, serta indentation NBSP/context export salinan FE tidak lolos lint.

Runtime build: Node 24.22.2 portable, checksum diverifikasi dari nodejs.org, dalam .tools/ yang diabaikan Git. Dependency frontend/test dikunci di package-lock.json; instalasi memakai --ignore-scripts. Python memakai environment yang sudah tersedia, dengan -B; artefak test berada dalam .test-artifacts/ worktree baru.

## Risiko dan langkah berikutnya (Checkpoint C, belum dijalankan)

- Verifikasi konfigurasi runtime, schema database yang disetujui, reference/index yang cocok, wrapper executable, dan dataset demo kecil beserta provenance. .env tidak dibaca/disalin atau dikomit dalam sesi ini.
- Flag pipeline_enabled dan katalog reference bukan klaim bahwa semua tools/index lolos preflight. Caller ploidi dipilih eksplisit sesuai dataset.
- Uji browser nyata dari register/login, submission, monitoring, hingga hasil PostgreSQL/VCF; bandingkan parameter dan record secara aktual. Nextflow pada input sintetis tetap pembuktian teknis, bukan validasi data biologis nyata.
- BackgroundTasks belum tahan restart; satu Job aktif per pengguna bukan pembatas resource global. History belum dipaginasi server untuk skala besar.
- Journal browser hanya dalam sessionStorage, per akun pada tab yang sama; bukan antrean durable/cross-tab. Jika tab ditutup/storage dibersihkan pada hasil ambigu, periksa history/receipt sebelum membuat submission baru.
- VCF download/CSV seluruh hasil masih belum tersedia dan UI menyatakannya. CSV halaman aktif bukan ekspor lengkap.
- RAM WSL/full-genome/1 GB, kondisi runtime aktual, dan akses eksternal belum dibuktikan dalam Checkpoint B.

Tidak ada tindakan manual yang diperlukan untuk menyelesaikan A/B. Siap direview sebelum izin Checkpoint C; gunakan path worktree eksplisit di atas.
