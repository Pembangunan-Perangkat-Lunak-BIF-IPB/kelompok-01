from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SampleUploadResponse(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid", hide_input_in_errors=True)

    id_sample: int = Field(gt=0)
    nama_berkas: str
    ukuran_berkas: int = Field(ge=0)
    waktu_unggah: datetime
