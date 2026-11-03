"""Read-only, owned result queries; pagination never joins/multiplies GT rows."""

from contextlib import contextmanager
from datetime import timezone

from sqlalchemy import case, func, or_, select, text

from app.models import Analysis, Genotype, Job, Sample, Variant
from app.schemas.result import (
    GenotypeResult, ResultParameters, ResultSummary, VariantCounts, VariantFilters,
    VariantPage, VariantQuery, VariantResult,
)


class ResultNotFound(ValueError):
    pass


class ResultNotReady(ValueError):
    pass


@contextmanager
def read_session(factory):
    with factory() as db, db.begin():
        db.autoflush = False
        if db.get_bind().dialect.name == "postgresql":
            # A stable snapshot keeps count and page consistent within a request.
            # PostgreSQL refuses accidental DML in this transaction as well.
            db.execute(text("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY"))
            db.execute(text("SET LOCAL statement_timeout = '10s'"))
        yield db


def owned_result(db, identifier, owner):
    row = db.execute(
        select(Job, Analysis)
        .join(Sample, Sample.id_sample == Job.id_sample)
        .outerjoin(Analysis, Analysis.id_job == Job.id_job)
        .where(Job.id_job == identifier, Job.id_user == owner, Sample.id_user == owner)
    ).one_or_none()
    if row is None:
        raise ResultNotFound()
    job, analysis = row
    if job.status != "Completed" or analysis is None:
        raise ResultNotReady()
    return job, analysis


def unclassified_type():
    return or_(Variant.variant_type.is_(None), Variant.variant_type.not_in(("snp", "indel", "other")))


def summary(factory, identifier, owner):
    with read_session(factory) as db:
        job, analysis = owned_result(db, identifier, owner)
        counts = db.execute(select(
            func.count(Variant.id_variant),
            *(func.count(case((Variant.variant_type == kind, 1))) for kind in ("snp", "indel", "other")),
            func.count(case((unclassified_type(), 1))),
        ).where(Variant.id_analysis == analysis.id_analysis)).one()
        configuration = job.parameter_pipeline
        request = configuration.get("request") if isinstance(configuration, dict) else None
        request = request if isinstance(request, dict) else {}
        mode = request.get("execution_mode")
        ploidy, require_pass = request.get("variant_ploidy"), request.get("require_pass")
        return ResultSummary(
            id_job=job.id_job, id_analysis=analysis.id_analysis, id_sample=job.id_sample,
            id_reference_genome=job.id_reference_genome, status="Completed",
            counts=VariantCounts(**dict(zip(("total_variants", "snps", "indels", "other", "unclassified"), counts))),
            parameters=ResultParameters(parameter_qual=analysis.parameter_qual, parameter_dp=analysis.parameter_dp,
                require_pass=require_pass if type(require_pass) is bool else None,
                variant_ploidy=ploidy if type(ploidy) is int and 1 <= ploidy <= 16 else None),
            execution_mode=mode if mode in ("synthetic", "nextflow") else None,
            waktu_mulai=job.waktu_mulai.replace(tzinfo=timezone.utc) if job.waktu_mulai else None,
            waktu_selesai=job.waktu_selesai.replace(tzinfo=timezone.utc) if job.waktu_selesai else None,
        )


def variants(factory, identifier, owner, query: VariantQuery):
    with read_session(factory) as db:
        job, analysis = owned_result(db, identifier, owner)
        conditions = [Variant.id_analysis == analysis.id_analysis]
        if query.variant_type == "unclassified":
            conditions.append(unclassified_type())
        elif query.variant_type is not None:
            conditions.append(Variant.variant_type == query.variant_type)
        if query.min_qual is not None:
            conditions.append(Variant.qual >= query.min_qual)
        if query.max_qual is not None:
            conditions.append(Variant.qual <= query.max_qual)
        total = db.scalar(select(func.count()).select_from(Variant).where(*conditions))
        page = db.scalars(select(Variant).where(*conditions).order_by(Variant.id_variant)
                          .limit(query.limit).offset(query.offset)).all()
        calls = {variant.id_variant: [] for variant in page}
        if calls:
            # One bounded query for the page, only for the Job's mapped Sample.
            for genotype in db.scalars(select(Genotype).where(
                Genotype.id_variant.in_(calls), Genotype.id_sample == job.id_sample,
            ).order_by(Genotype.id_genotype)):
                calls[genotype.id_variant].append(GenotypeResult(
                    id_genotype=genotype.id_genotype, id_sample=genotype.id_sample,
                    genotype_call=genotype.genotype_call, dp=genotype.dp))
        items = [VariantResult(
            id_variant=v.id_variant, chromosome=v.chromosome, position=v.position,
            ref_allele=v.ref_allele, alt_allele=v.alt_allele, qual=v.qual,
            variant_type=v.variant_type, filter_status=v.filter_status, info=v.info,
            genotypes=calls[v.id_variant],
        ) for v in page]
        following = query.offset + len(items)
        has_more = following < total
        return VariantPage(id_job=job.id_job, id_analysis=analysis.id_analysis, items=items,
            total=total, limit=query.limit, offset=query.offset, returned=len(items),
            has_more=has_more, next_offset=following if has_more else None,
            filters=VariantFilters(**query.model_dump(exclude={"limit", "offset"})))
