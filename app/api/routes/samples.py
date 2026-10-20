from threading import Lock
from collections.abc import Callable
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.api.dependencies import get_upload_owner_id, get_settings
from app.core.config import Settings
from app.database import get_session_factory
from app.schemas.auth import ErrorResponse
from app.schemas.sample import SampleUploadResponse
from app.services.fastq import InvalidFastqError, InvalidFilenameError, UploadLimitError
from app.services.multipart_upload import (
    MultipartError, UploadFieldsError, UploadMediaTypeError, receive_upload,
)
from app.services.storage import StorageError
from app.services.samples import persist_upload
from app.services.upload_validation import ValidationBudgetError


router = APIRouter(prefix="/samples", tags=["samples"])
# Shared by app instances in this process. Multiple Uvicorn workers have own slots.
upload_slot = Lock()


@router.post(
    "/upload",
    response_model=SampleUploadResponse,
    status_code=201,
    summary="Upload a FASTQ file and create its Sample metadata",
    description="Store one validated FASTQ file owned by the authenticated user.",
    responses={code: {"model": ErrorResponse} for code in (400, 401, 413, 415, 422, 503)},
    openapi_extra={"requestBody": {
        "required": True,
        "content": {"multipart/form-data": {"schema": {
            "type": "object", "required": ["file"], "additionalProperties": False,
            "properties": {"file": {"type": "string", "format": "binary"}},
        }}},
    }},
)
async def upload_sample(
    request: Request,
    id_user: Annotated[int, Depends(get_upload_owner_id)],
    settings: Annotated[Settings, Depends(get_settings)],
    session_factory: Annotated[Callable[[], Session], Depends(get_session_factory)],
) -> SampleUploadResponse:
    # No File/Form/Body parameter: FastAPI resolves auth BEFORE we touch receive.
    if not upload_slot.acquire(blocking=False):
        raise HTTPException(503, "Upload capacity unavailable.", headers={"Retry-After": "1"})
    try:
        async with receive_upload(request, settings) as incoming:
            return await persist_upload(
                incoming.file, incoming.filename, settings, id_user, session_factory,
            )
    except UploadMediaTypeError:
        raise HTTPException(415, "Expected multipart/form-data.") from None
    except MultipartError:
        raise HTTPException(400, "Malformed or incomplete upload request.") from None
    except UploadLimitError:
        raise HTTPException(413, "Upload resource limit exceeded.") from None
    except (UploadFieldsError, InvalidFilenameError, InvalidFastqError, ValidationBudgetError):
        raise HTTPException(422, "Invalid upload or validation budget exceeded.") from None
    except (StorageError, OSError):
        raise HTTPException(503, "Upload service unavailable.") from None
    finally:
        upload_slot.release()
