from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict

class ModelVersionCreate(BaseModel):
    version_number: int = Field(..., ge=1)
    generation_job_id: UUID | None = None
    scene_specification_id: UUID | None = None
    primary_asset_id: UUID | None = None
    thumbnail_asset_id: UUID | None = None
    notes: str | None = None

class ModelVersionResponse(BaseModel):
    id: UUID
    project_id: UUID
    user_id: UUID
    version_number: int
    generation_job_id: UUID | None
    scene_specification_id: UUID | None
    primary_asset_id: UUID | None
    thumbnail_asset_id: UUID | None
    notes: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
