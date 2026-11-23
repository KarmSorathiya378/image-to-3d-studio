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

export class GeminiAdapter extends BaseProviderAdapter {
  public readonly providerId: ProviderIdType = ProviderId.GEMINI;
  public readonly displayName = 'Google Gemini';
  public readonly officialDocumentationUrl = 'https://ai.google.dev/docs';

  private readonly defaultBaseUrl = 'https://generativelanguage.googleapis.com';

  public async testCredential(context: ResolvedProviderContext): Promise<ConnectionTestResult> {
    const start = Date.now();
    const baseUrl = (context.customBaseUrl || this.defaultBaseUrl).replace(/\/$/, '');
    const url = `${baseUrl}/v1beta/models?key=${encodeURIComponent(context.apiKey)}`;

    const response = await this.safeFetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const latencyMs = Date.now() - start;

    if (response.status === 400 || response.status === 401 || response.status === 403) {
      return {
        ok: false,
        status: 'invalid',
        message: 'Invalid Google Gemini API key.',
        isNonBillable: true,
        latencyMs,
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        status: 'error',
        message: `Gemini API test failed: ${response.status}`,
        isNonBillable: true,
        latencyMs,
      };
    }

    return {
      ok: true,
      status: 'connected',
      message: 'Successfully connected to Google Gemini API (non-billable metadata check).',
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
    const model = request.modelId.replace(/^models\//, '');
    const url = `${baseUrl}/v1beta/models/${model}:generateContent?key=${encodeURIComponent(context.apiKey)}`;

    const parts: any[] = [
      {
        text: `Analyze this image for procedural 3D reconstruction. Output strictly ImageAnalysis JSON adhering to schema:
{
  "objectClass": string,
  "overallDescription": string,
  "referenceView": { "azimuthDeg": number, "elevationDeg": number },
  "visibleParts": [{ "name": string, "estimatedShape": string, "relativeProportions": [number, number, number], "visibleSurfaceColor": string, "estimatedMaterial": string, "confidence": number }],
  "estimatedDominantMaterials": string[],
  "hiddenOrOccludedFeatures": string[],
  "confidenceScore": number,
  "reasoningNotes": string[]
}`,
      },
    ];

    if (request.image.base64Data) {
      parts.push({
        inlineData: {
          mimeType: request.image.mimeType,
          data: request.image.base64Data,
        },
      });
    }

    const response = await this.safeFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw this.normalizeError({ status: response.status, message: errText });
    }

    const json = await response.json();
    const content = json.candidates?.[0]?.content?.parts?.[0]?.text;
    return this.normalizeImageAnalysis(content);
  }

  public async invokePlanner(
    request: GeometryPlanningRequest,
    context: ResolvedProviderContext
  ): Promise<SceneSpecV1> {
    const baseUrl = (context.customBaseUrl || this.defaultBaseUrl).replace(/\/$/, '');
    const model = request.modelId.replace(/^models\//, '');
    const url = `${baseUrl}/v1beta/models/${model}:generateContent?key=${encodeURIComponent(context.apiKey)}`;

    const prompt = `You are an AI 3D geometry planner. Convert this visual analysis into SceneSpec v1 JSON:
Analysis: ${JSON.stringify(request.analysis)}
${request.userGuidance ? `Guidance: ${request.userGuidance}` : ''}
Coordinate system: Z_UP. Primitives: box, cylinder, sphere, cone, capsule, torus.`;

    const response = await this.safeFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw this.normalizeError({ status: response.status, message: errText });
    }

    const json = await response.json();
    const content = json.candidates?.[0]?.content?.parts?.[0]?.text;
    return this.normalizeSceneSpec(content, request.analysis.objectClass);
  }
}
