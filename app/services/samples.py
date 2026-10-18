"""Short Sample transaction inside the validated upload's storage context."""

from collections.abc import Callable
from datetime import datetime, timezone
import logging
from threading import Event
from typing import BinaryIO

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models import Sample
from app.schemas.sample import SampleUploadResponse
from app.services.storage import StagedUpload
from app.services.upload_validation import UploadCancelled, stage_and_validate


logger = logging.getLogger(__name__)


def _persist_sample(
    upload: StagedUpload, stop: Event, id_user: int, session_factory: Callable[[], Session],
) -> SampleUploadResponse:
    if stop.is_set():
        raise UploadCancelled()
    # Created/used/closed in this thread, after transfer and subprocess validation.
    db = session_factory()
    commit_started = False
    committed = False
    primary = None
    try:
        timestamp = datetime.now(timezone.utc)
        sample = Sample(
            id_user=id_user,
            nama_berkas=upload.metadata.original_name,
            path_penyimpanan=upload.metadata.storage_key,
            ukuran_berkas=upload.metadata.size_bytes,
            # Existing schema is timestamp without time zone. Persist UTC explicitly.
            waktu_unggah=timestamp.replace(tzinfo=None),
        )
        db.add(sample)
        db.flush()
        # Snapshot/validate the response BEFORE commit; no expired ORM reads or
        # refresh query after a successful commit can turn success into failure.
        response = SampleUploadResponse(
            id_sample=sample.id_sample, nama_berkas=sample.nama_berkas,
            ukuran_berkas=sample.ukuran_berkas, waktu_unggah=timestamp,
        )
        if stop.is_set():
            raise UploadCancelled()
        upload.finalize()
        if stop.is_set():
            raise UploadCancelled()
        # Last cancellation checkpoint. Once preservation starts, finish the
        # commit attempt even if cancellation arrives; joined_thread waits for it.
        upload.preserve_for_reconciliation()
        commit_started = True
        db.commit()
        committed = True
        return response
    except BaseException as error:
        primary = error
        if commit_started:
            # Only server-generated keys/IDs. Never log the driver error, original
            # filename, SQL, connection details, credentials, or request contents.
            logger.warning(
                "Sample commit outcome unknown; reconciliation required: storage_key=%s id_sample=%s",
                upload.metadata.storage_key, response.id_sample,
            )
            error.add_note("Sample commit outcome unknown; file preserved for reconciliation.")
        try:
            db.rollback()
        except Exception:
            # Rollback after a failed COMMIT is not proof that COMMIT did not land.
            error.add_note("Sample transaction rollback failed; session cleanup required.")
        raise
    finally:
        try:
            db.close()
        except Exception:
            if primary is not None:
                primary.add_note("Sample session cleanup failed.")
            elif committed:
                # The response is already a DTO and both file and commit succeeded.
                logger.warning("Sample session cleanup failed after confirmed commit.")
            else:
                raise


async def persist_upload(
    source: BinaryIO, filename: str, settings: Settings, id_user: int,
    session_factory: Callable[[], Session],
) -> SampleUploadResponse:
    return await stage_and_validate(
        source, filename, settings,
        on_validated=lambda upload, stop: _persist_sample(upload, stop, id_user, session_factory),
    )
