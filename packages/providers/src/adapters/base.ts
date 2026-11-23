import { defaultSsrfValidator, type SsrfValidator } from '../ssrf/validator.ts';
import type { ModelClassification } from '../types/capabilities.ts';
import { type NormalizedProviderError, ProviderError } from '../types/errors.ts';
import type {
  ConnectionTestResult,
  GeometryPlanningRequest,
  IProviderAdapter,
  ProviderIdType,
  ResolvedProviderContext,
  Specialist3DRequest,
  Specialist3DTask,
  VisionAnalysisRequest,
} from '../types/providers.ts';
import type { ImageAnalysisResult, ScenePart, ScenePrimitiveType, SceneSpecV1 } from '../types/scene-spec.ts';

export interface BaseAdapterOptions {
  readonly ssrfValidator?: SsrfValidator;
}

const VALID_PRIMITIVES = new Set<ScenePrimitiveType>([
  'box',
  'cylinder',
  'sphere',
  'cone',
  'capsule',
  'torus',
  'lathe',
  'extrudedPolygon',
]);

/**
 * Extensible Base Provider Adapter.
 * Normalizes HTTP requests, timeouts, errors, and standardizes SceneSpec / ImageAnalysis payloads.
 */
export abstract class BaseProviderAdapter implements IProviderAdapter {
  public abstract readonly providerId: ProviderIdType;
  public abstract readonly displayName: string;
  public abstract readonly officialDocumentationUrl: string;
  public readonly isSpecialist3D: boolean = false;

  protected readonly ssrfValidator: SsrfValidator;

  constructor(options?: BaseAdapterOptions) {
    this.ssrfValidator = options?.ssrfValidator ?? defaultSsrfValidator;
  }

  public abstract testCredential(context: ResolvedProviderContext): Promise<ConnectionTestResult>;
  public abstract listModels(context: ResolvedProviderContext): Promise<readonly ModelClassification[]>;
  public abstract invokeVision(
    request: VisionAnalysisRequest,
    context: ResolvedProviderContext
  ): Promise<ImageAnalysisResult>;
  public abstract invokePlanner(
    request: GeometryPlanningRequest,
    context: ResolvedProviderContext
  ): Promise<SceneSpecV1>;

  public submitSpecialist3D?(
    _request: Specialist3DRequest,
    _context: ResolvedProviderContext
  ): Promise<Specialist3DTask> {
    throw new ProviderError({
      code: 'FEATURE_NOT_SUPPORTED',
      retryable: false,
      userMessage: `Specialist 3D generation is not supported by provider "${this.displayName}".`,
    });
  }

  public pollSpecialist3D?(
    _taskId: string,
    _context: ResolvedProviderContext
  ): Promise<Specialist3DTask> {
    throw new ProviderError({
      code: 'FEATURE_NOT_SUPPORTED',
      retryable: false,
      userMessage: `Specialist 3D polling is not supported by provider "${this.displayName}".`,
    });
  }

  /**
   * Safe fetch utility wrapping standard fetch with SSRF verification, timeouts, and error normalization.
   */
  protected async safeFetch(
    urlStr: string,
    init: RequestInit,
    timeoutMs: number = 30000
  ): Promise<Response> {
    // Enforce SSRF validation on target URL
    this.ssrfValidator.validateEndpoint(urlStr);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(urlStr, {
        ...init,
        signal: controller.signal,
      });
      return response;
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') {
        throw new ProviderError({
          code: 'TIMEOUT',
          retryable: true,
          userMessage: `Request to provider ${this.displayName} timed out after ${timeoutMs}ms.`,
          originalError: err,
        });
      }
      throw this.normalizeError(err);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Normalizes raw LLM output into a verified SceneSpec v1 schema.
   */
  public normalizeSceneSpec(rawJson: unknown, defaultObjectName: string = 'generated_object'): SceneSpecV1 {
    let parsed: any;
    if (typeof rawJson === 'string') {
      try {
        // Strip markdown code fences if present (```json ... ```)
        const cleaned = rawJson.replace(/```(?:json)?\n?/gi, '').replace(/```/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch (err) {
        throw new ProviderError({
          code: 'MALFORMED_RESPONSE',
          retryable: true,
          userMessage: 'Failed to parse JSON response into SceneSpec v1 schema.',
          originalError: err,
        });
      }
    } else {
      parsed = rawJson;
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new ProviderError({
        code: 'MALFORMED_RESPONSE',
        retryable: true,
        userMessage: 'SceneSpec response is empty or not an object.',
      });
    }

    // Sanitize and bound parts
    const rawParts = Array.isArray(parsed.parts) ? parsed.parts : [];
    const sanitizedParts: ScenePart[] = [];

    // Max 64 parts invariant
    const boundedParts = rawParts.slice(0, 64);
    for (let i = 0; i < boundedParts.length; i++) {
      const p = boundedParts[i];
      if (!p || typeof p !== 'object') continue;

      const primitiveType: ScenePrimitiveType = VALID_PRIMITIVES.has(p.type) ? p.type : 'box';

      // Clamp coordinates to [-10.0, 10.0] invariant
      const pos: [number, number, number] = [
        this.clampCoordinate(p.position?.[0] ?? 0),
        this.clampCoordinate(p.position?.[1] ?? 0),
        this.clampCoordinate(p.position?.[2] ?? 0),
      ];

      // Clamp size to positive [0.01, 20.0]
      const size: [number, number, number] = [
        Math.max(0.01, Math.min(20.0, Math.abs(p.size?.[0] ?? 1.0))),
        Math.max(0.01, Math.min(20.0, Math.abs(p.size?.[1] ?? 1.0))),
        Math.max(0.01, Math.min(20.0, Math.abs(p.size?.[2] ?? 1.0))),
      ];

      const rot: [number, number, number] = [
        (p.rotationDeg?.[0] ?? 0) % 360,
        (p.rotationDeg?.[1] ?? 0) % 360,
        (p.rotationDeg?.[2] ?? 0) % 360,
      ];

      sanitizedParts.push({
        id: typeof p.id === 'string' && p.id ? p.id : `part_${i + 1}`,
        type: primitiveType,
        size,
        position: pos,
        rotationDeg: rot,
        materialId: typeof p.materialId === 'string' && p.materialId ? p.materialId : 'mat_default',
        name: typeof p.name === 'string' ? p.name : undefined,
      });
    }

    // Sanitize materials
    const rawMaterials = Array.isArray(parsed.materials) ? parsed.materials : [];
    const sanitizedMaterials = rawMaterials.map((m: any, idx: number) => ({
      id: typeof m?.id === 'string' && m.id ? m.id : `mat_${idx + 1}`,
      baseColor: typeof m?.baseColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(m.baseColor) ? m.baseColor : '#8F684A',
      roughness: typeof m?.roughness === 'number' ? Math.max(0, Math.min(1, m.roughness)) : 0.5,
      metallic: typeof m?.metallic === 'number' ? Math.max(0, Math.min(1, m.metallic)) : 0.0,
      name: typeof m?.name === 'string' ? m.name : undefined,
    }));

    if (sanitizedMaterials.length === 0) {
      sanitizedMaterials.push({
        id: 'mat_default',
        baseColor: '#8F684A',
        roughness: 0.5,
        metallic: 0.0,
      });
    }

    return {
      $schema: 'https://image-to-3d-studio.internal/schemas/scenespec-v1.json',
      schemaVersion: '1.0',
      objectName: typeof parsed.objectName === 'string' && parsed.objectName ? parsed.objectName : defaultObjectName,
      coordinateSystem: 'Z_UP',
      units: 'relative',
      referenceView: {
        azimuthDeg: typeof parsed.referenceView?.azimuthDeg === 'number' ? parsed.referenceView.azimuthDeg : 35.0,
        elevationDeg: typeof parsed.referenceView?.elevationDeg === 'number' ? parsed.referenceView.elevationDeg : 15.0,
      },
      parts: sanitizedParts,
      materials: sanitizedMaterials,
      uncertaintyNotes: Array.isArray(parsed.uncertaintyNotes)
        ? parsed.uncertaintyNotes.filter((n: any) => typeof n === 'string')
        : ['Generated by AI Image-to-3D Studio geometry planning.'],
    };
  }

  /**
   * Normalizes raw VLM output into a verified ImageAnalysisResult.
   */
  public normalizeImageAnalysis(rawJson: unknown): ImageAnalysisResult {
    let parsed: any;
    if (typeof rawJson === 'string') {
      try {
        const cleaned = rawJson.replace(/```(?:json)?\n?/gi, '').replace(/```/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch (err) {
        throw new ProviderError({
          code: 'MALFORMED_RESPONSE',
          retryable: true,
          userMessage: 'Failed to parse JSON response into ImageAnalysis schema.',
          originalError: err,
        });
      }
    } else {
      parsed = rawJson;
    }

    return {
      objectClass: typeof parsed?.objectClass === 'string' ? parsed.objectClass : 'object',
      overallDescription: typeof parsed?.overallDescription === 'string' ? parsed.overallDescription : 'Single-view photograph',
      referenceView: {
        azimuthDeg: typeof parsed?.referenceView?.azimuthDeg === 'number' ? parsed.referenceView.azimuthDeg : 30.0,
        elevationDeg: typeof parsed?.referenceView?.elevationDeg === 'number' ? parsed.referenceView.elevationDeg : 15.0,
      },
      visibleParts: Array.isArray(parsed?.visibleParts)
        ? parsed.visibleParts.map((p: any) => ({
            name: typeof p?.name === 'string' ? p.name : 'component',
            estimatedShape: typeof p?.estimatedShape === 'string' ? p.estimatedShape : 'box',
            relativeProportions: [
              p?.relativeProportions?.[0] ?? 1.0,
              p?.relativeProportions?.[1] ?? 1.0,
              p?.relativeProportions?.[2] ?? 1.0,
            ],
            visibleSurfaceColor: typeof p?.visibleSurfaceColor === 'string' ? p.visibleSurfaceColor : '#777777',
            estimatedMaterial: typeof p?.estimatedMaterial === 'string' ? p.estimatedMaterial : 'matte',
            confidence: typeof p?.confidence === 'number' ? Math.max(0, Math.min(1, p.confidence)) : 0.8,
          }))
        : [],
      estimatedDominantMaterials: Array.isArray(parsed?.estimatedDominantMaterials)
        ? parsed.estimatedDominantMaterials.filter((m: any) => typeof m === 'string')
        : ['wood'],
      hiddenOrOccludedFeatures: Array.isArray(parsed?.hiddenOrOccludedFeatures)
        ? parsed.hiddenOrOccludedFeatures.filter((f: any) => typeof f === 'string')
        : ['Underside and rear surface occluded from camera angle'],
      confidenceScore: typeof parsed?.confidenceScore === 'number' ? parsed.confidenceScore : 0.85,
      reasoningNotes: Array.isArray(parsed?.reasoningNotes)
        ? parsed.reasoningNotes.filter((r: any) => typeof r === 'string')
        : [],
    };
  }

  /**
   * Generic error normalization for HTTP and provider errors.
   */
  public normalizeError(error: unknown): NormalizedProviderError {
    if (error instanceof ProviderError) {
      return {
        code: error.code,
        retryable: error.retryable,
        userMessage: error.userMessage,
        statusCode: error.statusCode,
        originalError: error.originalError,
      };
    }

    const err = error as any;
    const status = err?.status ?? err?.statusCode;
    const message = err?.message ?? 'An unexpected error occurred while communicating with the provider.';

    if (status === 401 || status === 403 || /unauthorized|invalid api key|forbidden/i.test(message)) {
      return {
        code: 'AUTHENTICATION_FAILED',
        retryable: false,
        userMessage: `Authentication rejected by ${this.displayName}. Please verify your API key in Settings → Providers.`,
        statusCode: status ?? 401,
        originalError: error,
      };
    }

    if (status === 429 || /rate limit|quota/i.test(message)) {
      const isQuota = /quota|insufficient credits|balance/i.test(message);
      return {
        code: isQuota ? 'QUOTA_EXCEEDED' : 'RATE_LIMIT_EXCEEDED',
        retryable: !isQuota,
        userMessage: isQuota
          ? `Quota exceeded on your ${this.displayName} account. Please check your provider billing status.`
          : `Rate limit reached on ${this.displayName}. The request can be retried shortly.`,
        statusCode: 429,
        originalError: error,
      };
    }

    if (status === 404 || /model.*not found/i.test(message)) {
      return {
        code: 'MODEL_NOT_FOUND',
        retryable: false,
        userMessage: `Selected model is not available or not recognized by ${this.displayName}.`,
        statusCode: 404,
        originalError: error,
      };
    }

    return {
      code: 'NETWORK_ERROR',
      retryable: true,
      userMessage: `Error communicating with ${this.displayName}: ${message}`,
      statusCode: status,
      originalError: error,
    };
  }

  private clampCoordinate(val: number): number {
    if (typeof val !== 'number' || Number.isNaN(val)) return 0;
    return Math.max(-10.0, Math.min(10.0, val));
  }
}
