from datetime import datetime
from uuid import UUID
from typing import Any
from pydantic import BaseModel, Field, ConfigDict

class UploadedAssetCreate(BaseModel):
    file_name: str = Field(..., max_length=255)
    file_type: str = Field(..., max_length=100)
    file_size_bytes: int = Field(..., gt=0)
    storage_key: str
    checksum_sha256: str = Field(..., min_length=64, max_length=64)
    width: int | None = None
    height: int | None = None
    project_id: UUID | None = None

class UploadedAssetResponse(BaseModel):
    id: UUID
    user_id: UUID
    project_id: UUID | None
    file_name: str
    file_type: str
    file_size_bytes: int
    storage_key: str
    checksum_sha256: str
    width: int | None
    height: int | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class GeneratedAssetResponse(BaseModel):
    id: UUID
    job_id: UUID
    user_id: UUID
    project_id: UUID
    file_format: str
    storage_key: str
    file_size_bytes: int
    checksum_sha256: str
    triangle_count: int | None
    vertex_count: int | None
    validation_state: str
    validation_report: dict[str, Any] | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
