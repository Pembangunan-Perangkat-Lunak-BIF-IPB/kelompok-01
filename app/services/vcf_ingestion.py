"""Atomic result ingestion, owned by the caller's Job completion transaction."""

from dataclasses import asdict
import json
import os

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Analysis, Genotype, Job, Variant
from app.services.pipeline import ExecutionPlan, PipelineFailure, PipelineResult, confined_file
from app.services.vcf_records import read_vcf_records
from app.services.vcf_summary import summarize_vcf


def ingest_result(db: Session, job: Job, plan: ExecutionPlan, result: PipelineResult) -> Analysis:
    """No commit here. Analysis, rows, and Completed status commit together.

    Legacy counts remain raw ALT-record counts. Stored counts instead describe
    the explicit PASS/QUAL/FORMAT-DP selection. Missing QUAL or DP is excluded,
    including at zero thresholds; exact duplicate input records remain records.
    A replay of an already persisted Job is refused, never appended.
    """
    if job.status != "Running" or job.id_sample != plan.request.id_sample:
        raise PipelineFailure("Job is not eligible for result ingestion.")
    if db.scalar(select(Analysis.id_analysis).where(Analysis.id_job == job.id_job)) is not None:
        raise PipelineFailure("Results already exist for this Job.")
    vcf = confined_file(plan.outdir, result.vcf)
    if vcf.stat().st_size > 1_000_000_000:
        raise PipelineFailure("VCF exceeds the ingestion size limit.")
    raw = summarize_vcf(vcf)
    analysis = Analysis(
        id_job=job.id_job, parameter_qual=plan.request.parameter_qual,
        parameter_dp=plan.request.parameter_dp, path_vcf=f"{plan.run_id}/selected.vcf",
        total_varian=0, snp_count=0, indel_count=0, other_count=0,
        metrik_qc=json.dumps({
            "raw_record_counts": asdict(raw), "selection": {
                "require_pass": plan.request.require_pass,
                "depth_source": "FORMAT/DP", "missing_qual_or_dp": "excluded",
                "multiallelic": "one Variant per record; original GT indexes preserved",
            }, "execution": {"mode": plan.request.execution_mode,
                             "alignment_strategy": plan.alignment_strategy, "run_id": plan.run_id,
                             "reference_agreement_validated": False}, "qc": result.qc,
        }, allow_nan=False),
    )
    db.add(analysis)
    db.flush()
    staged = plan.outdir / "selected.vcf.part"
    with staged.open("x", encoding="utf-8") as selected:
        with vcf.open(encoding="utf-8") as original:
            for line in original:
                if not line.startswith("#"):
                    break
                selected.write(line if line.endswith("\n") else line + "\n")
        for record in read_vcf_records(vcf, plan.request.vcf_sample):
            if (record.qual is None or record.dp is None
                    or record.qual < plan.request.parameter_qual or record.dp < plan.request.parameter_dp
                    or plan.request.require_pass and record.filters != "PASS"):
                continue
            variant = Variant(
                id_analysis=analysis.id_analysis, chromosome=record.chrom, position=record.position,
                ref_allele=record.ref, alt_allele=record.alt, qual=record.qual,
                variant_type=record.variant_type, filter_status=record.filters, info=record.info,
            )
            variant.genotypes = [Genotype(id_sample=job.id_sample, genotype_call=record.genotype, dp=record.dp)]
            db.add(variant)
            selected.write(record.source_line + "\n")
            analysis.total_varian += 1
            attribute = {"snp": "snp_count", "indel": "indel_count", "other": "other_count"}[record.variant_type]
            setattr(analysis, attribute, getattr(analysis, attribute) + 1)
            if analysis.total_varian % 200 == 0:
                db.flush()
        selected.flush()
        os.fsync(selected.fileno())
    db.flush()
    # Exclusive publication; a replay cannot overwrite a previous artifact.
    os.link(staged, plan.outdir / "selected.vcf")
    staged.unlink()
    return analysis
