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

export class GroqAdapter extends BaseProviderAdapter {
  public readonly providerId: ProviderIdType = ProviderId.GROQ;
  public readonly displayName = 'Groq';
  public readonly officialDocumentationUrl = 'https://console.groq.com/docs';

  private readonly defaultBaseUrl = 'https://api.groq.com/openai/v1';

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
        message: 'Invalid Groq API key.',
        isNonBillable: true,
        latencyMs,
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        status: 'error',
        message: `Groq connectivity check failed: ${response.status}`,
        isNonBillable: true,
        latencyMs,
      };
    }

    return {
      ok: true,
      status: 'connected',
      message: 'Successfully verified Groq API key (non-billable metadata check).',
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

    const prompt = `Analyze this image for procedural 3D reconstruction. Output strictly a JSON object with:
{
  "objectClass": string,
  "overallDescription": string,
  "referenceView": { "azimuthDeg": 30.0, "elevationDeg": 15.0 },
  "visibleParts": [{ "name": string, "estimatedShape": "cylinder" | "box" | "sphere", "relativeProportions": [1, 1, 1], "visibleSurfaceColor": "#8F684A", "estimatedMaterial": "wood", "confidence": 0.9 }],
  "estimatedDominantMaterials": ["wood"],
  "hiddenOrOccludedFeatures": ["underside"],
  "confidenceScore": 0.85,
  "reasoningNotes": []
}`;

    const response = await this.safeFetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${context.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.modelId,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      throw await this.handleErrorResponse(response);
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

    const prompt = `Convert this visual analysis into SceneSpec v1 JSON:
Analysis: ${JSON.stringify(request.analysis)}
${request.userGuidance ? `Hint: ${request.userGuidance}` : ''}
Output valid SceneSpec v1 JSON only.`;

    const response = await this.safeFetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${context.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.modelId,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You are an AI 3D planner emitting SceneSpec v1 JSON. CoordinateSystem: Z_UP.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      throw await this.handleErrorResponse(response);
    }

    const json = await response.json();
    const content = json.choices?.[0]?.message?.content;
    return this.normalizeSceneSpec(content, request.analysis.objectClass);
  }

  private async handleErrorResponse(response: Response): Promise<Error> {
    const text = await response.text();
    return this.normalizeError({
      status: response.status,
      message: text,
    });
  }
}
