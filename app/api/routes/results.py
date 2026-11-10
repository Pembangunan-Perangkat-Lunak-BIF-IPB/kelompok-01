from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Response
from fastapi.responses import StreamingResponse
from starlette.background import BackgroundTask

from app.api.routes.jobs import Configuration, Factory, JobId, Owner
from app.schemas.auth import ErrorResponse
from app.schemas.result import ResultSummary, VariantFilters, VariantPage, VariantQuery
from app.services import downloads, results


router = APIRouter(prefix="/jobs", tags=["results"])
ERRORS = {code: {"model": ErrorResponse} for code in (401, 404, 409, 503)}


def invoke(function, *args):
    try:
        return function(*args)
    except results.ResultNotFound:
        raise HTTPException(404, "Requested result was not found.") from None
    except results.ResultNotReady:
        raise HTTPException(409, "Results are available only for Completed Jobs with an Analysis.") from None
    except downloads.ArtifactUnavailable:
        raise HTTPException(404, "Selected VCF artifact is unavailable.") from None


def private_response(response):
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["Pragma"] = "no-cache"


@router.get("/{id_job}/result", response_model=ResultSummary, responses=ERRORS,
            summary="Read an owned Completed Job's persisted result summary",
            description="Counts cover ALL persisted variants, independent of table filters. No alignment is executed. Unknown legacy types are counted separately as unclassified.")
def summary(id_job: JobId, owner: Owner, factory: Factory, response: Response):
    private_response(response)
    return invoke(results.summary, factory, id_job, owner)


@router.get("/{id_job}/variants", response_model=VariantPage, responses=ERRORS,
            summary="Read an owned variant page with its mapped Sample's genotype calls",
            description="SQL filtering with inclusive QUAL bounds; stable id_variant ASC order. total is after filters, before limit/offset. ALT/GT remain unchanged; missing QUAL does not match numeric bounds. Maximum limit 500, offset 2147483647. Not a file download.")
def variants(id_job: JobId, query: Annotated[VariantQuery, Query()], owner: Owner,
             factory: Factory, response: Response):
    private_response(response)
    return invoke(results.variants, factory, id_job, owner, query)


@router.get("/{id_job}/vcf", responses=ERRORS, summary="Download the owned Job's selected VCF",
            description="Full analysis selection, not raw caller VCF and not current display filters.")
def vcf(id_job: JobId, owner: Owner, factory: Factory, settings: Configuration):
    stream, size = invoke(downloads.selected_vcf, factory, settings, id_job, owner)
    return StreamingResponse(downloads.file_chunks(stream, size), media_type="text/vcf",
                             headers={"Content-Disposition": f'attachment; filename="GenoPath_Job_{id_job}_selected.vcf"',
                                      "Content-Length": str(size), "Cache-Control": "private, no-store",
                                      "X-Content-Type-Options": "nosniff"},
                             background=BackgroundTask(stream.close))


@router.get("/{id_job}/csv", responses=ERRORS, summary="Export all owned result rows matching filters",
            description="SQL filters before keyset batches of 200. No page limit. Empty values remain empty. "
                        "Formula-like spreadsheet text is prefixed with an apostrophe.")
def csv(id_job: JobId, filters: Annotated[VariantFilters, Query()], owner: Owner, factory: Factory):
    chunks, close = invoke(downloads.csv_export, factory, id_job, owner, filters)
    return StreamingResponse(chunks, media_type="text/csv; charset=utf-8",
                             headers={"Content-Disposition": f'attachment; filename="GenoPath_Job_{id_job}_filtered.csv"',
                                      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"},
                             background=BackgroundTask(close))
