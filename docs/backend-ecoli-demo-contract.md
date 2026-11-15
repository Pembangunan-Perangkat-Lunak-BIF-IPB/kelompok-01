# Backend integration: E. coli demo

Backend contract for the `NC_000913.3` / `SRR522156` biological demo. The web app may add `/api` through its proxy; these are the FastAPI route paths.

All routes below require `Authorization: Bearer <access_token>` from `POST /auth/login`. `/jobs/options` is authenticated and does not expose filesystem paths.

## Reference choices

`GET /jobs/options` returns the submission limits and references. Identify the demo by `is_demo: true`; display its label as **Untuk demo**. The ID is assigned by the database migration and must be read from this response, never hardcoded.

```json
{
  "pipeline_enabled": false,
  "alignment_strategy": null,
  "upload_max_bytes": 1000000000,
  "variant_ploidies": [1, 2],
  "references": [{
    "id_reference_genome": 7,
    "nama_genom": "Escherichia coli K-12 MG1655",
    "versi": "NC_000913.3 / GCF_000005845.2 ASM584v2",
    "sumber": "NCBI RefSeq; demo dataset SRR522156",
    "accession": "NC_000913.3",
    "strain": "K-12 MG1655",
    "is_demo": true
  }]
}
```

The ID `7` is illustrative. On this checkout, the migration registers a row; it appears in the API only after the FASTA has been installed beneath the configured `GENOPATH_REFERENCE_ROOT`.

## Download and normal upload

`GET /samples/demo-fastq` returns the original gzip-compressed FASTQ as an attachment named `ecoli-k12-mg1655-demo.fastq.gz`, with `Content-Type: application/gzip`. It is authenticated, owner-context checked, and serves only the fixed demo asset under the reference root. It returns 404 if the asset is not installed.

Upload the downloaded file through the ordinary endpoint:

```http
POST /samples/upload
Authorization: Bearer <access_token>
Content-Type: multipart/form-data; boundary=...

file=<ecoli-k12-mg1655-demo.fastq.gz>
```

Example success body:

```json
{
  "id_sample": 12,
  "nama_berkas": "ecoli-k12-mg1655-demo.fastq.gz",
  "ukuran_berkas": 35173963,
  "waktu_unggah": "2026-11-15T10:00:00"
}
```

The upload path applies the existing authentication, FASTQ validation, owner assignment and upload limits. `/jobs/options.upload_max_bytes` reports the current backend limit; this checkout defaults to 1,000,000,000 bytes. The target deployment may override it.

## Submit and start a normal Job

Use the `id_sample` returned by upload and the E. coli `id_reference_genome` returned by `/jobs/options`:

```http
POST /jobs
Authorization: Bearer <access_token>
Content-Type: application/json
```

```json
{
  "id_sample": 12,
  "id_reference_genome": 7,
  "request_id": "2df7da1b-4c74-47b7-b572-d2ab740f4529",
  "vcf_sample": "SRR522156",
  "parameter_qual": 30,
  "parameter_dp": 10,
  "require_pass": true,
  "execution_mode": "nextflow",
  "variant_ploidy": 1
}
```

`201` returns a `JobResponse` containing the persisted `id_reference_genome` and `status: "Queued"`. Start it through `POST /jobs/{id_job}/start` (202), then poll `GET /jobs/{id_job}`. The job runner resolves the selected database reference's FASTA and its per-reference Bowtie2 prefix; it does not substitute a demo FASTA for a different selected reference.

The biological runner remains operator-gated. `GET /jobs/options` reports `pipeline_enabled`; a real Nextflow run additionally requires the configured alignment strategy/adapter, Bowtie2 tools and index, Nextflow, fastp, samtools, bcftools, and a local profile. Submission/start responses are not pipeline completion. Results use the existing `/jobs/{id_job}/result`, `/variants`, `/vcf`, and `/csv` APIs.

## Local asset and database setup

The benchmark FASTA, original FASTQ and six prebuilt index files remain in ignored `build/` assets. Install their verified copies below the active reference root (default `data/reference`):

```bash
python3 scripts/install_ecoli_biological_demo_assets.py
```

The installer checks all eight source SHA-256 values against the benchmark manifest and refuses to overwrite different destination files. Apply Alembic migration `0006_ecoli_biological_demo` after the installed files are in place. For a custom reference root, pass `--reference-root` to the installer and set the same `GENOPATH_REFERENCE_ROOT` for the service.

The FASTQ is authentic single-end genomic DNA WGS. The run is strain-matched at the metadata level but does not have a verified sample-matched independent truth set; mapping success does not validate variant-call accuracy.
