import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import {
  WorkflowStageGate,
  CredentialVault,
  ProviderId,
  WorkflowStage,
  ProviderError,
} from '../src/index.ts';

describe('WorkflowStageGate - Strict Stage Enforcement', () => {
  it('correctly rejects using a non-VLM for vision stage before any network request', async () => {
    const vault = new CredentialVault();
    const accountId = 'user_pipeline_test';

    // Store credentials for OpenAI and Groq
    await vault.addCredential({
      accountId,
      providerId: ProviderId.OPENAI,
      apiKey: 'sk-test-mock-key-for-gate',
    });
    await vault.addCredential({
      accountId,
      providerId: ProviderId.GROQ,
      apiKey: 'gsk-test-mock-key-for-gate',
    });

    const gate = new WorkflowStageGate({ vault });

    // Non-VLM model: o1
    await assert.rejects(
      async () => {
        await gate.executeVisionStage(
          accountId,
          {
            modelId: 'o1',
            image: { mimeType: 'image/jpeg', base64Data: 'dummy_base64' },
          },
          ProviderId.OPENAI
        );
      },
      (err: unknown) => {
        assert.ok(err instanceof ProviderError);
        assert.strictEqual(err.code, 'INCOMPATIBLE_STAGE_MODEL');
        assert.ok(err.userMessage.includes('Non-VLM models cannot be used for the Image Analysis stage'));
        return true;
      }
    );

    // Non-VLM model on Groq: llama-3.3-70b-versatile
    await assert.rejects(
      async () => {
        await gate.executeVisionStage(
          accountId,
          {
            modelId: 'llama-3.3-70b-versatile',
            image: { mimeType: 'image/png', base64Data: 'dummy_base64' },
          },
          ProviderId.GROQ
        );
      },
      (err: unknown) => {
        assert.ok(err instanceof ProviderError);
        assert.strictEqual(err.code, 'INCOMPATIBLE_STAGE_MODEL');
        return true;
      }
    );

    // Legacy non-VLM: gpt-3.5-turbo
    await assert.rejects(
      async () => {
        await gate.executeVisionStage(
          accountId,
          {
            modelId: 'gpt-3.5-turbo',
            image: { mimeType: 'image/jpeg', base64Data: 'dummy_base64' },
          },
          ProviderId.OPENAI
        );
      },
      (err: unknown) => {
        assert.ok(err instanceof ProviderError);
        assert.strictEqual(err.code, 'INCOMPATIBLE_STAGE_MODEL');
        return true;
      }
    );
  });

  it('pre-flight stage compatibility checks', () => {
    const gate = new WorkflowStageGate();

    // Check vision compatibility
    const visionCheckFail = gate.checkStageCompatibility('o3-mini', WorkflowStage.VISION_ANALYSIS);
    assert.strictEqual(visionCheckFail.compatible, false);
    assert.ok(visionCheckFail.missingCapabilities.length > 0);

    const visionCheckPass = gate.checkStageCompatibility('gpt-4o', WorkflowStage.VISION_ANALYSIS);
    assert.strictEqual(visionCheckPass.compatible, true);
    assert.strictEqual(visionCheckPass.missingCapabilities.length, 0);

    // Check planning compatibility
    const planCheckPass = gate.checkStageCompatibility('o3-mini', WorkflowStage.GEOMETRY_PLANNING);
    assert.strictEqual(planCheckPass.compatible, true);

    const planCheckFail = gate.checkStageCompatibility('dall-e-3', WorkflowStage.GEOMETRY_PLANNING);
    assert.strictEqual(planCheckFail.compatible, false);
  });
});
