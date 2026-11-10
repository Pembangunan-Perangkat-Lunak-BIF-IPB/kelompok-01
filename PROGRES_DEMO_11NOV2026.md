# Progres demo GenoPath — 11 November 2026

Scope sesi: Checkpoint A dan B; tanpa live E2E PostgreSQL/Nextflow, tunnel, atau polish besar.

## Checkpoint A

- Backend: `development@e0b94af42bc1b12f7d7b19cc83daea2f1a966367`.
- Frontend Azril: snapshot `ca03a33c4b3e37a027a88cc33c69d3f88610469e`, hanya direktori `frontend/`.
- Worktree: `/home/zizi/projects/genopath-demo-20261110`.
- Branch: `codex/demo-integration-20261110`.
- Workspace utama bersih; branch semula dan stash dipertahankan. Perubahan backend branch FE tidak diimpor.
- Keputusan client: single-end only. Full Garlic.V2/FASTQ 1 GB bukan scope sesi ini.

## Checkpoint B

- Backend: GET /jobs dengan ownership dan urutan terbaru; GET /jobs/options terautentikasi hanya mengembalikan reference tersedia beserta constraint, tanpa path internal. Respons baru private, no-store.
- Guard JWT, FASTQ, storage, receipt/flock, sanitasi error, dan runner tetap dari baseline backend.
- Regresi targeted awal: **656 PASS**, dua warning deprecation Starlette/httpx/anyio. Tidak memakai database utama; fixture SQLite/temporary files.
- Build awal frontend: **PASS**. Lint setelah normalisasi NBSP dan pemisahan context/hooks: **PASS**. Pengujian frontend awal: **34 PASS**.
- FAIL awal telah diperbaiki: direktori induk --basetemp belum dibuat; assertion inventaris OpenAPI belum mencakup /jobs/options; indentation NBSP pada salinan frontend tidak lolos lint.
- Perbaikan frontend dan validasi akhir masih berlangsung.

## Commit lokal

- 85fc09b — feat(fe): integrasikan frontend Azril dengan baseline backend GenoPath (Checkpoint A).
