import { defaultAdapterRegistry } from '../adapters/index.ts';
import { defaultCapabilityRegistry } from '../registry/index.ts';
import type { WorkflowStageType } from '../types/capabilities.ts';
import { WorkflowStage } from '../types/capabilities.ts';
import { ProviderError } from '../types/errors.ts';
import type {
  GeometryPlanningRequest,
  ResolvedProviderContext,
  VisionAnalysisRequest,
} from '../types/providers.ts';
import type { ImageAnalysisResult, SceneSpecV1 } from '../types/scene-spec.ts';
import { defaultCredentialVault, type CredentialVault } from '../vault/store.ts';

export interface WorkflowStageGateOptions {
  readonly vault?: CredentialVault;
}

/**
 * Workflow Stage Gate.
 * Enforces strict capability validation so that only compatible models can be run
 * for each workflow stage (e.g. rejecting non-VLMs for vision analysis).
 */
export class WorkflowStageGate {
  private readonly vault: CredentialVault;

  constructor(options?: WorkflowStageGateOptions) {
    this.vault = options?.vault ?? defaultCredentialVault;
  }

  /**
   * Execute Vision Analysis stage with capability gating and safe in-memory key resolution.
   * Throws INCOMPATIBLE_STAGE_MODEL if selected model lacks vision capabilities.
   */
  public async executeVisionStage(
    accountId: string,
    request: VisionAnalysisRequest,
    providerId: string
  ): Promise<ImageAnalysisResult> {
    // 1. Capability Check: must support image_input and vision_analysis
    const model = defaultCapabilityRegistry.assertModelCompatibleForStage(
      request.modelId,
      WorkflowStage.VISION_ANALYSIS,
      providerId
    );

    // 2. Resolve Decrypted Credential (server-side in-memory only)
    const rawApiKey = this.vault.getDecryptedKey(accountId, providerId);
    const summary = this.vault.getCredentialSummary(accountId, providerId);

    const context: ResolvedProviderContext = {
      accountId,
      providerId,
      apiKey: rawApiKey,
      customBaseUrl: summary?.customBaseUrl,
    };

    // 3. Dispatch to Provider Adapter
    const adapter = defaultAdapterRegistry.getAdapter(providerId);
    return adapter.invokeVision(request, context);
  }

  /**
   * Execute Geometry Planning stage with capability gating.
   * Requires model to support structured_output and text.
   */
  public async executePlanningStage(
    accountId: string,
    request: GeometryPlanningRequest,
    providerId: string
  ): Promise<SceneSpecV1> {
    // 1. Capability Check
    defaultCapabilityRegistry.assertModelCompatibleForStage(
      request.modelId,
      WorkflowStage.GEOMETRY_PLANNING,
      providerId
    );

    // 2. Resolve Credential
    const rawApiKey = this.vault.getDecryptedKey(accountId, providerId);
    const summary = this.vault.getCredentialSummary(accountId, providerId);

    const context: ResolvedProviderContext = {
      accountId,
      providerId,
      apiKey: rawApiKey,
      customBaseUrl: summary?.customBaseUrl,
    };

    // 3. Dispatch to Provider Adapter
    const adapter = defaultAdapterRegistry.getAdapter(providerId);
    return adapter.invokePlanner(request, context);
  }

  /**
   * Helper to check stage compatibility beforehand without executing.
   */
  public checkStageCompatibility(modelId: string, stage: WorkflowStageType, providerId?: string) {
    return defaultCapabilityRegistry.validateModelForStage(modelId, stage, providerId);
  }
}

export const defaultWorkflowStageGate = new WorkflowStageGate();
