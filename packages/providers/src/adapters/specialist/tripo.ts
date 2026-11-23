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
 * Specialist Generative 3D Provider Adapter for Tripo 3D.
 * Gated behind capability flag `isSpecialist3D: true`.
 */
export class TripoAdapter extends BaseProviderAdapter {
  public readonly providerId: ProviderIdType = ProviderId.TRIPO;
  public readonly displayName = 'Tripo 3D';
  public readonly officialDocumentationUrl = 'https://platform.tripo3d.ai/docs';
  public override readonly isSpecialist3D = true;

  private readonly defaultBaseUrl = 'https://api.tripo3d.ai/v2/openapi';

  public async testCredential(context: ResolvedProviderContext): Promise<ConnectionTestResult> {
    const start = Date.now();
    const baseUrl = (context.customBaseUrl || this.defaultBaseUrl).replace(/\/$/, '');
    const url = `${baseUrl}/user/balance`;

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
        message: 'Invalid Tripo 3D API key.',
        isNonBillable: true,
        latencyMs,
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        status: 'error',
        message: `Tripo connectivity check failed: ${response.status}`,
        isNonBillable: true,
        latencyMs,
      };
    }

    return {
      ok: true,
      status: 'connected',
      message: 'Successfully authenticated with Tripo 3D (non-billable balance check).',
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
      userMessage: 'Tripo is a specialist 3D provider and does not support standalone VLM vision analysis.',
    });
  }

  public async invokePlanner(
    _request: GeometryPlanningRequest,
    _context: ResolvedProviderContext
  ): Promise<SceneSpecV1> {
    throw new ProviderError({
      code: 'FEATURE_NOT_SUPPORTED',
      retryable: false,
      userMessage: 'Tripo is a specialist 3D provider and does not support SceneSpec procedural planning.',
    });
  }

  public override async submitSpecialist3D(
    request: Specialist3DRequest,
    context: ResolvedProviderContext
  ): Promise<Specialist3DTask> {
    const baseUrl = (context.customBaseUrl || this.defaultBaseUrl).replace(/\/$/, '');
    const url = `${baseUrl}/task`;

    const payload: any = {
      type: 'image_to_model',
      file: {
        type: request.image.mimeType.includes('png') ? 'png' : 'jpg',
        data: request.image.base64Data,
        url: request.image.imageUrl,
      },
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
      taskId: data.data?.task_id || data.task_id || 'tripo_task',
      status: 'pending',
      progress: 0,
    };
  }

  public override async pollSpecialist3D(
    taskId: string,
    context: ResolvedProviderContext
  ): Promise<Specialist3DTask> {
    const baseUrl = (context.customBaseUrl || this.defaultBaseUrl).replace(/\/$/, '');
    const url = `${baseUrl}/task/${taskId}`;

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

    const json = await response.json();
    const task = json.data || json;

    const rawStatus = task.status;
    let status: Specialist3DTask['status'] = 'processing';
    if (rawStatus === 'success') status = 'succeeded';
    else if (rawStatus === 'failed') status = 'failed';
    else if (rawStatus === 'queued') status = 'pending';

    return {
      taskId,
      status,
      modelUrl: task.output?.model || task.result?.model,
      progress: task.progress ?? (status === 'succeeded' ? 100 : 50),
      errorMessage: task.error,
    };
  }
}
