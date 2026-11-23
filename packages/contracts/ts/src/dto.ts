/**
 * Shared Data Transfer Objects (DTOs) for TypeScript clients and services.
 */

export type GenerationState =
  | "CREATED"
  | "QUEUED"
  | "IMAGE_ANALYSIS"
  | "SCENE_PLANNING"
  | "BUILDING_GEOMETRY"
  | "VALIDATING_ASSET"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELED";

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "UNSUPPORTED_MODEL_CAPABILITY"
  | "CREDENTIAL_INVALID"
  | "PROVIDER_RATE_LIMITED"
  | "PROVIDER_QUOTA_EXHAUSTED"
  | "PROVIDER_UNAVAILABLE"
  | "VISION_FAILED"
  | "SCENE_SCHEMA_FAILED"
  | "GEOMETRY_BUILD_FAILED"
  | "ASSET_VALIDATION_FAILED"
  | "STORAGE_FAILED"
  | "GENERATION_TIMEOUT"
  | "INTERNAL_ERROR";

export interface ApiErrorDTO {
  code: ErrorCode;
  message: string;
  details?: Record<string, any>;
  requestId?: string;
  retryable?: boolean;
}

export interface ImageAnalysisDTO {
  objectClass: string;
  visibleComponents: string[];
  estimatedDimensions?: Record<string, number>;
  predominantColors?: string[];
  materialsEstimated?: string[];
  viewpoint?: Record<string, number>;
  hiddenSurfacesNotes?: string;
  confidenceScore: number;
}

export interface ModelAssetDTO {
  id: string;
  generationId: string;
  format: string;
  storageKey: string;
  fileSizeBytes: number;
  sha256: string;
  triangleCount: number;
  vertexCount: number;
  meshCount: number;
  hasNormals: boolean;
  isFinite: boolean;
  bounds: {
    min: [number, number, number];
    max: [number, number, number];
  };
  downloadUrl?: string;
}

export interface SceneValidationResultDTO {
  isValid: boolean;
  partCount: number;
  materialCount: number;
  triangleCountEstimated: number;
  warnings: string[];
  errors: string[];
}

export interface GenerationJobDTO {
  id: string;
  projectId: string;
  userId: string;
  state: GenerationState;
  sourceImageId: string;
  currentStage?: string;
  progressPercent?: number;
  errorCode?: ErrorCode;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
  asset?: ModelAssetDTO;
}
