/**
 * Credential and Vault data types.
 * Plaintext secrets are strictly isolated and never stored or returned to clients.
 */

export const ConnectionStatus = {
  UNTESTED: 'untested',
  CONNECTED: 'connected',
  INVALID: 'invalid',
  ERROR: 'error',
} as const;

export type ConnectionStatusType = (typeof ConnectionStatus)[keyof typeof ConnectionStatus];

/**
 * Authenticated encrypted payload stored at rest.
 * Uses AES-256-GCM with account-isolated Additional Authenticated Data (AAD).
 */
export interface EncryptedSecretPayload {
  readonly encryptedData: string; // Base64
  readonly iv: string;            // Base64 (96-bit initialization vector)
  readonly authTag: string;       // Base64 (128-bit authentication tag)
  readonly keyVersion: number;
  readonly algorithm: 'aes-256-gcm';
}

/**
 * Server-side stored credential record.
 * Plaintext keys are strictly omitted.
 */
export interface StoredCredentialRecord {
  readonly id: string;
  readonly accountId: string;
  readonly providerId: string;
  readonly encryptedSecret: EncryptedSecretPayload;
  readonly maskedKey: string;      // e.g. "••••1234"
  readonly keyFingerprint: string; // SHA-256 hash prefix for deduplication/identity without revealing key
  readonly customBaseUrl?: string;
  readonly isDefault: boolean;
  readonly status: ConnectionStatusType;
  readonly lastTestedAt?: string;
  readonly lastError?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Safe client-facing credential view.
 * Plaintext secrets AND encrypted blobs are stripped.
 */
export interface SafeCredentialSummary {
  readonly id: string;
  readonly accountId: string;
  readonly providerId: string;
  readonly maskedKey: string;
  readonly customBaseUrl?: string;
  readonly isDefault: boolean;
  readonly status: ConnectionStatusType;
  readonly supportedCapabilities: readonly string[];
  readonly lastTestedAt?: string;
  readonly lastError?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Payload to add or update a credential.
 */
export interface AddCredentialInput {
  readonly accountId: string;
  readonly providerId: string;
  readonly apiKey: string;
  readonly customBaseUrl?: string;
  readonly isDefault?: boolean;
}

export interface ReplaceCredentialInput {
  readonly accountId: string;
  readonly providerId: string;
  readonly newApiKey: string;
  readonly customBaseUrl?: string;
}
