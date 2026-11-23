import { defaultCapabilityRegistry } from '../registry/index.ts';
import type { ModelClassification } from '../types/capabilities.ts';
import {
  type ConnectionTestResult,
  type GeometryPlanningRequest,
  type ProviderIdType,
  ProviderId,
  type ResolvedProviderContext,
  type VisionAnalysisRequest,
} from '../types/providers.ts';
import type { ImageAnalysisResult, SceneSpecV1 } from '../types/scene-spec.ts';
import { BaseProviderAdapter } from './base.ts';

export class InceptionAdapter extends BaseProviderAdapter {
  public readonly providerId: ProviderIdType = ProviderId.INCEPTION;
  public readonly displayName = 'Inception Labs (Mercury)';
  public readonly officialDocumentationUrl = 'https://docs.inceptionlabs.ai';

  private readonly defaultBaseUrl = 'https://api.inceptionlabs.ai/v1';

  public async testCredential(context: ResolvedProviderContext): Promise<ConnectionTestResult> {
    const start = Date.now();
    const baseUrl = (context.customBaseUrl || this.defaultBaseUrl).replace(/\/$/, '');
    const url = `${baseUrl}/models`;

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
        message: 'Invalid Inception Labs (Mercury) API key.',
        isNonBillable: true,
        latencyMs,
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        status: 'error',
        message: `Inception API test failed with status: ${response.status}`,
        isNonBillable: true,
        latencyMs,
      };
    }

    return {
      ok: true,
      status: 'connected',
      message: 'Successfully connected to Inception Labs API (non-billable metadata check).',
      isNonBillable: true,
      latencyMs,
    };
  }

  public async listModels(_context: ResolvedProviderContext): Promise<readonly ModelClassification[]> {
    return defaultCapabilityRegistry.listModelsByProvider(this.providerId);
  }

  public async invokeVision(
    request: VisionAnalysisRequest,
    context: ResolvedProviderContext
  ): Promise<ImageAnalysisResult> {
    const baseUrl = (context.customBaseUrl || this.defaultBaseUrl).replace(/\/$/, '');
    const url = `${baseUrl}/chat/completions`;

    const imageUrl = request.image.imageUrl
      ? request.image.imageUrl
      : `data:${request.image.mimeType};base64,${request.image.base64Data}`;

    const prompt = `Analyze this image for 3D procedural reconstruction and emit ImageAnalysis JSON.`;

    const response = await this.safeFetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${context.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.modelId,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw this.normalizeError({ status: response.status, message: errText });
    }

    const json = await response.json();
    const content = json.choices?.[0]?.message?.content;
    return this.normalizeImageAnalysis(content);
  }

  public async invokePlanner(
    request: GeometryPlanningRequest,
    context: ResolvedProviderContext
  ): Promise<SceneSpecV1> {
    const baseUrl = (context.customBaseUrl || this.defaultBaseUrl).replace(/\/$/, '');
    const url = `${baseUrl}/chat/completions`;

    const prompt = `Generate a valid SceneSpec v1 JSON specification from this analysis:
${JSON.stringify(request.analysis)}
${request.userGuidance ? `User guidance: ${request.userGuidance}` : ''}`;

    const response = await this.safeFetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${context.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.modelId,
        messages: [
          {
            role: 'system',
            content: 'You are the Mercury geometry reasoning engine. Convert descriptions to SceneSpec v1 JSON.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw this.normalizeError({ status: response.status, message: errText });
    }

    const json = await response.json();
    const content = json.choices?.[0]?.message?.content;
    return this.normalizeSceneSpec(content, request.analysis.objectClass);
  }
}
