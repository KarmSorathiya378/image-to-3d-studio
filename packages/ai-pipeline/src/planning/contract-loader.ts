import { validateSceneSpec } from './scenespec-schema.ts';
import type { SceneSpec } from './types.ts';

export interface ContractValidator {
  validate(data: unknown): SceneSpec;
  isExternal: boolean;
}

/**
 * Dynamic contract loader:
 * Attempts to resolve and load the canonical SceneSpec validator from `@image-to-3d/contracts` or `packages/contracts`
 * when Dax provides it. If not yet installed/linked, cleanly falls back to our local specification-compliant validator.
 */
export async function getSceneSpecContract(): Promise<ContractValidator> {
  // Try importing from packages/contracts if available in monorepo
  try {
    // Dynamic import to avoid build-time failure when contracts is not yet present
    const contractsModule = await import(
      /* @vite-ignore */
      '../../../contracts/src/index.ts' as string
    ).catch(() => null);

    if (contractsModule && typeof contractsModule.validateSceneSpec === 'function') {
      return {
        validate: contractsModule.validateSceneSpec,
        isExternal: true,
      };
    }
  } catch {
    // Fall back to built-in contract
  }

  return {
    validate: validateSceneSpec,
    isExternal: false,
  };
}
