/**
 * Standard typed error classes for packages/ai-pipeline.
 * Provides machine-readable error codes and user-actionable descriptions.
 */

export type PipelineErrorCode =
  | 'INVALID_IMAGE_MIME'
  | 'CORRUPT_IMAGE_HEADER'
  | 'IMAGE_TOO_LARGE'
  | 'IMAGE_DIMENSIONS_OUT_OF_BOUNDS'
  | 'DIMENSION_BOMB_DETECTED'
  | 'SECURITY_RISK_DETECTED'
  | 'VLM_ANALYSIS_FAILED'
  | 'MALFORMED_VLM_OUTPUT'
  | 'VLM_OUTPUT_UNREPAIRABLE'
  | 'MODEL_INCOMPATIBLE'
  | 'SCENE_SPEC_VALIDATION_FAILED'
  | 'SCENE_INVARIANTS_VIOLATED'
  | 'PROVIDER_RATE_LIMITED'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_AUTH_FAILED';

export class PipelineError extends Error {
  readonly code: PipelineErrorCode;
  readonly retryable: boolean;
  readonly details?: Record<string, unknown>;

  constructor(
    code: PipelineErrorCode,
    message: string,
    options?: { retryable?: boolean; details?: Record<string, unknown>; cause?: unknown }
  ) {
    super(message, { cause: options?.cause });
    this.name = 'PipelineError';
    this.code = code;
    this.retryable = options?.retryable ?? false;
    this.details = options?.details;
  }
}

export class ImageValidationError extends PipelineError {
  constructor(code: PipelineErrorCode, message: string, details?: Record<string, unknown>) {
    super(code, message, { retryable: false, details });
    this.name = 'ImageValidationError';
  }
}

export class MalformedModelOutputError extends PipelineError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('MALFORMED_VLM_OUTPUT', message, { retryable: true, details });
    this.name = 'MalformedModelOutputError';
  }
}

export class SceneSpecValidationError extends PipelineError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('SCENE_SPEC_VALIDATION_FAILED', message, { retryable: true, details });
    this.name = 'SceneSpecValidationError';
  }
}

export class ProviderError extends PipelineError {
  readonly statusCode?: number;

  constructor(
    code: PipelineErrorCode,
    message: string,
    options: { statusCode?: number; retryable: boolean; details?: Record<string, unknown>; cause?: unknown }
  ) {
    super(code, message, options);
    this.name = 'ProviderError';
    this.statusCode = options.statusCode;
  }
}
