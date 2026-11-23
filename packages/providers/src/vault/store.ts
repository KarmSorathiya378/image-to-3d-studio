import { EnvelopeCrypto } from '../crypto/envelope.ts';
import { defaultCapabilityRegistry } from '../registry/index.ts';
import { defaultSsrfValidator, type SsrfValidator } from '../ssrf/validator.ts';
import {
  type AddCredentialInput,
  type ConnectionStatusType,
  ConnectionStatus,
  type ReplaceCredentialInput,
  type SafeCredentialSummary,
  type StoredCredentialRecord,
} from '../types/credentials.ts';
import { ProviderError } from '../types/errors.ts';
import type { ConnectionTestResult, IProviderAdapter } from '../types/providers.ts';

export interface CredentialVaultOptions {
  readonly crypto?: EnvelopeCrypto;
  readonly ssrfValidator?: SsrfValidator;
}

/**
 * Universal BYOK Credential Vault.
 * Enforces envelope encryption, account isolation, masked presentation, and SSRF validation.
 */
export class CredentialVault {
  private readonly records = new Map<string, StoredCredentialRecord>();
  private readonly crypto: EnvelopeCrypto;
  private readonly ssrfValidator: SsrfValidator;

  constructor(options?: CredentialVaultOptions) {
    this.crypto = options?.crypto ?? new EnvelopeCrypto();
    this.ssrfValidator = options?.ssrfValidator ?? defaultSsrfValidator;
  }

  /**
   * Add a new provider credential.
   * Encrypts the key at rest, verifies SSRF on customBaseUrl, and returns a safe summary.
   */
  public async addCredential(input: AddCredentialInput): Promise<SafeCredentialSummary> {
    const { accountId, providerId, apiKey, customBaseUrl, isDefault } = input;

    if (!accountId || !providerId || !apiKey) {
      throw new ProviderError({
        code: 'AUTHENTICATION_FAILED',
        retryable: false,
        userMessage: 'accountId, providerId, and apiKey are all required.',
      });
    }

    if (customBaseUrl) {
      this.ssrfValidator.validateEndpoint(customBaseUrl);
    }

    const key = this.buildKey(accountId, providerId);
    const existing = this.records.get(key);

    const encryptedSecret = this.crypto.encrypt(apiKey.trim(), { accountId, providerId });
    const maskedKey = EnvelopeCrypto.maskApiKey(apiKey);
    const keyFingerprint = EnvelopeCrypto.computeKeyFingerprint(apiKey);
    const now = new Date().toISOString();

    // Check if this should be default
    const existingList = this.listCredentials(accountId);
    const shouldBeDefault = isDefault ?? (existing ? existing.isDefault : existingList.length === 0);

    if (shouldBeDefault) {
      this.clearOtherDefaults(accountId, providerId);
    }

    const record: StoredCredentialRecord = {
      id: existing ? existing.id : `cred_${Buffer.from(`${accountId}_${providerId}`).toString('hex').slice(0, 16)}`,
      accountId,
      providerId,
      encryptedSecret,
      maskedKey,
      keyFingerprint,
      customBaseUrl: customBaseUrl?.trim(),
      isDefault: shouldBeDefault,
      status: ConnectionStatus.UNTESTED,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
    };

    this.records.set(key, record);
    return this.toSafeSummary(record);
  }

  /**
   * Replace an existing API key for an account and provider.
   */
  public async replaceCredential(input: ReplaceCredentialInput): Promise<SafeCredentialSummary> {
    const key = this.buildKey(input.accountId, input.providerId);
    const existing = this.records.get(key);

    if (!existing) {
      throw new ProviderError({
        code: 'AUTHENTICATION_FAILED',
        retryable: false,
        userMessage: `No existing credential found for provider "${input.providerId}" to replace.`,
      });
    }

    return this.addCredential({
      accountId: input.accountId,
      providerId: input.providerId,
      apiKey: input.newApiKey,
      customBaseUrl: input.customBaseUrl ?? existing.customBaseUrl,
      isDefault: existing.isDefault,
    });
  }

  /**
   * Remove a provider credential for an account.
   */
  public async removeCredential(accountId: string, providerId: string): Promise<boolean> {
    const key = this.buildKey(accountId, providerId);
    const deleted = this.records.delete(key);

    // If removed credential was default, elect a new default if any remain
    if (deleted) {
      const remaining = Array.from(this.records.values()).filter((r) => r.accountId === accountId);
      if (remaining.length > 0 && !remaining.some((r) => r.isDefault)) {
        const first = remaining[0]!;
        this.records.set(this.buildKey(accountId, first.providerId), {
          ...first,
          isDefault: true,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    return deleted;
  }

  /**
   * Mark a specific provider as default for an account.
   */
  public async setDefaultProvider(accountId: string, providerId: string): Promise<void> {
    const targetKey = this.buildKey(accountId, providerId);
    const target = this.records.get(targetKey);

    if (!target) {
      throw new ProviderError({
        code: 'AUTHENTICATION_FAILED',
        retryable: false,
        userMessage: `Credential for provider "${providerId}" not found.`,
      });
    }

    this.clearOtherDefaults(accountId, providerId);
    this.records.set(targetKey, {
      ...target,
      isDefault: true,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Retrieve safe summary for a provider credential (no plaintext secrets).
   */
  public getCredentialSummary(accountId: string, providerId: string): SafeCredentialSummary | undefined {
    const record = this.records.get(this.buildKey(accountId, providerId));
    if (!record) return undefined;
    return this.toSafeSummary(record);
  }

  /**
   * List all configured provider credentials for an account (all sanitized/masked).
   */
  public listCredentials(accountId: string): readonly SafeCredentialSummary[] {
    const list: SafeCredentialSummary[] = [];
    for (const record of this.records.values()) {
      if (record.accountId === accountId) {
        list.push(this.toSafeSummary(record));
      }
    }
    return list;
  }

  /**
   * Decrypt and return the raw API key in memory for backend execution.
   * Strictly server-side only; never expose through API routes.
   */
  public getDecryptedKey(accountId: string, providerId: string): string {
    const record = this.records.get(this.buildKey(accountId, providerId));
    if (!record) {
      throw new ProviderError({
        code: 'AUTHENTICATION_FAILED',
        retryable: false,
        userMessage: `Missing API key credential for provider "${providerId}". Please configure it in Provider Settings.`,
      });
    }

    return this.crypto.decrypt(record.encryptedSecret, { accountId, providerId });
  }

  /**
   * Validate connection using non-billable test calls where possible.
   * Updates status to connected, invalid, or error.
   */
  public async validateCredential(
    accountId: string,
    providerId: string,
    adapter: IProviderAdapter
  ): Promise<ConnectionTestResult> {
    const key = this.buildKey(accountId, providerId);
    const record = this.records.get(key);

    if (!record) {
      throw new ProviderError({
        code: 'AUTHENTICATION_FAILED',
        retryable: false,
        userMessage: `No credential stored for provider "${providerId}" to validate.`,
      });
    }

    let rawApiKey: string;
    try {
      rawApiKey = this.crypto.decrypt(record.encryptedSecret, { accountId, providerId });
    } catch (err) {
      const result: ConnectionTestResult = {
        ok: false,
        status: ConnectionStatus.ERROR,
        message: 'Stored credential decryption failed (tamper/corruption detected).',
        isNonBillable: true,
      };
      this.updateStatus(key, ConnectionStatus.ERROR, result.message);
      return result;
    }

    try {
      const testResult = await adapter.testCredential({
        providerId,
        apiKey: rawApiKey,
        customBaseUrl: record.customBaseUrl,
        accountId,
      });

      const newStatus: ConnectionStatusType = testResult.ok
        ? ConnectionStatus.CONNECTED
        : testResult.status;

      this.updateStatus(key, newStatus, testResult.ok ? undefined : testResult.message);
      return testResult;
    } catch (err) {
      const normalized = adapter.normalizeError(err);
      const isInvalidKey =
        normalized.code === 'AUTHENTICATION_FAILED' || normalized.code === 'INVALID_API_KEY';
      const newStatus = isInvalidKey ? ConnectionStatus.INVALID : ConnectionStatus.ERROR;

      this.updateStatus(key, newStatus, normalized.userMessage);
      return {
        ok: false,
        status: newStatus,
        message: normalized.userMessage,
        isNonBillable: true,
      };
    }
  }

  private updateStatus(key: string, status: ConnectionStatusType, lastError?: string): void {
    const existing = this.records.get(key);
    if (!existing) return;

    this.records.set(key, {
      ...existing,
      status,
      lastTestedAt: new Date().toISOString(),
      lastError,
      updatedAt: new Date().toISOString(),
    });
  }

  private clearOtherDefaults(accountId: string, exceptProviderId: string): void {
    for (const [key, record] of this.records.entries()) {
      if (record.accountId === accountId && record.providerId !== exceptProviderId && record.isDefault) {
        this.records.set(key, {
          ...record,
          isDefault: false,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }

  private toSafeSummary(record: StoredCredentialRecord): SafeCredentialSummary {
    const models = defaultCapabilityRegistry.listModelsByProvider(record.providerId, {
      includeSpecialists: true,
    });
    const supportedCapabilities = Array.from(
      new Set(models.flatMap((m) => m.capabilities))
    );

    return {
      id: record.id,
      accountId: record.accountId,
      providerId: record.providerId,
      maskedKey: record.maskedKey,
      customBaseUrl: record.customBaseUrl,
      isDefault: record.isDefault,
      status: record.status,
      supportedCapabilities,
      lastTestedAt: record.lastTestedAt,
      lastError: record.lastError,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private buildKey(accountId: string, providerId: string): string {
    return `${accountId}:${providerId.toLowerCase()}`;
  }
}

export const defaultCredentialVault = new CredentialVault();
