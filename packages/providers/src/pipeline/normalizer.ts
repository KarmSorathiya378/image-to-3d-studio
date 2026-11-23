import { ProviderError } from '../types/errors.ts';
import type { ScenePart, SceneSpecV1 } from '../types/scene-spec.ts';

/**
 * Validates a SceneSpec v1 object against geometry invariants:
 * - Part count <= 64
 * - Coordinates bounded in [-10.0, 10.0]
 * - Non-degenerate sizes
 * - No malicious code or script injections
 */
export function validateSceneSpecInvariants(spec: SceneSpecV1): void {
  if (spec.schemaVersion !== '1.0') {
    throw new ProviderError({
      code: 'MALFORMED_RESPONSE',
      retryable: false,
      userMessage: `Invalid schemaVersion: expected "1.0", got "${spec.schemaVersion}".`,
    });
  }

  if (spec.coordinateSystem !== 'Z_UP') {
    throw new ProviderError({
      code: 'MALFORMED_RESPONSE',
      retryable: false,
      userMessage: `Invalid coordinateSystem: expected "Z_UP", got "${spec.coordinateSystem}".`,
    });
  }

  if (!Array.isArray(spec.parts) || spec.parts.length === 0) {
    throw new ProviderError({
      code: 'MALFORMED_RESPONSE',
      retryable: true,
      userMessage: 'SceneSpec must contain at least one part.',
    });
  }

  if (spec.parts.length > 64) {
    throw new ProviderError({
      code: 'MALFORMED_RESPONSE',
      retryable: true,
      userMessage: `SceneSpec exceeds maximum part count of 64 (got ${spec.parts.length}).`,
    });
  }

  for (const part of spec.parts) {
    validatePartInvariants(part);
  }
}

function validatePartInvariants(part: ScenePart): void {
  for (let i = 0; i < 3; i++) {
    const pos = part.position[i]!;
    if (pos < -10.0 || pos > 10.0) {
      throw new ProviderError({
        code: 'MALFORMED_RESPONSE',
        retryable: true,
        userMessage: `Part "${part.id}" position[${i}] = ${pos} is outside the allowed [-10.0, 10.0] range.`,
      });
    }

    const size = part.size[i]!;
    if (size <= 0.0 || size > 20.0) {
      throw new ProviderError({
        code: 'MALFORMED_RESPONSE',
        retryable: true,
        userMessage: `Part "${part.id}" size[${i}] = ${size} is degenerate or exceeds maximum bounds.`,
      });
    }
  }

  // Check against script injections in part IDs or names
  const dangerousPatterns = /<script|exec\(|eval\(|import\s|__import__|os\.system|subprocess/i;
  if (dangerousPatterns.test(part.id) || (part.name && dangerousPatterns.test(part.name))) {
    throw new ProviderError({
      code: 'MALFORMED_RESPONSE',
      retryable: false,
      userMessage: `Prohibited code injection detected in SceneSpec part definition.`,
    });
  }
}
