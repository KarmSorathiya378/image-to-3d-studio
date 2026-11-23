from datetime import datetime
from uuid import UUID
from typing import Any
from pydantic import BaseModel, Field, ConfigDict

class ExportRecordCreate(BaseModel):
    asset_id: UUID
    export_format: str = Field(..., max_length=50)

class ExportRecordResponse(BaseModel):
    id: UUID
    user_id: UUID
    asset_id: UUID
    export_format: str
    ip_address: str | None
    download_count: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class AuditEventResponse(BaseModel):
    id: UUID
    user_id: UUID | None
    action: str
    resource_type: str
    resource_id: str | None
    ip_address: str | None
    userAgent: str | None = Field(default=None, alias="user_agent")
    details: dict[str, Any] | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
