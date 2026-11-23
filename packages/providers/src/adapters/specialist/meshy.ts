import { defaultCapabilityRegistry } from '../../registry/index.ts';
import type { ModelClassification } from '../../types/capabilities.ts';
import { ProviderError } from '../../types/errors.ts';
import {
  type ConnectionTestResult,
  type GeometryPlanningRequest,
  type ProviderIdType,
  ProviderId,
  type ResolvedProviderContext,
  type Specialist3DRequest,
  type Specialist3DTask,
  type VisionAnalysisRequest,
} from '../../types/providers.ts';
import type { ImageAnalysisResult, SceneSpecV1 } from '../../types/scene-spec.ts';
import { BaseProviderAdapter } from '../base.ts';

/**
 * Specialist Generative 3D Provider Adapter for Meshy.
 * Gated behind capability flag `isSpecialist3D: true`.
 */
export class MeshyAdapter extends BaseProviderAdapter {
  public readonly providerId: ProviderIdType = ProviderId.MESHY;
  public readonly displayName = 'Meshy';
  public readonly officialDocumentationUrl = 'https://docs.meshy.ai';
  public override readonly isSpecialist3D = true;

  private readonly defaultBaseUrl = 'https://api.meshy.ai/v1';

  public async testCredential(context: ResolvedProviderContext): Promise<ConnectionTestResult> {
    const start = Date.now();
    const baseUrl = (context.customBaseUrl || this.defaultBaseUrl).replace(/\/$/, '');
    const url = `${baseUrl}/user/info`;

    const response = await this.safeFetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${context.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    const latencyMs = Date.now() - start;

    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        status: 'invalid',
        message: 'Invalid Meshy API key.',
        isNonBillable: true,
        latencyMs,
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        status: 'error',
        message: `Meshy connection test failed with HTTP ${response.status}`,
        isNonBillable: true,
        latencyMs,
      };
    }

    return {
      ok: true,
      status: 'connected',
      message: 'Successfully verified Meshy API key (non-billable user check).',
      isNonBillable: true,
      latencyMs,
    };
  }

  public async listModels(_context: ResolvedProviderContext): Promise<readonly ModelClassification[]> {
    return defaultCapabilityRegistry.listModelsByProvider(this.providerId, { includeSpecialists: true });
  }

  public async invokeVision(
    _request: VisionAnalysisRequest,
    _context: ResolvedProviderContext
  ): Promise<ImageAnalysisResult> {
    throw new ProviderError({
      code: 'FEATURE_NOT_SUPPORTED',
      retryable: false,
      userMessage: 'Meshy is a specialist 3D provider and does not support standalone vision analysis.',
    });
  }

  public async invokePlanner(
    _request: GeometryPlanningRequest,
    _context: ResolvedProviderContext
  ): Promise<SceneSpecV1> {
    throw new ProviderError({
      code: 'FEATURE_NOT_SUPPORTED',
      retryable: false,
      userMessage: 'Meshy is a specialist 3D provider and does not support SceneSpec procedural planning.',
    });
  }

  public override async submitSpecialist3D(
    request: Specialist3DRequest,
    context: ResolvedProviderContext
  ): Promise<Specialist3DTask> {
    const baseUrl = (context.customBaseUrl || this.defaultBaseUrl).replace(/\/$/, '');
    const url = `${baseUrl}/image-to-3d`;

    const payload = {
      image_url: request.image.imageUrl || `data:${request.image.mimeType};base64,${request.image.base64Data}`,
      enable_pbr: true,
    };

    const response = await this.safeFetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${context.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      throw this.normalizeError({ status: response.status, message: text });
    }

    const data = await response.json();
    return {
      taskId: data.result || data.id || 'meshy_task',
      status: 'pending',
      progress: 0,
    };
  }

  public override async pollSpecialist3D(
    taskId: string,
    context: ResolvedProviderContext
  ): Promise<Specialist3DTask> {
    const baseUrl = (context.customBaseUrl || this.defaultBaseUrl).replace(/\/$/, '');
    const url = `${baseUrl}/image-to-3d/${taskId}`;

    const response = await this.safeFetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${context.apiKey}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw this.normalizeError({ status: response.status, message: text });
    }

    const task = await response.json();
    let status: Specialist3DTask['status'] = 'processing';
    if (task.status === 'SUCCEEDED') status = 'succeeded';
    else if (task.status === 'FAILED') status = 'failed';
    else if (task.status === 'PENDING') status = 'pending';

    return {
      taskId,
      status,
      modelUrl: task.model_urls?.glb,
      progress: task.progress ?? (status === 'succeeded' ? 100 : 50),
      errorMessage: task.task_error?.message,
    };
  }
}
