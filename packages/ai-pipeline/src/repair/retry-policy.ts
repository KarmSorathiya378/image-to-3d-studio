import { ProviderError } from '../errors/pipeline-errors.ts';
import type { RetryPolicyConfig } from './types.ts';

export const DEFAULT_RETRY_CONFIG: Required<RetryPolicyConfig> = {
  maxRetries: 3,
  initialDelayMs: 500,
  maxDelayMs: 8000,
  backoffFactor: 2.0,
  jitterRatio: 0.25,
};

/**
 * Classifies an error into retryable vs non-retryable.
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof ProviderError) {
    return error.retryable;
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    // Network errors, timeouts, rate limits, 5xx server errors
    if (
      msg.includes('429') ||
      msg.includes('rate limit') ||
      msg.includes('timeout') ||
      msg.includes('econnreset') ||
      msg.includes('etimedout') ||
      msg.includes('500') ||
      msg.includes('502') ||
      msg.includes('503') ||
      msg.includes('504') ||
      msg.includes('temporarily unavailable')
    ) {
      return true;
    }

    // 400 Bad Request, 401 Unauthorized, 403 Forbidden are NOT retryable
    if (
      msg.includes('401') ||
      msg.includes('unauthorized') ||
      msg.includes('invalid api key') ||
      msg.includes('403') ||
      msg.includes('forbidden') ||
      msg.includes('400') ||
      msg.includes('model_incompatible')
    ) {
      return false;
    }
  }

  return false;
}

/**
 * Calculates exponential backoff delay with random jitter.
 */
export function calculateBackoffDelay(
  attempt: number,
  config: Required<RetryPolicyConfig> = DEFAULT_RETRY_CONFIG
): number {
  const baseDelay = config.initialDelayMs * Math.pow(config.backoffFactor, attempt);
  const cappedDelay = Math.min(baseDelay, config.maxDelayMs);

  // Add symmetric jitter
  const jitterRange = cappedDelay * config.jitterRatio;
  const jitter = (Math.random() * 2 - 1) * jitterRange;

  return Math.max(50, Math.round(cappedDelay + jitter));
}

/**
 * Executes an async operation with bounded exponential backoff retries.
 */
export async function executeWithRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryPolicyConfig = {}
): Promise<T> {
  const config = { ...DEFAULT_RETRY_CONFIG, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation(attempt);
    } catch (err) {
      lastError = err;

      if (attempt === config.maxRetries || !isRetryableError(err)) {
        throw err;
      }

      const delayMs = calculateBackoffDelay(attempt, config);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}
