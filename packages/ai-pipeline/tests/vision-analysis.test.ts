import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  validateStructuredObjectDescription,
  normalizeHexColor,
  getMockObjectDescription,
  buildVlmUserPrompt,
  VLM_SYSTEM_PROMPT,
} from '../src/vision/index.ts';
import { MalformedModelOutputError } from '../src/errors/pipeline-errors.ts';

describe('Vision-Language Analysis - Contracts and Schemas', () => {
  it('validates a correct StructuredObjectDescription', () => {
    const mockStool = getMockObjectDescription('stool');
    const validated = validateStructuredObjectDescription(mockStool);
    assert.strictEqual(validated.category, 'stool');
    assert.ok(validated.confidence > 0.9);
    assert.ok(validated.components.length >= 3);
    assert.ok(validated.materials.length >= 1);
    assert.ok(validated.uncertaintyFlags.notes.length > 0);
  });

  it('enforces non-empty components list', () => {
    const invalid = {
      category: 'chair',
      summary: 'empty',
      cameraView: { estimatedAzimuthDeg: 0, estimatedElevationDeg: 0, distanceEstimate: 'medium', viewAngleDescription: 'front' },
      proportions: { widthRatio: 1, depthRatio: 1, heightRatio: 1 },
      components: [],
      materials: [],
      uncertaintyFlags: { notes: [] },
    };

    assert.throws(
      () => validateStructuredObjectDescription(invalid),
      (err: unknown) => {
        return err instanceof MalformedModelOutputError;
      }
    );
  });

  it('normalizes hex color codes reliably', () => {
    assert.strictEqual(normalizeHexColor('#fff'), '#FFFFFF');
    assert.strictEqual(normalizeHexColor('8F684A'), '#8F684A');
    assert.strictEqual(normalizeHexColor('#123456'), '#123456');
    assert.strictEqual(normalizeHexColor('invalid'), '#808080');
  });

  it('system prompt forbids overclaiming exact metric dimensions', () => {
    assert.ok(VLM_SYSTEM_PROMPT.includes('DO NOT OVERCLAIM EXACT METRIC DIMENSIONS'));
    assert.ok(VLM_SYSTEM_PROMPT.includes('OUTPUT PURE JSON ONLY'));
    assert.ok(VLM_SYSTEM_PROMPT.includes('SUPPORTED PRIMITIVES ONLY'));
  });

  it('builds contextual user prompt with custom instructions', () => {
    const prompt = buildVlmUserPrompt({ userInstructions: 'Make the stool seat round and thick' });
    assert.ok(prompt.includes('Make the stool seat round and thick'));
    assert.ok(prompt.includes('StructuredObjectDescription'));
  });
});
