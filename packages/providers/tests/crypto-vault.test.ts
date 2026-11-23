import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import {
  CredentialVault,
  EnvelopeCrypto,
  ConnectionStatus,
  ProviderId,
  ProviderError,
} from '../src/index.ts';

describe('Encrypted Credential Vault & AES-256-GCM Envelope Encryption', () => {
  const masterKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const crypto = new EnvelopeCrypto({ masterKey });

  it('encrypts and decrypts secrets using authenticated AES-256-GCM', () => {
    const secret = 'sk-proj-test-1234567890abcdefghijklmnopqrstuvwxyz';
    const context = { accountId: 'user_123', providerId: ProviderId.OPENAI };

    const encrypted = crypto.encrypt(secret, context);
    assert.ok(encrypted.encryptedData, 'Should produce base64 ciphertext');
    assert.ok(encrypted.iv, 'Should produce 96-bit base64 IV');
    assert.ok(encrypted.authTag, 'Should produce 128-bit base64 authentication tag');
    assert.strictEqual(encrypted.algorithm, 'aes-256-gcm');
    assert.strictEqual(encrypted.keyVersion, 1);

    // Ensure ciphertext does NOT contain plaintext
    assert.strictEqual(encrypted.encryptedData.includes(secret), false);

    // Decrypt and verify matching secret
    const decrypted = crypto.decrypt(encrypted, context);
    assert.strictEqual(decrypted, secret);
  });

  it('detects tampering and rejects decryption if ciphertext or auth tag is modified', () => {
    const secret = 'sk-ant-api03-anthropic-secret-test';
    const context = { accountId: 'user_123', providerId: ProviderId.ANTHROPIC };

    const encrypted = crypto.encrypt(secret, context);

    // Tamper with ciphertext
    const tamperedPayload = {
      ...encrypted,
      encryptedData: Buffer.from('corrupted_ciphertext_data').toString('base64'),
    };

    assert.throws(
      () => crypto.decrypt(tamperedPayload, context),
      (err: unknown) => {
        assert.ok(err instanceof ProviderError);
        assert.strictEqual(err.code, 'AUTHENTICATION_FAILED');
        return true;
      }
    );
  });

  it('enforces account isolation via Additional Authenticated Data (AAD)', () => {
    const secret = 'gsk_groq_api_key_test_secret';
    const userAContext = { accountId: 'account_A', providerId: ProviderId.GROQ };
    const userBContext = { accountId: 'account_B', providerId: ProviderId.GROQ };

    const encrypted = crypto.encrypt(secret, userAContext);

    // Attempting to decrypt User A credential using User B context must fail
    assert.throws(
      () => crypto.decrypt(encrypted, userBContext),
      (err: unknown) => {
        assert.ok(err instanceof ProviderError);
        assert.strictEqual(err.code, 'AUTHENTICATION_FAILED');
        assert.ok(err.userMessage.includes('account boundary violated'));
        return true;
      }
    );

    // Attempting to use the ciphertext for a different provider must fail
    const wrongProviderContext = { accountId: 'account_A', providerId: ProviderId.OPENAI };
    assert.throws(
      () => crypto.decrypt(encrypted, wrongProviderContext),
      (err: unknown) => {
        assert.ok(err instanceof ProviderError);
        assert.strictEqual(err.code, 'AUTHENTICATION_FAILED');
        return true;
      }
    );
  });

  it('masks API keys safely and never reveals plaintext', () => {
    assert.strictEqual(EnvelopeCrypto.maskApiKey('sk-1234567890abcdef'), '••••cdef');
    assert.strictEqual(EnvelopeCrypto.maskApiKey('1234'), '••••••••');
    assert.strictEqual(EnvelopeCrypto.maskApiKey(''), '');
  });

  it('manages credential lifecycle: add, list, replace, remove, setDefault', async () => {
    const vault = new CredentialVault({ crypto });
    const accountId = 'user_studio_99';

    // 1. Add OpenAI credential
    const openaiKey = 'sk-proj-openai-live-key-9876';
    const openaiSummary = await vault.addCredential({
      accountId,
      providerId: ProviderId.OPENAI,
      apiKey: openaiKey,
    });

    assert.strictEqual(openaiSummary.accountId, accountId);
    assert.strictEqual(openaiSummary.providerId, ProviderId.OPENAI);
    assert.strictEqual(openaiSummary.maskedKey, '••••9876');
    assert.strictEqual(openaiSummary.isDefault, true); // First credential becomes default
    assert.strictEqual(openaiSummary.status, ConnectionStatus.UNTESTED);
    assert.ok(openaiSummary.supportedCapabilities.includes('vision_analysis'));

    // Check safe presentation: NO plaintext, NO encrypted payload
    assert.strictEqual((openaiSummary as any).apiKey, undefined);
    assert.strictEqual((openaiSummary as any).encryptedSecret, undefined);

    // 2. Add Anthropic credential
    const anthropicKey = 'sk-ant-anthropic-key-5432';
    const anthropicSummary = await vault.addCredential({
      accountId,
      providerId: ProviderId.ANTHROPIC,
      apiKey: anthropicKey,
    });
    assert.strictEqual(anthropicSummary.isDefault, false);
    assert.strictEqual(anthropicSummary.maskedKey, '••••5432');

    // 3. List credentials
    const list = vault.listCredentials(accountId);
    assert.strictEqual(list.length, 2);
    assert.ok(list.some((c) => c.providerId === ProviderId.OPENAI && c.isDefault));
    assert.ok(list.some((c) => c.providerId === ProviderId.ANTHROPIC && !c.isDefault));

    // 4. Set Anthropic as default
    await vault.setDefaultProvider(accountId, ProviderId.ANTHROPIC);
    const updatedOpenai = vault.getCredentialSummary(accountId, ProviderId.OPENAI);
    const updatedAnthropic = vault.getCredentialSummary(accountId, ProviderId.ANTHROPIC);
    assert.strictEqual(updatedOpenai?.isDefault, false);
    assert.strictEqual(updatedAnthropic?.isDefault, true);

    // 5. Replace OpenAI key
    const newOpenaiKey = 'sk-proj-openai-new-key-1111';
    const replaced = await vault.replaceCredential({
      accountId,
      providerId: ProviderId.OPENAI,
      newApiKey: newOpenaiKey,
    });
    assert.strictEqual(replaced.maskedKey, '••••1111');
    assert.strictEqual(vault.getDecryptedKey(accountId, ProviderId.OPENAI), newOpenaiKey);

    // 6. Remove OpenAI credential
    const removed = await vault.removeCredential(accountId, ProviderId.OPENAI);
    assert.strictEqual(removed, true);
    assert.strictEqual(vault.getCredentialSummary(accountId, ProviderId.OPENAI), undefined);
    assert.strictEqual(vault.listCredentials(accountId).length, 1);
  });
});
