import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import {
  defaultCapabilityRegistry,
  ModelCapability,
  WorkflowStage,
  ProviderId,
  ProviderError,
} from '../src/index.ts';

describe('CapabilityRegistry', () => {
  it('correctly classifies models with their capabilities', () => {
    const gpt4o = defaultCapabilityRegistry.getModel('gpt-4o');
    assert.ok(gpt4o, 'gpt-4o should be registered');
    assert.ok(gpt4o.capabilities.includes(ModelCapability.IMAGE_INPUT));
    assert.ok(gpt4o.capabilities.includes(ModelCapability.VISION_ANALYSIS));
    assert.ok(gpt4o.capabilities.includes(ModelCapability.STRUCTURED_OUTPUT));
    assert.ok(gpt4o.capabilities.includes(ModelCapability.TEXT));
    assert.ok(gpt4o.capabilities.includes(ModelCapability.CODE_GENERATION));

    const o1 = defaultCapabilityRegistry.getModel('o1');
    assert.ok(o1, 'o1 should be registered');
    assert.strictEqual(o1.capabilities.includes(ModelCapability.IMAGE_INPUT), false);
    assert.strictEqual(o1.capabilities.includes(ModelCapability.VISION_ANALYSIS), false);
    assert.ok(o1.capabilities.includes(ModelCapability.TEXT));
    assert.ok(o1.capabilities.includes(ModelCapability.STRUCTURED_OUTPUT));
  });

  it('CORRECTLY REJECTS using a non-VLM for the vision analysis stage', () => {
    const nonVlmModels = [
      'o1',
      'o3-mini',
      'gpt-3.5-turbo',
      'llama-3.3-70b-versatile',
      'mixtral-8x7b-32768',
      'mercury-coder',
      'mercury-reasoner',
    ];

    for (const modelId of nonVlmModels) {
      const validation = defaultCapabilityRegistry.validateModelForStage(
        modelId,
        WorkflowStage.VISION_ANALYSIS
      );

      assert.strictEqual(
        validation.compatible,
        false,
        `Expected non-VLM model "${modelId}" to be REJECTED for vision analysis stage`
      );
      assert.ok(
        validation.missingCapabilities.includes(ModelCapability.IMAGE_INPUT) ||
        validation.missingCapabilities.includes(ModelCapability.VISION_ANALYSIS),
        `Model "${modelId}" should report missing image_input or vision_analysis capability`
      );
      assert.ok(
        validation.reason?.includes('lacks vision capabilities') ||
        validation.reason?.includes('Non-VLM models cannot be used for the Image Analysis stage'),
        `Expected clear error message explaining non-VLM rejection, got: ${validation.reason}`
      );

      // Verify that assertion throws ProviderError with INCOMPATIBLE_STAGE_MODEL
      assert.throws(
        () => {
          defaultCapabilityRegistry.assertModelCompatibleForStage(
            modelId,
            WorkflowStage.VISION_ANALYSIS
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof ProviderError);
          assert.strictEqual(err.code, 'INCOMPATIBLE_STAGE_MODEL');
          return true;
        }
      );
    }
  });

  it('ACCEPTS verified Vision-Language Models (VLMs) for the vision analysis stage', () => {
    const verifiedVlms = [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'llama-3.2-11b-vision-preview',
      'llama-3.2-90b-vision-preview',
      'mercury-vlm',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-2.0-flash',
      'claude-3-7-sonnet-20250219',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
    ];

    for (const modelId of verifiedVlms) {
      const validation = defaultCapabilityRegistry.validateModelForStage(
        modelId,
        WorkflowStage.VISION_ANALYSIS
      );

      assert.strictEqual(
        validation.compatible,
        true,
        `Expected verified VLM "${modelId}" to be ACCEPTED for vision analysis stage`
      );
      assert.strictEqual(validation.missingCapabilities.length, 0);

      const model = defaultCapabilityRegistry.assertModelCompatibleForStage(
        modelId,
        WorkflowStage.VISION_ANALYSIS
      );
      assert.ok(model);
    }
  });

  it('validates models for the geometry planning stage (requires structured output and text)', () => {
    const planningModels = [
      'gpt-4o',
      'o1',
      'o3-mini',
      'llama-3.3-70b-versatile',
      'mercury-coder',
      'mercury-reasoner',
      'gemini-1.5-pro',
      'claude-3-5-sonnet-20241022',
    ];

    for (const modelId of planningModels) {
      const validation = defaultCapabilityRegistry.validateModelForStage(
        modelId,
        WorkflowStage.GEOMETRY_PLANNING
      );
      assert.strictEqual(validation.compatible, true, `Model "${modelId}" should be compatible for planning`);
    }

    // Image-only specialist or image-gen models should be rejected for planning
    const nonPlanning = ['dall-e-3', 'tripo-v2.0'];
    for (const modelId of nonPlanning) {
      const validation = defaultCapabilityRegistry.validateModelForStage(
        modelId,
        WorkflowStage.GEOMETRY_PLANNING
      );
      assert.strictEqual(validation.compatible, false, `Model "${modelId}" should be rejected for planning`);
    }
  });

  it('keeps specialist 3D models (Tripo, Meshy) behind capability flag', () => {
    const tripo = defaultCapabilityRegistry.getModel('tripo-v2.0');
    assert.ok(tripo);
    assert.strictEqual(tripo.isSpecialist, true);
    assert.ok(tripo.capabilities.includes(ModelCapability.IMAGE_TO_3D));

    const meshy = defaultCapabilityRegistry.getModel('meshy-v4');
    assert.ok(meshy);
    assert.strictEqual(meshy.isSpecialist, true);
    assert.ok(meshy.capabilities.includes(ModelCapability.IMAGE_TO_3D));
    assert.ok(meshy.capabilities.includes(ModelCapability.TEXTURE_GENERATION));

    // Specialist models excluded by default when listing provider models unless explicit
    const standardTripoList = defaultCapabilityRegistry.listModelsByProvider(ProviderId.TRIPO);
    assert.strictEqual(standardTripoList.length, 0);

    const specialistTripoList = defaultCapabilityRegistry.listModelsByProvider(ProviderId.TRIPO, {
      includeSpecialists: true,
    });
    assert.strictEqual(specialistTripoList.length, 1);
  });

  it('queries models by individual capability across all providers', () => {
    const visionModels = defaultCapabilityRegistry.listModelsWithCapability(ModelCapability.VISION_ANALYSIS);
    assert.ok(visionModels.length > 5);
    assert.ok(visionModels.every((m) => m.capabilities.includes(ModelCapability.VISION_ANALYSIS)));

    const imageTo3dModels = defaultCapabilityRegistry.listModelsWithCapability(
      ModelCapability.IMAGE_TO_3D,
      { includeSpecialists: true }
    );
    assert.strictEqual(imageTo3dModels.length, 2);
  });
});
