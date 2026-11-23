from datetime import datetime
from uuid import UUID
from typing import Any
from pydantic import BaseModel, Field, ConfigDict

class AIProviderResponse(BaseModel):
    id: str
    display_name: str
    base_url: str | None
    is_active: bool
    capabilities: dict[str, Any]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class UserCredentialCreate(BaseModel):
    provider_id: str
    nickname: str = Field(..., min_length=1, max_length=100)
    secret: str = Field(..., min_length=4, description="Plaintext secret submitted over HTTPS; encrypted immediately; never stored or returned plaintext")

class UserCredentialResponse(BaseModel):
    id: UUID
    user_id: UUID
    provider_id: str
    nickname: str
    key_mask: str
    status: str
    last_validated_at: datetime | None
    created_at: datetime
    revoked_at: datetime | None

    model_config = ConfigDict(from_attributes=True)

class ModelConfigurationCreate(BaseModel):
    stage: str = Field(..., description="VISION, PLANNER, or SPECIALIST")
    provider_id: str
    model_id: str
    credential_id: UUID | None = None
    parameters: dict[str, Any] = Field(default_factory=dict)
    is_default: bool = False

class ModelConfigurationResponse(BaseModel):
    id: UUID
    user_id: UUID
    stage: str
    provider_id: str
    model_id: str
    credential_id: UUID | None
    parameters: dict[str, Any] | None
    is_default: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
