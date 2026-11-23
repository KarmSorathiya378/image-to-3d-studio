import {
  type CapabilityValidationResult,
  type ModelCapabilityType,
  type ModelClassification,
  type WorkflowStageType,
  STAGE_CAPABILITY_REQUIREMENTS,
} from '../types/capabilities.ts';
import { ProviderError } from '../types/errors.ts';
import { CURATED_MODELS } from './models.ts';

/**
 * Capability Registry that classifies models and enforces stage compatibility.
 * Prevents non-VLMs from being selected for vision, or incapable models for geometry planning.
 */
export class CapabilityRegistry {
  private readonly models = new Map<string, ModelClassification>();

  constructor(initialModels: readonly ModelClassification[] = CURATED_MODELS) {
    for (const model of initialModels) {
      this.registerModel(model);
    }
  }

  /**
   * Register a new model classification into the registry.
   */
  public registerModel(model: ModelClassification): void {
    const key = this.buildKey(model.providerId, model.id);
    this.models.set(key, model);
    // Also index by model ID alone if unambiguous
    if (!this.models.has(model.id)) {
      this.models.set(model.id, model);
    }
  }

  /**
   * Find a model by ID (optionally scoped by provider ID).
   */
  public getModel(modelId: string, providerId?: string): ModelClassification | undefined {
    if (providerId) {
      const scoped = this.models.get(this.buildKey(providerId, modelId));
      if (scoped) return scoped;
    }
    return this.models.get(modelId);
  }

  /**
   * List all models registered for a specific provider.
   */
  public listModelsByProvider(
    providerId: string,
    options?: { includeSpecialists?: boolean; includeDeprecated?: boolean }
  ): readonly ModelClassification[] {
    const results: ModelClassification[] = [];
    const seen = new Set<string>();

    for (const model of this.models.values()) {
      if (model.providerId !== providerId) continue;
      if (seen.has(model.id)) continue;
      if (model.isSpecialist && !options?.includeSpecialists) continue;
      if (model.isDeprecated && !options?.includeDeprecated) continue;

      seen.add(model.id);
      results.push(model);
    }

    return results;
  }

  /**
   * List models that possess a specific capability.
   */
  public listModelsWithCapability(
    capability: ModelCapabilityType,
    options?: { providerId?: string; includeSpecialists?: boolean }
  ): readonly ModelClassification[] {
    const results: ModelClassification[] = [];
    const seen = new Set<string>();

    for (const model of this.models.values()) {
      if (options?.providerId && model.providerId !== options.providerId) continue;
      if (model.isSpecialist && !options?.includeSpecialists) continue;
      if (seen.has(model.id)) continue;

      if (model.capabilities.includes(capability)) {
        seen.add(model.id);
        results.push(model);
      }
    }

    return results;
  }

  /**
   * List all models compatible with a specific workflow stage.
   */
  public listModelsForStage(
    stage: WorkflowStageType,
    options?: { providerId?: string; includeSpecialists?: boolean }
  ): readonly ModelClassification[] {
    const required = STAGE_CAPABILITY_REQUIREMENTS[stage];
    const results: ModelClassification[] = [];
    const seen = new Set<string>();

    for (const model of this.models.values()) {
      if (options?.providerId && model.providerId !== options.providerId) continue;
      if (model.isSpecialist && !options?.includeSpecialists) continue;
      if (seen.has(model.id)) continue;

      const hasAllRequired = required.every((req) => model.capabilities.includes(req));
      if (hasAllRequired) {
        seen.add(model.id);
        results.push(model);
      }
    }

    return results;
  }

  /**
   * Validate if a model is compatible with a given workflow stage.
   * Returns a detailed validation result.
   */
  public validateModelForStage(
    modelId: string,
    stage: WorkflowStageType,
    providerId?: string
  ): CapabilityValidationResult {
    const model = this.getModel(modelId, providerId);

    if (!model) {
      return {
        compatible: false,
        modelId,
        stage,
        missingCapabilities: STAGE_CAPABILITY_REQUIREMENTS[stage],
        reason: `Model "${modelId}" is not recognized in the provider capability registry.`,
      };
    }

    const required = STAGE_CAPABILITY_REQUIREMENTS[stage];
    const missing = required.filter((cap) => !model.capabilities.includes(cap));

    if (missing.length > 0) {
      const reason =
        stage === 'vision_analysis'
          ? `Model "${model.name}" (${model.id}) lacks vision capabilities (${missing.join(
              ', '
            )}). Non-VLM models cannot be used for the Image Analysis stage. Please select a model supporting image input and vision analysis.`
          : `Model "${model.name}" (${model.id}) is missing required capabilities for stage "${stage}": ${missing.join(
              ', '
            )}.`;

      return {
        compatible: false,
        modelId: model.id,
        stage,
        missingCapabilities: missing,
        reason,
      };
    }

    return {
      compatible: true,
      modelId: model.id,
      stage,
      missingCapabilities: [],
    };
  }

  /**
   * Strict assertion version: throws ProviderError if model is incompatible.
   */
  public assertModelCompatibleForStage(
    modelId: string,
    stage: WorkflowStageType,
    providerId?: string
  ): ModelClassification {
    const result = this.validateModelForStage(modelId, stage, providerId);
    if (!result.compatible) {
      throw new ProviderError({
        code: 'INCOMPATIBLE_STAGE_MODEL',
        retryable: false,
        userMessage: result.reason ?? `Model ${modelId} is incompatible with stage ${stage}.`,
      });
    }

    return this.getModel(modelId, providerId)!;
  }

  private buildKey(providerId: string, modelId: string): string {
    return `${providerId.toLowerCase()}:${modelId.toLowerCase()}`;
  }
}
