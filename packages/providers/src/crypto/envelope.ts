import * as crypto from 'node:crypto';
import type { EncryptedSecretPayload } from '../types/credentials.ts';
import { ProviderError } from '../types/errors.ts';

export interface EnvelopeCryptoOptions {
  readonly masterKey?: string | Buffer; // 32-byte key (hex string or Buffer)
  readonly keyVersion?: number;
}

const DEFAULT_KEY_VERSION = 1;

/**
 * Envelope encryption manager using AES-256-GCM authenticated encryption.
 * Enforces account-isolated Additional Authenticated Data (AAD) to prevent cross-account ciphertext migration.
 */
export class EnvelopeCrypto {
  private readonly masterKey: Buffer;
  private readonly keyVersion: number;

  constructor(options?: EnvelopeCryptoOptions) {
    this.keyVersion = options?.keyVersion ?? DEFAULT_KEY_VERSION;
    this.masterKey = this.resolveMasterKey(options?.masterKey);
  }

  /**
   * Encrypt a plaintext secret (such as an API key).
   * Binds the encryption to the accountId and providerId as Additional Authenticated Data (AAD).
   */
  public encrypt(
    plaintext: string,
    context: { accountId: string; providerId: string }
  ): EncryptedSecretPayload {
    if (!plaintext || typeof plaintext !== 'string') {
      throw new ProviderError({
        code: 'INVALID_API_KEY',
        retryable: false,
        userMessage: 'Secret plaintext cannot be empty.',
      });
    }

    if (!context.accountId || !context.providerId) {
      throw new ProviderError({
        code: 'AUTHENTICATION_FAILED',
        retryable: false,
        userMessage: 'Encryption context must include both accountId and providerId for isolation.',
      });
    }

    // 96-bit random IV as recommended by NIST for AES-GCM
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey, iv);

    // Bind AAD: accountId + providerId
    const aad = Buffer.from(`${context.accountId}:${context.providerId}`, 'utf8');
    cipher.setAAD(aad);

    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      encryptedData: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      keyVersion: this.keyVersion,
      algorithm: 'aes-256-gcm',
    };
  }

  /**
   * Decrypt an encrypted secret payload.
   * Throws an error if ciphertext or AAD has been tampered with or if accountId does not match.
   */
  public decrypt(
    payload: EncryptedSecretPayload,
    context: { accountId: string; providerId: string }
  ): string {
    if (!payload.encryptedData || !payload.iv || !payload.authTag) {
      throw new ProviderError({
        code: 'AUTHENTICATION_FAILED',
        retryable: false,
        userMessage: 'Malformed encrypted secret payload.',
      });
    }

    if (payload.algorithm !== 'aes-256-gcm') {
      throw new ProviderError({
        code: 'AUTHENTICATION_FAILED',
        retryable: false,
        userMessage: `Unsupported encryption algorithm: ${payload.algorithm}`,
      });
    }

    try {
      const iv = Buffer.from(payload.iv, 'base64');
      const authTag = Buffer.from(payload.authTag, 'base64');
      const encryptedData = Buffer.from(payload.encryptedData, 'base64');

      const decipher = crypto.createDecipheriv('aes-256-gcm', this.masterKey, iv);
      decipher.setAuthTag(authTag);

      // Verify AAD matches original accountId and providerId
      const aad = Buffer.from(`${context.accountId}:${context.providerId}`, 'utf8');
      decipher.setAAD(aad);

      const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
      return decrypted.toString('utf8');
    } catch (err) {
      throw new ProviderError({
        code: 'AUTHENTICATION_FAILED',
        retryable: false,
        userMessage:
          'Decryption authentication failed. The credential may have been tampered with or account boundary violated.',
        originalError: err,
      });
    }
  }

  /**
   * Generates a masked representation of an API key for safe UI display (e.g. "••••1234").
   * Never exposes more than the last 4 characters.
   */
  public static maskApiKey(apiKey: string): string {
    if (!apiKey) return '';
    const trimmed = apiKey.trim();
    if (trimmed.length <= 4) {
      return '••••••••';
    }
    const suffix = trimmed.slice(-4);
    return `••••${suffix}`;
  }

  /**
   * Computes a deterministic SHA-256 fingerprint for deduplication without storing plaintext.
   */
  public static computeKeyFingerprint(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey.trim()).digest('hex').slice(0, 16);
  }

  private resolveMasterKey(providedKey?: string | Buffer): Buffer {
    if (providedKey) {
      if (Buffer.isBuffer(providedKey)) {
        if (providedKey.length !== 32) {
          throw new Error('Master encryption key Buffer must be exactly 32 bytes (256 bits).');
        }
        return providedKey;
      }
      // Hex string of 64 chars = 32 bytes
      if (/^[0-9a-fA-F]{64}$/.test(providedKey)) {
        return Buffer.from(providedKey, 'hex');
      }
      // Base64 string of 32 bytes = 44 chars
      const buf = Buffer.from(providedKey, 'base64');
      if (buf.length === 32) {
        return buf;
      }
      // SHA-256 hash passphrase if arbitrary length string
      return crypto.createHash('sha256').update(providedKey).digest();
    }

    const envKey = process.env.CREDENTIAL_ENCRYPTION_MASTER_KEY;
    if (envKey) {
      if (/^[0-9a-fA-F]{64}$/.test(envKey)) {
        return Buffer.from(envKey, 'hex');
      }
      const b64 = Buffer.from(envKey, 'base64');
      if (b64.length === 32) {
        return b64;
      }
      return crypto.createHash('sha256').update(envKey).digest();
    }

    // Deterministic fallback for test/local development environments
    // Warning: production deployments MUST supply CREDENTIAL_ENCRYPTION_MASTER_KEY in env
    return crypto.createHash('sha256').update('image-to-3d-studio-dev-vault-secret-key-32b').digest();
  }
}
