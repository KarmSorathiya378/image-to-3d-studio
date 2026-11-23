import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import {
  defaultAdapterRegistry,
  OpenAIAdapter,
  GroqAdapter,
  GeminiAdapter,
  AnthropicAdapter,
  TripoAdapter,
  MeshyAdapter,
  ProviderId,
  validateSceneSpecInvariants,
} from '../src/index.ts';

describe('Provider Adapters & Request/Response Normalization', () => {
  it('has registered adapters for all core providers', () => {
    assert.ok(defaultAdapterRegistry.getAdapter(ProviderId.OPENAI) instanceof OpenAIAdapter);
    assert.ok(defaultAdapterRegistry.getAdapter(ProviderId.GROQ) instanceof GroqAdapter);
    assert.ok(defaultAdapterRegistry.getAdapter(ProviderId.GEMINI) instanceof GeminiAdapter);
    assert.ok(defaultAdapterRegistry.getAdapter(ProviderId.ANTHROPIC) instanceof AnthropicAdapter);
    assert.ok(defaultAdapterRegistry.getAdapter(ProviderId.TRIPO) instanceof TripoAdapter);
    assert.ok(defaultAdapterRegistry.getAdapter(ProviderId.MESHY) instanceof MeshyAdapter);
  });

  it('normalizes raw JSON responses into valid SceneSpec v1 schema', () => {
    const adapter = new OpenAIAdapter();
    const rawLlmOutput = `\`\`\`json
{
  "objectName": "wooden_table",
  "coordinateSystem": "Z_UP",
  "referenceView": { "azimuthDeg": 45, "elevationDeg": 20 },
  "parts": [
    {
      "id": "top_surface",
      "type": "box",
      "size": [2.0, 1.2, 0.1],
      "position": [0.0, 0.0, 0.95],
      "rotationDeg": [0, 0, 0],
      "materialId": "oak_wood"
    },
    {
      "id": "leg_1",
      "type": "cylinder",
      "size": [0.08, 0.08, 0.9],
      "position": [-0.8, -0.4, 0.45],
      "rotationDeg": [0, 0, 0],
      "materialId": "oak_wood"
    }
  ],
  "materials": [
    {
      "id": "oak_wood",
      "baseColor": "#8F684A",
      "roughness": 0.6,
      "metallic": 0.0
    }
  ],
  "uncertaintyNotes": ["Estimated table height from reference photograph"]
}
\`\`\``;

    const normalized = adapter.normalizeSceneSpec(rawLlmOutput, 'wooden_table');
    assert.strictEqual(normalized.schemaVersion, '1.0');
    assert.strictEqual(normalized.objectName, 'wooden_table');
    assert.strictEqual(normalized.coordinateSystem, 'Z_UP');
    assert.strictEqual(normalized.units, 'relative');
    assert.strictEqual(normalized.parts.length, 2);
    assert.strictEqual(normalized.parts[0]?.id, 'top_surface');
    assert.strictEqual(normalized.parts[0]?.type, 'box');
    assert.strictEqual(normalized.parts[1]?.type, 'cylinder');
    assert.strictEqual(normalized.materials.length, 1);
    assert.strictEqual(normalized.materials[0]?.baseColor, '#8F684A');

    // Invariant check passes
    validateSceneSpecInvariants(normalized);
  });

  it('bounds coordinates to [-10.0, 10.0] and enforces part limit of 64', () => {
    const adapter = new GroqAdapter();
    const excessiveParts: any[] = [];
    for (let i = 0; i < 100; i++) {
      excessiveParts.push({
        id: `part_${i}`,
        type: 'box',
        size: [50.0, 50.0, 50.0], // Out of bounds size
        position: [100.0, -100.0, 50.0], // Out of bounds pos
        materialId: 'mat_default',
      });
    }

    const payload = {
      objectName: 'massive_object',
      parts: excessiveParts,
    };

    const normalized = adapter.normalizeSceneSpec(payload);
    // Should be clamped to 64 parts
    assert.strictEqual(normalized.parts.length, 64);
    // Coordinates clamped to [-10, 10]
    assert.strictEqual(normalized.parts[0]?.position[0], 10.0);
    assert.strictEqual(normalized.parts[0]?.position[1], -10.0);
    assert.strictEqual(normalized.parts[0]?.position[2], 10.0);
    // Size clamped to positive max 20.0
    assert.strictEqual(normalized.parts[0]?.size[0], 20.0);

    // Invariant check passes
    validateSceneSpecInvariants(normalized);
  });

  it('normalizes VLM image analysis responses', () => {
    const adapter = new AnthropicAdapter();
    const rawAnalysis = JSON.stringify({
      objectClass: 'ceramic_mug',
      overallDescription: 'White ceramic coffee mug with handle on right side',
      referenceView: { azimuthDeg: 40.0, elevationDeg: 10.0 },
      visibleParts: [
        {
          name: 'cup_body',
          estimatedShape: 'cylinder',
          relativeProportions: [1.0, 1.0, 1.2],
          visibleSurfaceColor: '#FFFFFF',
          estimatedMaterial: 'ceramic',
          confidence: 0.95,
        },
        {
          name: 'handle',
          estimatedShape: 'torus',
          relativeProportions: [0.3, 0.6, 0.8],
          visibleSurfaceColor: '#FFFFFF',
          estimatedMaterial: 'ceramic',
          confidence: 0.9,
        },
      ],
      estimatedDominantMaterials: ['ceramic'],
      hiddenOrOccludedFeatures: ['Interior bottom occluded by angle'],
      confidenceScore: 0.92,
      reasoningNotes: ['Standard cylindrical geometry with single loop handle.'],
    });

    const normalized = adapter.normalizeImageAnalysis(rawAnalysis);
    assert.strictEqual(normalized.objectClass, 'ceramic_mug');
    assert.strictEqual(normalized.visibleParts.length, 2);
    assert.strictEqual(normalized.visibleParts[0]?.estimatedShape, 'cylinder');
    assert.strictEqual(normalized.visibleParts[1]?.estimatedShape, 'torus');
    assert.strictEqual(normalized.confidenceScore, 0.92);
  });

  it('normalizes error taxonomy accurately', () => {
    const adapter = new OpenAIAdapter();

    const authErr = adapter.normalizeError({ status: 401, message: 'Invalid API key provided' });
    assert.strictEqual(authErr.code, 'AUTHENTICATION_FAILED');
    assert.strictEqual(authErr.retryable, false);

    const rateErr = adapter.normalizeError({ status: 429, message: 'Rate limit exceeded' });
    assert.strictEqual(rateErr.code, 'RATE_LIMIT_EXCEEDED');
    assert.strictEqual(rateErr.retryable, true);

    const quotaErr = adapter.normalizeError({ status: 429, message: 'You have exceeded your quota' });
    assert.strictEqual(quotaErr.code, 'QUOTA_EXCEEDED');
    assert.strictEqual(quotaErr.retryable, false);

    const notFoundErr = adapter.normalizeError({ status: 404, message: 'The model does not exist' });
    assert.strictEqual(notFoundErr.code, 'MODEL_NOT_FOUND');
    assert.strictEqual(notFoundErr.retryable, false);
  });
});
