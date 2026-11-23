/**
 * Provider adapter contracts and interfaces.
 */

import type { ModelClassification } from './capabilities.ts';
import type { NormalizedProviderError } from './errors.ts';
import type { ImageAnalysisResult, SceneSpecV1 } from './scene-spec.ts';

export const ProviderId = {
  OPENAI: 'openai',
  GROQ: 'groq',
  INCEPTION: 'inception',
  GEMINI: 'gemini',
  ANTHROPIC: 'anthropic',
  TRIPO: 'tripo',
  MESHY: 'meshy',
} as const;

export type ProviderIdType = (typeof ProviderId)[keyof typeof ProviderId];

/**
 * Vision Request payload.
 */
export interface VisionAnalysisRequest {
  readonly modelId: string;
  readonly image: {
    readonly base64Data?: string;
    readonly mimeType: string;
    readonly imageUrl?: string;
  };
  readonly userPrompt?: string;
  readonly systemInstructions?: string;
}

/**
 * Geometry Planning Request payload.
 */
export interface GeometryPlanningRequest {
  readonly modelId: string;
  readonly analysis: ImageAnalysisResult;
  readonly userGuidance?: string;
  readonly maxParts?: number;
  readonly coordinateSystem?: 'Z_UP';
}

/**
 * Specialist 3D Generation Request payload.
 */
export interface Specialist3DRequest {
  readonly modelId: string;
  readonly image: {
    readonly base64Data?: string;
    readonly mimeType: string;
    readonly imageUrl?: string;
  };
  readonly prompt?: string;
}

export interface Specialist3DTask {
  readonly taskId: string;
  readonly status: 'pending' | 'processing' | 'succeeded' | 'failed';
  readonly modelUrl?: string;
  readonly progress?: number;
  readonly errorMessage?: string;
}

/**
 * Resolved provider context passed to adapters.
 * Notice the decrypted apiKey is provided ONLY at execution time in memory.
 */
export interface ResolvedProviderContext {
  readonly providerId: string;
  readonly apiKey: string;
  readonly customBaseUrl?: string;
  readonly accountId: string;
}

/**
 * Connection test result.
 */
export interface ConnectionTestResult {
  readonly ok: boolean;
  readonly status: 'connected' | 'invalid' | 'error';
  readonly message: string;
  readonly isNonBillable: boolean;
  readonly latencyMs?: number;
}

/**
 * Extensible Base Provider Adapter Contract
 */
export interface IProviderAdapter {
  readonly providerId: ProviderIdType;
  readonly displayName: string;
  readonly officialDocumentationUrl: string;
  readonly isSpecialist3D: boolean;

  /**
   * Safe connectivity test (non-billable where possible).
   */
  testCredential(context: ResolvedProviderContext): Promise<ConnectionTestResult>;

  /**
   * List available models from the provider.
   */
  listModels(context: ResolvedProviderContext): Promise<readonly ModelClassification[]>;

  /**
   * Run VLM Vision Analysis stage.
   */
  invokeVision(
    request: VisionAnalysisRequest,
    context: ResolvedProviderContext
  ): Promise<ImageAnalysisResult>;

  /**
   * Run Geometry Planning stage to emit SceneSpec v1.
   */
  invokePlanner(
    request: GeometryPlanningRequest,
    context: ResolvedProviderContext
  ): Promise<SceneSpecV1>;

  /**
   * Specialist 3D generation (optional, behind capability flag).
   */
  submitSpecialist3D?(
    request: Specialist3DRequest,
    context: ResolvedProviderContext
  ): Promise<Specialist3DTask>;

  pollSpecialist3D?(
    taskId: string,
    context: ResolvedProviderContext
  ): Promise<Specialist3DTask>;

  /**
   * Normalize raw errors into unified taxonomy.
   */
  normalizeError(error: unknown): NormalizedProviderError;
}
