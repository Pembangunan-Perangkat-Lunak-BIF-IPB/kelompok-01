"""Owned selected-VCF and bounded-memory CSV exports; no client filesystem paths."""
import csv
from contextlib import ExitStack
import io
import os
from pathlib import Path
import re
import stat

from sqlalchemy import func, select
from app.models import Genotype, Variant
from app.services.results import owned_result, read_session, unclassified_type
from app.services.vcf_records import read_vcf_records


class ArtifactUnavailable(ValueError):
    pass


def selected_vcf(factory, settings, identifier, owner):
    with read_session(factory) as db:
        job, analysis = owned_result(db, identifier, owner)
        configuration = job.parameter_pipeline if isinstance(job.parameter_pipeline, dict) else {}
        run_id = configuration.get("run_id")
        if not isinstance(run_id, str) or not re.fullmatch(r"[a-f0-9]{32}", run_id):
            raise ArtifactUnavailable()
        if analysis.path_vcf != run_id + "/selected.vcf":
            raise ArtifactUnavailable()
        request = configuration.get("request", {})
        sample_name = request.get("vcf_sample") if isinstance(request, dict) else None
        if not isinstance(sample_name, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,63}", sample_name):
            raise ArtifactUnavailable()
        expected_count = db.scalar(select(func.count()).select_from(Variant).where(Variant.id_analysis == analysis.id_analysis))
    directory = None
    stream = None
    try:
        root = Path(os.path.abspath(settings.pipeline_root))
        flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
        directory = os.open(root.anchor, flags)
        for component in (*root.parts[1:], run_id):
            child = os.open(component, flags, dir_fd=directory)
            os.close(directory)
            directory = child
        descriptor = os.open("selected.vcf", os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=directory)
        stream = os.fdopen(descriptor, "rb")
        info = os.fstat(stream.fileno())
        if not stat.S_ISREG(info.st_mode) or not 0 < info.st_size <= 1_000_000_000:
            raise ArtifactUnavailable()
        if not stream.readline(128).startswith(b"##fileformat=VCFv4."):
            raise ArtifactUnavailable()
        actual_count = 0
        for record in read_vcf_records(Path(f"/proc/self/fd/{stream.fileno()}"), sample_name):
            actual_count += 1
            if actual_count > expected_count:
                raise ArtifactUnavailable()
        if actual_count != expected_count:
            raise ArtifactUnavailable()
        stream.seek(0)
        return stream, info.st_size
    except (OSError, ValueError):
        if stream is not None:
            stream.close()
        raise ArtifactUnavailable() from None
    finally:
        if directory is not None:
            os.close(directory)


def file_chunks(stream, size):
    try:
        while size:
            chunk = stream.read(min(size, 64 * 1024))
            if not chunk:
                raise OSError("Artifact truncated during export.")
            size -= len(chunk)
            yield chunk
    finally:
        stream.close()


def csv_cell(value):
    if value is None:
        return ""
    if isinstance(value, str) and (re.match(r"^\s*[=+\-@]", value) or value.startswith(("\t", "\r", "\n"))):
        return "'" + value
    return value


def csv_export(factory, identifier, owner, filters):
    # Resolve ownership/readiness BEFORE sending HTTP headers; keep one read-only
    # snapshot until the stream ends. ExitStack.close is safe to call twice.
    stack = ExitStack()
    try:
        db = stack.enter_context(read_session(factory))
        job, analysis = owned_result(db, identifier, owner)
        conditions = [Variant.id_analysis == analysis.id_analysis]
        if filters.variant_type == "unclassified":
            conditions.append(unclassified_type())
        elif filters.variant_type is not None:
            conditions.append(Variant.variant_type == filters.variant_type)
        if filters.min_qual is not None:
            conditions.append(Variant.qual >= filters.min_qual)
        if filters.max_qual is not None:
            conditions.append(Variant.qual <= filters.max_qual)
    except BaseException:
        stack.close()
        raise

    def chunks():
        try:
            buffer = io.StringIO(newline="")
            writer = csv.writer(buffer, lineterminator="\r\n")
            writer.writerow(["JOB_ID", "SAMPLE_ID", "CHROM", "POS", "REF", "ALT", "QUAL", "GT", "DP", "FILTER", "TYPE"])
            yield buffer.getvalue().encode("utf-8")
            last_id = 0
            while True:
                rows = db.scalars(select(Variant).where(*conditions, Variant.id_variant > last_id)
                                  .order_by(Variant.id_variant).limit(200)).all()
                if not rows:
                    break
                calls = {row.id_variant: [] for row in rows}
                for call in db.scalars(select(Genotype).where(
                    Genotype.id_variant.in_(calls), Genotype.id_sample == job.id_sample,
                ).order_by(Genotype.id_genotype)):
                    calls[call.id_variant].append(call)
                buffer.seek(0)
                buffer.truncate()
                for row in rows:
                    genotypes = calls[row.id_variant]
                    writer.writerow([csv_cell(value) for value in [
                        job.id_job, job.id_sample, row.chromosome, row.position, row.ref_allele, row.alt_allele, row.qual,
                        ";".join(call.genotype_call for call in genotypes),
                        ";".join("" if call.dp is None else str(call.dp) for call in genotypes),
                        row.filter_status, row.variant_type,
                    ]])
                yield buffer.getvalue().encode("utf-8")
                last_id = rows[-1].id_variant
                db.expunge_all()
        finally:
            stack.close()
    return chunks(), stack.close
