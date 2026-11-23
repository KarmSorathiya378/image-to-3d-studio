from datetime import datetime
from uuid import UUID
from typing import Any
from pydantic import BaseModel, Field, ConfigDict

class GenerationAttemptResponse(BaseModel):
    id: UUID
    job_id: UUID
    attempt_number: int
    stage: str
    status: str
    started_at: datetime
    ended_at: datetime | None
    sanitized_summary: str | None
    error_details: dict[str, Any] | None

    model_config = ConfigDict(from_attributes=True)

class SceneSpecificationCreate(BaseModel):
    schema_version: str = "1.0"
    object_name: str = Field(..., max_length=150)
    spec_json: dict[str, Any]
    planner_model_id: str

class SceneSpecificationResponse(BaseModel):
    id: UUID
    job_id: UUID
    user_id: UUID
    schema_version: str
    object_name: str
    spec_json: dict[str, Any]
    planner_model_id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class GenerationJobCreate(BaseModel):
    source_asset_id: UUID
    idempotency_key: str = Field(..., min_length=1, max_length=255)
    mode: str = "PROCEDURAL"
    instructions: str | None = None

class GenerationJobResponse(BaseModel):
    id: UUID
    project_id: UUID
    user_id: UUID
    source_asset_id: UUID
    mode: str
    status: str
    idempotency_key: str
    instructions: str | None
    error_code: str | None
    error_message: str | None
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None
    attempts: list[GenerationAttemptResponse] = []
    scene_specifications: list[SceneSpecificationResponse] = []

    model_config = ConfigDict(from_attributes=True)
