# GenoPath

<!-- impeccable:product-schema 1 -->

## Platform
web

## Users
Mahasiswa bioinformatika, akademisi dan peneliti yang membutuhkan analisis varian DNA Allium sativum tanpa menjalankan command line.

## Product Purpose
Menghubungkan FASTQ single-end, konfigurasi yang jelas, pemantauan pipeline, dan hasil varian yang dapat ditelusuri serta diunduh.

## Positioning
Ruang kerja analisis varian bawang putih yang menghubungkan data pengguna dengan pipeline fastp, Bowtie2, SAMtools dan BCFtools melalui Nextflow.

## Operating Context
React/TypeScript/Vite, FastAPI, JWT, PostgreSQL, Nextflow. Pengguna login, memilih FASTQ, memberi nama analisis, memilih reference/ploidi dan threshold, mengirim secara eksplisit, memantau, lalu meninjau dan mengekspor hasil. Empat tujuan utama memakai navigasi horizontal: Beranda /, Dashboard /dashboard, Riwayat /riwayat dan Analisis Baru /analisis-baru. Breadcrumb memberi konteks pemantauan /jobs/:jobId dan hasil /jobs/:jobId/result. Dashboard menghubungkan record Completed terbaru, ringkasan aktual Result API, provenance dan analisis aktif/gagal yang perlu perhatian. Tidak ada ringkasan tiga metrik agregat atau progress tahap rekaan. Form menempatkan field dan review konfigurasi berdampingan pada desktop, lalu menumpuk pada layar sempit.

## Capabilities and Constraints
Single-end only. QUAL dan FORMAT/DP terhubung ke pipeline. UUID, recovery/reconciliation, ownership, profil /auth/me, filter server-side dan ekspor VCF/CSV wajib dipertahankan. Hasil dan statistik berasal dari API. Runtime demo memakai fixture sintetis 20 kbp, upload 10 MiB dan satu Job aktif global. Full Garlic.V2 dan FASTQ 1 GB belum tervalidasi. Tidak menambah annotation, custom reference, grafik atau backend baru.

## Brand Commitments
Identitas GenoPath dan bioinformatika bawang putih. Background kampus, Uchiha.jpg, u1-u5, mapping kontributor, nama/NIM/peran dan interaksi asli Azril dipertahankan. Hi-Fi/Lo-Fi hanya referensi historis, bukan otoritas visual. Beranda ekspresif, halaman kerja tenang. Overhaul workspace dan refinement identitas masih PROPOSED, menunggu review tim; navbar horizontal mengikuti kontinuitas original Azril. Bahasa Indonesia ringkas; tanpa Unicode em dash atau en dash pada copy aplikasi.

## Evidence on Hand
Baseline M10 8b71771aaa10eed2f59142d70408759fdda17357. Completed sintetis dan ekspor nyata tersedia di runtime M10. Bukti teknis bukan validasi biologis Garlic.V2. Jangan mengarang progress, statistik, hasil, checksum atau genotype.

## Product Principles
- Konteks analisis selalu terlihat pada saat mengambil keputusan.
- Tindakan dan status harus dapat dibedakan dengan cepat.
- Data ilmiah utuh, keterbatasan terbaca.
- Komponen bersama membuat tiga developer bekerja konsisten.
- Fondasi diprioritaskan sebelum polish tambahan.

## Accessibility & Inclusion
Light/dark, keyboard, focus terlihat, contrast teks minimal 4.5:1, mobile, zoom dan reduced-motion. Tidak melemahkan gate/JWT untuk preview atau pengujian.
