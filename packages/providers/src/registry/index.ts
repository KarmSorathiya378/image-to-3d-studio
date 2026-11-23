import { CapabilityRegistry } from './capabilities.ts';
import { CURATED_MODELS } from './models.ts';

export * from './capabilities.ts';
export * from './models.ts';

/**
 * Global capability registry singleton instance.
 */
export const defaultCapabilityRegistry = new CapabilityRegistry(CURATED_MODELS);
