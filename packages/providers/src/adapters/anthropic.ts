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

export class AnthropicAdapter extends BaseProviderAdapter {
  public readonly providerId: ProviderIdType = ProviderId.ANTHROPIC;
  public readonly displayName = 'Anthropic (Claude)';
  public readonly officialDocumentationUrl = 'https://docs.anthropic.com';

  private readonly defaultBaseUrl = 'https://api.anthropic.com/v1';

  public async testCredential(context: ResolvedProviderContext): Promise<ConnectionTestResult> {
    const start = Date.now();
    const baseUrl = (context.customBaseUrl || this.defaultBaseUrl).replace(/\/$/, '');
    const url = `${baseUrl}/models`;

    const response = await this.safeFetch(url, {
      method: 'GET',
      headers: {
        'x-api-key': context.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
    });

    const latencyMs = Date.now() - start;

    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        status: 'invalid',
        message: 'Invalid Anthropic API key.',
        isNonBillable: true,
        latencyMs,
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        status: 'error',
        message: `Anthropic test failed with HTTP ${response.status}`,
        isNonBillable: true,
        latencyMs,
      };
    }

    return {
      ok: true,
      status: 'connected',
      message: 'Successfully authenticated with Anthropic API (non-billable metadata check).',
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
    const url = `${baseUrl}/messages`;

    const content: any[] = [];
    if (request.image.base64Data) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: request.image.mimeType,
          data: request.image.base64Data,
        },
      });
    }

    content.push({
      type: 'text',
      text: `Analyze this image for 3D reconstruction and output strictly valid JSON matching ImageAnalysis schema.`,
    });

    const response = await this.safeFetch(url, {
      method: 'POST',
      headers: {
        'x-api-key': context.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.modelId,
        max_tokens: 2048,
        messages: [{ role: 'user', content }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw this.normalizeError({ status: response.status, message: errText });
    }

    const json = await response.json();
    const textOutput = json.content?.[0]?.text;
    return this.normalizeImageAnalysis(textOutput);
  }

  public async invokePlanner(
    request: GeometryPlanningRequest,
    context: ResolvedProviderContext
  ): Promise<SceneSpecV1> {
    const baseUrl = (context.customBaseUrl || this.defaultBaseUrl).replace(/\/$/, '');
    const url = `${baseUrl}/messages`;

    const prompt = `Convert this visual analysis into SceneSpec v1 JSON:
Analysis: ${JSON.stringify(request.analysis)}
${request.userGuidance ? `Hint: ${request.userGuidance}` : ''}
Output SceneSpec v1 JSON only.`;

    const response = await this.safeFetch(url, {
      method: 'POST',
      headers: {
        'x-api-key': context.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.modelId,
        max_tokens: 4096,
        system: 'You are an AI 3D spatial planner emitting valid SceneSpec v1 JSON. CoordinateSystem: Z_UP.',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw this.normalizeError({ status: response.status, message: errText });
    }

    const json = await response.json();
    const textOutput = json.content?.[0]?.text;
    return this.normalizeSceneSpec(textOutput, request.analysis.objectClass);
  }
}
