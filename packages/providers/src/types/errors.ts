/**
 * Standardized provider errors.
 */

export type ProviderErrorCode =
  | 'AUTHENTICATION_FAILED'
  | 'INVALID_API_KEY'
  | 'INCOMPATIBLE_STAGE_MODEL'
  | 'RATE_LIMIT_EXCEEDED'
  | 'QUOTA_EXCEEDED'
  | 'SSRF_BLOCKED'
  | 'INVALID_ENDPOINT'
  | 'MODEL_NOT_FOUND'
  | 'MALFORMED_RESPONSE'
  | 'FEATURE_NOT_SUPPORTED'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'UNKNOWN_ERROR';

export interface NormalizedProviderError {
  readonly code: ProviderErrorCode;
  readonly retryable: boolean;
  readonly userMessage: string;
  readonly statusCode?: number;
  readonly originalError?: unknown;
}

export class ProviderError extends Error {
  public readonly code: ProviderErrorCode;
  public readonly retryable: boolean;
  public readonly userMessage: string;
  public readonly statusCode?: number;
  public readonly originalError?: unknown;

  constructor(normalized: NormalizedProviderError) {
    super(`[${normalized.code}] ${normalized.userMessage}`);
    this.name = 'ProviderError';
    this.code = normalized.code;
    this.retryable = normalized.retryable;
    this.userMessage = normalized.userMessage;
    this.statusCode = normalized.statusCode;
    this.originalError = normalized.originalError;
    Object.setPrototypeOf(this, ProviderError.prototype);
  }
}
