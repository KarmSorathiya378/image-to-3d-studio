export interface JsonRepairResult<T = unknown> {
  parsed: T;
  repaired: boolean;
  repairActions: string[];
}

export interface DomainRepairResult<T> {
  data: T;
  repaired: boolean;
  repairActions: string[];
}

export interface RetryPolicyConfig {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  jitterRatio?: number;
}
