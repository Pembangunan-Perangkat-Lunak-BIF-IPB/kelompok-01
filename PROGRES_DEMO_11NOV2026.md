# Progres demo GenoPath, 11 November 2026

**Tahap 2C.2 selesai: nama/nomor analisis dan cleanup telah dideploy; tunnel publik dipertahankan.**
URL aktif: https://namely-year-father-fifth.trycloudflare.com
Password final telah ditetapkan pengguna lewat terminal tersamar dan diverifikasi. Browser Edge pada PC host telah menguji alur melalui Cloudflare HTTPS. Pengguna mengonfirmasi PASS password gate pada Chrome Incognito PC dan Chrome HP melalui hotspot berbasis data seluler pada jaringan berbeda. Rehearsal Default dan validasi penolakan FASTQ juga PASS; versi demo dibekukan untuk rehearsal tim.

## Bugfix profil: nama lengkap setelah login ulang

- Penyebab pasti: login hanya mengembalikan JWT. Frontend sebelumnya membentuk nama dari extraInfo formulir registrasi, lalu fallback ke credentials.username pada login biasa. Tidak ada pembacaan profil persisten; Navbar ikut menggunakan username sebagai fallback display name.
- Tambah GET /auth/me dengan guard get_current_user yang sudah ada. JWT menentukan akun; respons hanya id_user, username dan nama dari database, private/no-store. Tidak menerima ID akun untuk memilih profil. Kontrak register/login lama dan schema database tidak berubah.
- AuthContext mengambil profil backend setelah login dan saat memulihkan token pada refresh/browser lain. Cache user_info lama tidak dipercaya; extraInfo formulir dihapus dari alur login. Navbar menggunakan nama backend, tanpa mengarang nama dari username. Protected route menunggu pemulihan profil; request lama dibatalkan/diabaikan setelah logout atau pergantian sesi. Respons 401 dari token lama tidak menghapus sesi token baru.
- PASS production build, ESLint, 53 frontend tests dan 140 targeted backend tests (profile/auth/register). Inventaris OpenAPI diperbarui untuk endpoint additive. Dua warning deprecation Starlette/httpx/anyio tetap ada.
- PASS browser Edge nyata melalui URL publik yang sama: register dengan nama lengkap, logout/login ulang, refresh termasuk cache profil salah, context browser baru tanpa cache profil, dua akun/context terpisah, JWT hilang/invalid, field profil minimal dan no-store. Total submission POST 0, tidak menjalankan pipeline. Bukti pada .runtime/profile-fix/browser-check.json dan screenshot; logs pada .test-artifacts/profile-*.log.
- Deploy terkontrol setelah memastikan tidak ada Job aktif, graceful restart hanya service demo dan penggantian frontend HTML atomik setelah aset tersedia. Cloudflare/hostname/hash gate/JWT tidak diubah, tidak ada migrasi schema. Identitas analisis, hasil, pipeline dan mekanisme ekspor tidak disentuh. Fallback build sebelum bugfix ada pada .runtime/profile-fix/dist-before/.
- Perbaikan ini disimpan pada satu checkpoint lokal setelah 802f900. Tidak push/merge/PR. Pengguna cukup refresh halaman dan login kembali bila perlu untuk melihat nama persisten.

## Tahap 2C.2: identitas analisis dan cleanup final

- Backend 87b3638; frontend fungsional 19531ba; cleanup visual dan validasi 68cb927. Setelah seluruh implementasi/test/commit selesai dan tree bersih, branch lokal di-rename dari codex/demo-integration-20261110 ke feature/fe-be-integration-demo. Target sebelumnya tidak ada dan HEAD/history dipertahankan; tidak membuat branch tambahan. Pembaruan nama branch ini disimpan pada commit dokumentasi terakhir.
- Nama opsional maksimal 80 karakter disimpan pada Job dan metadata request. Whitespace dinormalisasi, kontrol/bidi ditolak, teks dirender aman oleh React. Nama duplikat diizinkan; nama tidak menjadi path atau identitas internal.
- Nomor persisten per owner berada di job.analysis_number, unik bersama id_user dan bernilai positif. Alokasi max nomor semua status + 1 dilakukan di bawah lock baris User yang sudah ada, sesudah pemeriksaan replay UUID. Job Failed tetap memiliki nomor; tidak ada fitur delete/recycle.
- Migrasi additive 0005_analysis_identity hanya dijalankan pada genopath_demo_20261110_2231b2 setelah identitas database/role diverifikasi. Backfill memakai ROW_NUMBER PARTITION BY id_user ORDER BY id_job. Tidak mengubah primary key, FK, URL global, parameter biologis, atau output.
- Fingerprint semua Job/Sample/Analysis/Variant/Genotype historis dan SHA-256 VCF direkam sebelum migrasi. Pemeriksaan sesudah migrasi dan E2E membuktikan seluruh data historis tetap utuh. Job pengguna #9 menjadi Analisis #1; #10 menjadi Analisis #2, keduanya Completed dengan 2 varian dan VCF identik sebelumnya.
- PostgreSQL QA pada dua schema baru terpisah membuktikan backfill, concurrent same-UUID replay, concurrent submissions yang berbeda, serta nomor 1 pada owner kedua. Schema QA dipertahankan, tidak termasuk data public yang dilayani aplikasi. Database utama dan integration_test tidak disentuh.
- Nama, nomor per akun, dan ringkasan tersedia pada history, Monitoring dan Result Viewer. Nama tersimpan dalam journal browser, dibekukan saat submission dan dipertahankan ketika retry/reconciliation atau panel Advanced ditutup.
- Receipt lama tanpa nama tetap diserialisasi tanpa field nama null. Uji HTTPS nyata pada receipt lama Job #7 berhasil replay Completed, tanpa Sample/Job/nomor baru. Metadata nama berbeda dengan UUID sama ditolak 409.
- Server membuat filename ASCII yang disanitasi dan dibatasi panjangnya dari nomor/nama tersimpan, aman untuk Unicode display name, path/control/CRLF dan reserved basename. Contoh: GenoPath_Analisis-1_Sampel-Bawang-A_selected.vcf dan GenoPath_Analisis-1_Sampel-Bawang-A_filtered.csv. Frontend memakai Content-Disposition, bukan ID global atau nama buatan sendiri. Isi/streaming/batching/filter/formula protection dan nama artefak internal tidak berubah.
- UI: label internal di homepage dihapus, paragraf/petunjuk diringkas, panduan/batas demo dapat dibuka, navbar Riwayat, garlic outline existing samar pada latar light/dark. Nama/peran/NIM kontributor tetap dari source; avatar anime diganti inisial netral. Copy em/en dash dibersihkan; metadata/data ilmiah asli tidak dinormalisasi hanya untuk kosmetik. Contextual help dan identitas biru tetap dipertahankan. Tidak memakai Impeccable.
- PASS production build, ESLint, 50 frontend tests. PASS 347 targeted backend tests (12 file) dan 1 live PostgreSQL QA test yang mencakup concurrency/backfill. Dua warning deprecation Starlette/httpx/anyio tetap ada. Tes schema lama yang mengasumsikan kolom Job lama diperbarui secara eksplisit untuk dua kolom baru.
- PASS satu live E2E publik bernama Sampel Bawang A: Global Job #11 pada akun test baru = Analisis #1, QUAL25/DP8, Completed, 2 Variant/2 Genotype nyata dari fixture sintetis. Nama/nomor bertahan setelah refresh/login ulang, history/monitoring/results, VCF/CSV filename+record, replay, konflik nama 409, ownership 404, light/dark dan mobile. VCF unduhan identik pipeline; posisi/GT CSV cocok PostgreSQL. Tidak mengklaim validasi biologis Garlic.V2.
- Deployment: hanya service demo dihentikan secara graceful setelah tidak ada Job aktif, schema diverifikasi/migrasi, lalu service demo dijalankan kembali. Frontend assets disalin sebelum HTML atomik. PostgreSQL dan cloudflared tidak direstart, gate/hash/JWT dan pembatas 10 MiB/1 Job global/2 thread tetap. PID tunnel dan URL asli dipertahankan.
- Fallback source 1c5be96 tetap ada di Git; salinan build sebelumnya ada di .runtime/ui-2c2/dist-stable-1c5be96/. Tidak melakukan downgrade schema destruktif. Setelah schema baru, perbaikan backend dilakukan maju; frontend lama dapat dipulihkan tanpa menghapus kolom/data.
- Bukti hanya pada .test-artifacts/identity-*.log dan .runtime/ui-2c2/ (snapshot privat data-before, guard, evidence browser/PG/historical/legacy replay serta screenshot). Semua artefak/secret/binary/index tidak dikomit. Script browser temporer mengalami masalah resolusi modul UNC, diperbaiki dengan menjalankan Windows Node dari /mnt/c; bukan kegagalan aplikasi.
- Sisa: refresh halaman publik, periksa Analisis #1/#2 lama dan coba nama sendiri bila diinginkan. Host tetap harus menyala; in-process runner belum tahan restart saat Job aktif. Full Garlic.V2/1 GB/annotation dan Impeccable tetap di luar tahap ini. Tidak ada push/PR/merge.

## Tahap 2C.1: Advanced dan contextual help, selesai untuk review

- Baseline fallback ca54fe1 dipertahankan. Build stabil sebelum perubahan disalin ke .runtime/ui-2c1/dist-stable-ca54fe1/; aset lama tetap tersedia di frontend/dist. Rollback UI dapat dilakukan dengan mengganti index.html secara atomik dari salinan stabil, tanpa restart service/tunnel.
- Advanced menjadi disclosure Pengaturan lanjutan dengan aria-expanded, QUAL/FORMAT-DP dua kolom desktop dan satu kolom mobile. Menutup panel mempertahankan nilai khusus; ringkasan tetap menunjukkan nilai aktual dan label Konfigurasi khusus. Reset threshold terpisah mengembalikan 30/10. Tidak menambah parameter/default backend.
- Validasi langsung QUAL finite >= 0 dan DP integer 0–2147483647, aria-invalid/description dan error per field. Pesan invalid tetap terlihat saat panel ditutup; submission invalid diblokir sebelum penyimpanan UUID. Draft/idempotency/retry/reconciliation dan keamanan tetap memakai mekanisme sebelumnya.
- ContextHelp memakai portal di luar card/scroll container, target 44 px, label/description screen reader, hover/focus, klik/tap, Enter/Space dan Escape. Bantuan panjang dibatasi viewport dan bisa di-scroll; tidak memasang dependency.
- Halaman: Analisis Baru (QUAL/FORMAT-DP/ploidi), Monitoring (arti status), Result Viewer (ringkasan, scope ekspor, filter), homepage (alur tools). Login/register tidak diubah.
- Contoh penyederhanaan: paragraf scope VCF/CSV menjadi “VCF: seluruh seleksi analisis. CSV: seluruh hasil sesuai filter, tanpa batas halaman.” Detail raw VCF, filter, escaping spreadsheet berada pada ikon bantuan. Penjelasan QUAL/DP dipisah menjadi ringkasan satu kalimat dan bantuan tambahan. Peringatan sintetis, limit upload, status/error, parameter aktual dan cakupan unduhan tetap terlihat.
- Parameter aktual Completed Job tetap tampil di Result Viewer dari API sebenarnya. DTO Monitoring tidak memuat threshold; tidak mengarang nilai atau mengubah kontrak API untuk menambahkannya.
- PASS production build TypeScript/Vite, ESLint, 48 frontend test (6 file). Test baru mencakup keyboard/Escape/portal/toggle bantuan, preservasi parameter saat panel ditutup, reset, invalid input tanpa UUID/POST, dan submission nilai khusus dari panel tertutup. Kontrak submission diuji dengan mock pada unit test, bukan response dummy pada UI publik.
- PASS browser Edge nyata melalui URL HTTPS yang sama: Default/Advanced, nilai input/validasi, hover/focus/keyboard/Escape, mobile touch 390 px dan batas popover, light/dark, login, pilih FASTQ tanpa POST, Monitoring Job #7, Result Viewer dan VCF/CSV asli Job #7. Total POST submission 0; tidak menjalankan pipeline atau memutasi data analisis. Tidak mengklaim live submission/pipeline baru pada tahap UI ini.
- Deploy: build kandidat ke .runtime/ui-2c1/candidate, cek tidak ada Job aktif, salin aset dahulu dan ganti HTML secara atomik terakhir. Tidak restart server/tunnel, tidak mengubah hostname, gate/hash/JWT, database, API/backend, pipeline, limit atau mekanisme ekspor. Smoke browser awal diperbaiki agar menunggu render dan memisahkan tap dari screenshot full-page yang mengubah viewport; interaksi sentuhan memakai pointer event agar hover sintetis tidak membuka ulang bantuan.
- Bukti lokal: .test-artifacts/ui-2c1-{build,lint,test}.log dan .runtime/ui-2c1/browser-check.json serta screenshot. Selector smoke script lama disesuaikan dengan disclosure baru; pipeline tidak dijalankan ulang.
- Batas: Impeccable belum dipasang/dijalankan, Tahap 2C.2 menunggu review pengguna. Batas ilmiah dan operasional Tahap 2B tetap berlaku. Pengguna dapat refresh halaman publik untuk melihat build baru.

## Git dan batas perubahan

- Worktree: /home/zizi/projects/genopath-demo-20261110
- Branch: feature/fe-be-integration-demo
- Basis backend development e0b94af; snapshot frontend Azril ca03a33, diport selektif.
- A/B: 85fc09b, aaa136b, 7ba500f, d0e1258. Build/lint, 39 FE test dan 657 BE targeted test adalah bukti sesi A/B.
- 2B: b6d16f9 ekspor backend, 665f019 integrasi ekspor FE, 76cec73 runtime/gate, b67d21d adaptasi visual, 1b2b1ea freeze lokal, 6f1747a verifikasi alur publik. HEAD juga mencakup checkpoint rehearsal Default dan konfirmasi jaringan pengguna ini.
- Main worktree tetap feature/be-m8-bowtie2-e2e@3a90689 dan bersih; stash@{0} 102de01 dipertahankan. Remote github. Tidak ada push, merge, PR, perubahan branch tim, atau modifikasi dokumen resmi.
- Git worktree valid. Attachment Codex belum mengenali path setelah perpindahan dari managed path; gunakan path eksplisit di atas.
- Secret, database, dataset/index, binary, cache, dan artefak tidak dikomit. .runtime/, .tools/, .test-artifacts/ diabaikan Git. File rahasia mode 0600; private-value scan staged content PASS.

## Hasil nyata dan batas klaim

- Browser Edge 157: gate, register/login, pilih FASTQ/config tanpa POST, submit 202, Queued/Running/Completed, Nextflow, tool biologis, VCF, ingest PostgreSQL, Result Viewer, refresh/direct URL PASS.
- Job #1/#2/#3: input FASTQ plain. Job #6: gzip yang diunduh dari aplikasi setelah login. Seluruh Job positif menghasilkan 2 record: SNP 5001 A>C dan insertion 12001 A>ACGT, GT asli 0/1, FORMAT/DP 60. QUAL analisis 25, DP 8, ploidi 2.
- Input sintetis terkontrol dari generator repo seed 20261104: reference 20.000 bp, 7.942 read single-end 150 bp Q40, depth nominal 59,565. Bukan DNA biologis nyata, bukan Garlic.V2, bukan validasi ilmiah full genome.
- Reference ID 1 dan tiny Bowtie2 index cocok, diverifikasi dengan rekonstruksi FASTA/digest. Tidak melakukan full-genome indexing.
- Job #4: QUAL 999 benar-benar diteruskan ke Nextflow, Completed dengan 0 Variant/Genotype; VCF header dan CSV header valid. Empty state browser PASS.
- Job #5: reference/index sengaja mismatch, Nextflow nyata gagal, status Failed, error tersanitasi, tanpa Analysis/varian palsu. Browser Failed/refresh PASS. Reference negatif dipindahkan ke .runtime/negative-evidence/ dan tidak muncul sebagai opsi aktif.
- UUID identik dengan file/parameter sama mengembalikan Job sama tanpa dispatch ulang setelah Completed. Replay Queued serta pembatas global lintas owner diuji pada PostgreSQL.
- Anonymous dan token invalid ditolak; user lain menerima 404 untuk Job/result/variants/VCF/CSV.
- Bukti lokal: .runtime/evidence/browser-e2e.json, browser-review.json, additional-runtime.json, postgres-check.json; screenshot dan unduhan; run/log/params Nextflow pada .runtime/jobs/. Semuanya tetap lokal.

## Runtime terisolasi

- Database baru: genopath_demo_20261110_2231b2, restricted role bernama sama, schema head 0005_analysis_identity (sebelum Tahap 2C.2: 0004_m9_result_indexes). Identitas database dan role diverifikasi sebelum mutasi.
- genopath_db dan genopath_integration_test tidak dimutasi atau dibersihkan.
- PostgreSQL Windows 18.6; Python environment existing digunakan read-only. Java 21.0.13+9, Nextflow 25.10.9, fastp 1.0.1, Bowtie2 2.5.4, SAMtools 1.22.1, BCFtools 1.22.
- Executable existing di main workspace digunakan read-only; HOME/cache/work/output baru diarahkan ke worktree demo. Folder toolchain dan .venv existing tetap menjadi dependensi restart.
- Server production aktif hanya di 127.0.0.1:3000, SPA build + API /api same-origin. Vite dev dan server 8000 dihentikan.
- Upload 10 MiB; 1 Queued/Running Job global memakai PostgreSQL advisory lock; 2 thread; timeout 600 detik. Session gate 16 jam. JWT GenoPath terpisah dan tetap wajib.
- WSL sekitar 15 GiB RAM, swap 4 GiB; C: sekitar 92 GiB kosong saat preflight. Beban tiny fixture terbukti selesai. Target final 32 GB host/full Garlic.V2/FASTQ 1 GB belum divalidasi.

## Ekspor dan input rehearsal

- GET /jobs/{id}/vcf: seluruh selected.vcf hasil seleksi analisis, bukan raw caller VCF dan bukan filter tampilan. JWT/ownership/Completed, run ID/path metadata, traversal/symlink, file regular/size/header/record count diperiksa; streaming descriptor.
- GET /jobs/{id}/csv: seluruh record sesuai filter server variant_type/min_qual/max_qual, bukan satu halaman. Batch 200 dan snapshot read-only; ALT multiallelic/GT asli/null dipertahankan, escaping CSV dan proteksi formula spreadsheet.
- Browser nyata: VCF dan CSV masing-masing 2 record; CSV filter SNP 1 record. File dapat dibaca dan jumlahnya cocok sumber. Ekspor 509 record, missing/invalid file, unsafe path, status, ownership, null, escaping/formula diuji pada fixture terisolasi.
- Tombol unduh menyampaikan loading/error dan scope. JWT hanya header, tidak dalam URL.
- GET /api/demo/reads.fastq.gz hanya pada runtime demo, memerlukan gate + JWT, menyajikan satu fixture tetap. Tombol “Unduh FASTQ contoh sintetis” memberi file yang byte-nya cocok generator; bukan data Garlic.V2.
- Urutan rehearsal: password demo → register/login GenoPath → Analisis Baru → unduh contoh sintetis → pilih file unduhan → reference fixture ID 1 → ploidi 2 → default QUAL 30/DP 10 atau Advanced 25/8 → Jalankan → monitor → hasil → VCF/CSV.
- Jangan gunakan file besar atau menyebut hasil sintetis sebagai validasi biologis.

## Gate dan Cloudflare

- Gate ditegakkan server pada halaman, assets, dan seluruh API termasuk register/login/upload/start/download. Bukan guard JavaScript.
- Argon2id, signed HttpOnly/Secure/SameSite cookie, CSRF, batas 6 percobaan/IP/menit dan 30 global/menit. Traversal static, favicon CSRF, tampered cookie, expiry, rotasi password dan fail-closed diuji.
- Password final ditetapkan pengguna dengan input tersamar 12–128 karakter, dua kali. Raw password tidak disimpan. Hash/key pada .runtime/gate.json; rotasi tidak perlu restart.
- CLI menguji password lokal dan menyimpan hanya sesi yang benar-benar diterbitkan server pada file privat .runtime/gate-check-session.json untuk pengujian HTTPS otomatis. Pengujian otomatis tersebut terpisah dari konfirmasi pengguna yang memasukkan password final melalui formulir HTTPS publik pada PC dan HP.
- cloudflared portable resmi versi 2026.10.7 tersedia di .tools/, SHA-256 cocok digest release. Tidak memasang service, mengubah firewall/OS, atau mengubah konfigurasi sistem. Tunnel diaktifkan setelah persetujuan khusus pengguna.
- Launcher menolak password sementara, memeriksa revision gate yang berjalan serta digest binary sebelum publikasi.
- Approval aktivasi publik diterima pada percakapan ini. Tunnel aktif sejak 10 November 2026 sekitar 20.14 WIB, hanya menuju server loopback 3000. Database dan backend port 8000 tidak dibuka ke internet. Metrics cloudflared tetap loopback 20241.
- Quick Tunnel bersifat sementara, tanpa jaminan uptime, hostname berubah setelah restart, batas 200 in-flight requests dan tidak mendukung SSE. Aplikasi memakai polling.
- Rujukan resmi: https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/
- Public HTTPS/TLS serta Cloudflare edge PASS. Tanpa gate, halaman/assets/API auth/upload/start/download mendapat 401. JWT sah tanpa gate tetap ditolak; cookie gate tampered dan JWT invalid untuk ekspor ditolak.
- Browser melalui URL publik PASS: register/login GenoPath, download input sintetis gzip, pilih file/config tanpa POST, submit, Queued/Running/Completed Job #7, Nextflow, hasil, refresh/direct URL, light/dark/mobile, VCF/CSV, filter SNP, replay dan ownership. Browser memakai sesi gate sah yang diterbitkan saat verifikasi password lokal, bukan password mentah atau sesi yang dipalsukan.
- Job #7: 2 Variant/2 Genotype PostgreSQL; VCF unduhan 3.345 byte identik dengan selected.vcf pipeline dan seluruh CHROM/POS/REF/ALT/QUAL/GT/DP cocok database. CSV 167 byte berisi 2 record, filter SNP 1 record. Parameter file Nextflow nyata QUAL 25/DP 8, 2 thread, ploidi 2.
- Browser HTTPS juga memverifikasi hasil kosong Job #4, Failed Job #5 dan refresh, upload/config mobile serta homepage tanpa menjalankan pipeline ulang.
- Bukti publik terpisah pada .runtime/evidence/public/: browser-e2e.json, browser-review.json, postgres-export-check.json, api-gate-check.json, result-render-check.json, tunnel-status.json, screenshot dan file ekspor. Bukti localhost sebelumnya tetap dipertahankan.
- Konfirmasi pengguna: Chrome Incognito PC menerima password demo dan menampilkan login GenoPath; Chrome HP melalui Wi-Fi hotspot berbasis data seluler menerima password dan membuka GenoPath dari jaringan berbeda. Keduanya PASS berdasarkan laporan pengguna, bukan hasil otomatis agen. Bukti ringkas tersimpan terpisah pada .runtime/evidence/public/user-network-confirmation.json. Field password-entry pada JSON test otomatis tetap menjelaskan cakupan otomatis, tidak menggantikan konfirmasi pengguna ini.
- Rehearsal Default melalui URL publik: Job #8, Advanced tetap tertutup, QUAL 30/DP 10 benar-benar masuk file parameter Nextflow, Completed dengan 2 Variant/2 Genotype. Download VCF identik artefak pipeline; VCF/CSV/filter/replay/ownership/refresh/mobile/dark PASS.
- FASTQ dengan panjang sekuens dan quality tidak cocok ditolak 422 melalui UI publik. PostgreSQL membuktikan hanya 1 Sample dan 1 Job milik akun rehearsal tersebut, tanpa tambahan dari upload invalid. Formulir kembali terbuka dan pemilihan file koreksi tidak mengirim POST otomatis. Bukti disimpan pada .runtime/evidence/public/default/, terpisah dari Job #7 dan bukti localhost.
- Batas pembuktian: pipeline penuh otomatis diuji dari PC melalui edge Cloudflare; pengujian pengguna di HP membuktikan HTTPS, password gate dan halaman GenoPath, bukan keseluruhan pipeline di HP. Rehearsal langsung oleh Azril belum diklaim selesai. PID server/tunnel dan URL diverifikasi tetap sama, tanpa restart.

## UI dan validasi

- Identitas biru GenoPath, struktur navigasi, komponen Azril, login/register, light/dark tetap dipertahankan.
- Background kampus dibatasi homepage dengan overlay; halaman operasional netral. Kartu lebih solid, tipografi/kontras/focus/reduced-motion diperbaiki; navbar mobile dua baris; label/autocomplete login diperbaiki.
- Upload/config, monitoring, hasil, empty/failed, homepage, light/dark dan 390 px ditinjau melalui screenshot browser nyata. Tabel varian scroll horizontal lokal.
- Copy 1 GB dibedakan sebagai target final; batas runtime tampil dari server. Tidak ada redesign penuh.
- Impeccable belum dipasang. Dokumentasi saat ini mendukung targeted critique/audit/polish, tetapi installer menambah skill/hook dan live mode memiliki fallback bypass permission. Freeze memakai polish manual; evaluasi pinned non-live setelah demo dengan approval instalasi.
- Rujukan: https://github.com/pbakaus/impeccable

| Validasi 2B | Hasil |
| --- | --- |
| Production build TypeScript/Vite | PASS |
| ESLint | PASS |
| Frontend tests | PASS 44 |
| Backend regression terarah, 8 file | PASS 263 |
| Gate final, termasuk traversal static | PASS 18, merupakan pengulangan subset + tambahan |
| Masked setup/private session/launcher guard | PASS 3 |
| Live PostgreSQL + Nextflow fixture plain/gzip | PASS |
| Browser VCF/CSV, filter, ownership, replay, mobile, empty/failed | PASS |
| Cloudflare HTTPS dan browser E2E melalui URL publik dari PC host | PASS, Job #7 |
| Browser publik mode Default dan FASTQ invalid | PASS, Job #8, QUAL 30/DP 10; invalid 422 tanpa Sample/Job tambahan |
| Password gate HTTPS PC Incognito + HP jaringan data seluler | PASS berdasarkan konfirmasi pengguna |
| PC sleep policy/full pipeline di HP/rehearsal langsung Azril | Belum terverifikasi |
| Full Garlic.V2/1 GB/annotation/Impeccable | SKIP, di luar freeze |

Dua warning deprecation BE berasal dari Starlette/httpx/anyio. Tidak mengklaim test historis sebagai current run atau mengakumulasi pengulangan menjadi jumlah test unik.

## Startup, shutdown, recovery dan fallback

Di terminal WSL, masuk worktree demo di atas. Gunakan:
    /home/zizi/projects/genopath-backend/.venv/bin/python -B -m scripts.demo_runtime password

Password hanya diketik pada prompt terminal, jangan kirim lewat chat. Password akun GenoPath tetap berbeda. Sesudah password tersimpan, buka http://localhost:3000/login untuk login gate lalu GenoPath.

Server sudah berjalan dari sesi lokal Codex. Bila perlu restart, hentikan proses server milik demo dengan Ctrl+C setelah memastikan tidak ada Job aktif, lalu:
    /home/zizi/projects/genopath-backend/.venv/bin/python -B -m scripts.demo_runtime web

Tunnel saat ini sudah aktif dan tidak perlu dijalankan ulang. Hanya bila koneksi terputus, gunakan terminal terpisah untuk memulihkan; hostname akan berubah:
    /home/zizi/projects/genopath-backend/.venv/bin/python -B -m scripts.demo_runtime tunnel

Pertahankan proses web, tunnel, PostgreSQL Windows, PC, WSL, dan jaringan. Jangan restart tunnel tanpa perlu; catat URL baru jika koneksi harus dipulihkan. Ctrl+C pada terminal tunnel menghentikan publikasi. Tidak ada service autostart yang dipasang.

BackgroundTasks bukan antrean durable: restart saat Job aktif memerlukan rekonsiliasi, jangan langsung retry UUID baru atau mengubah status manual. Bila public/tunnel bermasalah, fallback localhost, hasil Completed tersimpan, VCF/CSV asli, dan screenshot teknis asli. Semua bukti tetap diberi label sintetis. Kebijakan sleep Windows belum terverifikasi; pengguna perlu menjaga host tetap menyala dan tidak sleep.

## Handoff singkat untuk Azril

- URL: https://namely-year-father-fifth.trycloudflare.com
- Masukkan password demo yang dibagikan pengguna secara privat, kemudian register/login akun GenoPath sendiri.
- Analisis Baru → Unduh FASTQ contoh sintetis → pilih file unduhan → reference Fixture sintetis 20 kbp ID 1 → ploidi 2 → default QUAL 30/DP 10 atau Advanced 25/8 → Jalankan Analisis → monitor → Lihat Hasil → VCF/CSV.
- Contoh ini hanya pembuktian teknis sintetis; tidak memvalidasi Garlic.V2. Upload maksimal 10 MiB dan satu Job aktif global. Jika sibuk, tunggu Job aktif selesai.
- Jangan restart tunnel yang masih sehat; URL berubah bila tunnel dibuat ulang. Tidak ada pesan WhatsApp/email yang dikirim otomatis.

Tindakan manual tersisa: bagikan URL/password secara privat kepada Azril untuk rehearsal; jaga PC/WSL/PostgreSQL/jaringan tetap hidup dan tidak sleep. Pengujian password/network, penetapan password final, dan approval tidak perlu diulang. Tidak ada kebutuhan restart tunnel atau perubahan URL saat ini.
