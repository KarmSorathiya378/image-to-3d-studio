import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  repairModelJsonResponse,
  repairStructuredDescription,
  isRetryableError,
  calculateBackoffDelay,
  executeWithRetry,
  buildRepromptMessage,
} from '../src/repair/index.ts';
import { MalformedModelOutputError, ProviderError } from '../src/errors/pipeline-errors.ts';

describe('Repair and Retry Logic - Acceptance Checks', () => {
  it('extracts JSON from markdown code fence', () => {
    const raw = '```json\n{"objectName": "stool", "parts": []}\n```';
    const result = repairModelJsonResponse<{ objectName: string }>(raw);
    assert.strictEqual(result.parsed.objectName, 'stool');
    assert.strictEqual(result.repaired, true);
  });

  it('strips conversational preambles and postambles', () => {
    const raw = 'Here is the requested 3D model:\n{"objectName": "box", "parts": []}\nHope that helps!';
    const result = repairModelJsonResponse<{ objectName: string }>(raw);
    assert.strictEqual(result.parsed.objectName, 'box');
  });

  it('removes trailing commas from arrays and objects', () => {
    const raw = '{"name": "test", "items": [1, 2, 3,],}';
    const result = repairModelJsonResponse<{ name: string; items: number[] }>(raw);
    assert.strictEqual(result.parsed.name, 'test');
    assert.strictEqual(result.parsed.items.length, 3);
  });

  it('fixes single-quoted keys and strings', () => {
    const raw = "{'name': 'stool', 'count': 4}";
    const result = repairModelJsonResponse<{ name: string; count: number }>(raw);
    assert.strictEqual(result.parsed.name, 'stool');
    assert.strictEqual(result.parsed.count, 4);
  });

  it('recovers truncated JSON with dangling braces/brackets', () => {
    const raw = '{"objectName": "chair", "parts": [{"id": "seat", "type": "box"';
    const result = repairModelJsonResponse<{ objectName: string; parts: unknown[] }>(raw);
    assert.strictEqual(result.parsed.objectName, 'chair');
    assert.strictEqual(result.parsed.parts.length, 1);
  });

  it('deterministically rejects unrepairable corrupt garbage', () => {
    const garbage = 'THIS IS DEFINITELY NOT JSON AT ALL <?> !!!';
    assert.throws(
      () => repairModelJsonResponse(garbage),
      (err: unknown) => err instanceof MalformedModelOutputError
    );
  });

  it('domain repairer clamps out-of-range coordinates and supplies missing materials', () => {
    const malformed = {
      category: 'stool',
      components: [
        {
          name: 'seat',
          suggestedPrimitive: 'cylinder',
          relativePosition: [99.0, 0, 0], // out of bound
          relativeSize: [1, 1, 1],
          materialId: 'missing_mat_1',
        },
      ],
      materials: [], // empty materials
    };

    const repair = repairStructuredDescription(malformed);
    assert.strictEqual(repair.repaired, true);
    // Position clamped to 10.0
    assert.strictEqual(repair.data.components[0].relativePosition[0], 10.0);
    // Auto-generated missing material
    assert.ok(repair.data.materials.some((m) => m.id === 'missing_mat_1'));
  });

  it('classifies retryable vs non-retryable provider errors', () => {
    assert.strictEqual(isRetryableError(new Error('Rate limit exceeded (429)')), true);
    assert.strictEqual(isRetryableError(new Error('Gateway Timeout 504')), true);
    assert.strictEqual(isRetryableError(new Error('401 Unauthorized: invalid api key')), false);
    assert.strictEqual(isRetryableError(new Error('400 Bad Request')), false);
  });

  it('calculates exponential backoff with jitter', () => {
    const delay0 = calculateBackoffDelay(0, { initialDelayMs: 200, backoffFactor: 2, maxDelayMs: 5000, jitterRatio: 0.1, maxRetries: 3 });
    const delay2 = calculateBackoffDelay(2, { initialDelayMs: 200, backoffFactor: 2, maxDelayMs: 5000, jitterRatio: 0.1, maxRetries: 3 });
    assert.ok(delay0 >= 150 && delay0 <= 250);
    assert.ok(delay2 >= 600 && delay2 <= 1000);
  });

  it('executes retries on transient errors and succeeds', async () => {
    let attempts = 0;
    const res = await executeWithRetry(
      async (attempt) => {
        attempts++;
        if (attempt < 2) {
          throw new ProviderError('PROVIDER_RATE_LIMITED', 'Rate limit 429', { retryable: true });
        }
        return 'success';
      },
      { maxRetries: 3, initialDelayMs: 20 }
    );

    assert.strictEqual(res, 'success');
    assert.strictEqual(attempts, 3);
  });

  it('builds clear reprompt message for model correction', () => {
    const reprompt = buildRepromptMessage({
      validationErrors: ['Missing materialId "wood"', 'Position coordinate out of bounds'],
      schemaType: 'SceneSpec',
    });
    assert.ok(reprompt.includes('Missing materialId "wood"'));
    assert.ok(reprompt.includes('SceneSpec'));
  });
});
