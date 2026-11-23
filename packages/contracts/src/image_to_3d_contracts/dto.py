"""Shared Data Transfer Objects (DTOs) for AI Image-to-3D Studio."""

from __future__ import annotations

import uuid
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class GenerationState(str, Enum):
    CREATED = "CREATED"
    QUEUED = "QUEUED"
    IMAGE_ANALYSIS = "IMAGE_ANALYSIS"
    SCENE_PLANNING = "SCENE_PLANNING"
    BUILDING_GEOMETRY = "BUILDING_GEOMETRY"
    VALIDATING_ASSET = "VALIDATING_ASSET"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"
    CANCELED = "CANCELED"


class ErrorCode(str, Enum):
    VALIDATION_ERROR = "VALIDATION_ERROR"
    UNAUTHORIZED = "UNAUTHORIZED"
    FORBIDDEN = "FORBIDDEN"
    UNSUPPORTED_MODEL_CAPABILITY = "UNSUPPORTED_MODEL_CAPABILITY"
    CREDENTIAL_INVALID = "CREDENTIAL_INVALID"
    PROVIDER_RATE_LIMITED = "PROVIDER_RATE_LIMITED"
    PROVIDER_QUOTA_EXHAUSTED = "PROVIDER_QUOTA_EXHAUSTED"
    PROVIDER_UNAVAILABLE = "PROVIDER_UNAVAILABLE"
    VISION_FAILED = "VISION_FAILED"
    SCENE_SCHEMA_FAILED = "SCENE_SCHEMA_FAILED"
    GEOMETRY_BUILD_FAILED = "GEOMETRY_BUILD_FAILED"
    ASSET_VALIDATION_FAILED = "ASSET_VALIDATION_FAILED"
    STORAGE_FAILED = "STORAGE_FAILED"
    GENERATION_TIMEOUT = "GENERATION_TIMEOUT"
    INTERNAL_ERROR = "INTERNAL_ERROR"


class BaseDTO(BaseModel):
    model_config = ConfigDict(extra="ignore")


class ApiErrorDTO(BaseDTO):
    code: ErrorCode
    message: str
    details: Optional[Dict[str, Any]] = None
    requestId: Optional[str] = None
    retryable: bool = False


class ImageAnalysisDTO(BaseDTO):
    objectClass: str
    visibleComponents: List[str]
    estimatedDimensions: Optional[Dict[str, float]] = None
    predominantColors: List[str] = Field(default_factory=list)
    materialsEstimated: List[str] = Field(default_factory=list)
    viewpoint: Optional[Dict[str, float]] = None
    hiddenSurfacesNotes: Optional[str] = None
    confidenceScore: float = Field(default=0.8, ge=0.0, le=1.0)


class ModelAssetDTO(BaseDTO):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    generationId: str
    format: str = "glb"
    storageKey: str
    fileSizeBytes: int
    sha256: str
    triangleCount: int
    vertexCount: int
    meshCount: int
    hasNormals: bool
    isFinite: bool
    bounds: Dict[str, List[float]]  # min: [x,y,z], max: [x,y,z]
    downloadUrl: Optional[str] = None


class SceneValidationResultDTO(BaseDTO):
    isValid: bool
    partCount: int
    materialCount: int
    triangleCountEstimated: int
    warnings: List[str] = Field(default_factory=list)
    errors: List[str] = Field(default_factory=list)


class GenerationJobDTO(BaseDTO):
    id: str
    projectId: str
    userId: str
    state: GenerationState = GenerationState.QUEUED
    sourceImageId: str
    currentStage: Optional[str] = None
    progressPercent: Optional[int] = None
    errorCode: Optional[ErrorCode] = None
    errorMessage: Optional[str] = None
    createdAt: str
    completedAt: Optional[str] = None
    asset: Optional[ModelAssetDTO] = None
