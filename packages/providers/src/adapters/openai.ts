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

export class OpenAIAdapter extends BaseProviderAdapter {
  public readonly providerId: ProviderIdType = ProviderId.OPENAI;
  public readonly displayName = 'OpenAI';
  public readonly officialDocumentationUrl = 'https://platform.openai.com/docs';

  private readonly defaultBaseUrl = 'https://api.openai.com/v1';

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
        message: 'Invalid OpenAI API key. Authentication failed.',
        isNonBillable: true,
        latencyMs,
      };
    }

    if (!response.ok) {
      const errText = await response.text();
      return {
        ok: false,
        status: 'error',
        message: `OpenAI connection test failed: ${response.status} ${errText}`,
        isNonBillable: true,
        latencyMs,
      };
    }

    return {
      ok: true,
      status: 'connected',
      message: 'Successfully authenticated with OpenAI API (non-billable metadata check).',
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

    const prompt = `Analyze this image for 3D reconstruction. Deconstruct the visible object into geometric components, estimated dimensions, visible colors, and reference camera view. Return strictly a JSON object adhering to this schema:
{
  "objectClass": string,
  "overallDescription": string,
  "referenceView": { "azimuthDeg": number, "elevationDeg": number },
  "visibleParts": [
    {
      "name": string,
      "estimatedShape": "box" | "cylinder" | "sphere" | "cone" | "capsule" | "torus",
      "relativeProportions": [number, number, number],
      "visibleSurfaceColor": string,
      "estimatedMaterial": string,
      "confidence": number
    }
  ],
  "estimatedDominantMaterials": string[],
  "hiddenOrOccludedFeatures": string[],
  "confidenceScore": number,
  "reasoningNotes": string[]
}
${request.userPrompt ? `Additional user hint: "${request.userPrompt}"` : ''}`;

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
            content: 'You are an expert 3D computer vision analyst for procedural 3D reconstruction. Always output valid JSON.',
          },
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

    const systemPrompt = `You are an AI 3D geometry planner. You convert structured visual analysis into a valid SceneSpec v1 schema.
Rules:
- Coordinate system is strictly Z_UP.
- Supported primitives: "box", "cylinder", "sphere", "cone", "capsule", "torus", "lathe", "extrudedPolygon".
- Maximum 64 parts. Coordinates bounded within [-10.0, 10.0].
- Output valid JSON only.`;

    const userPrompt = `Generate a SceneSpec v1 specification for:
Object: ${request.analysis.objectClass}
Visual Analysis: ${JSON.stringify(request.analysis)}
${request.userGuidance ? `User guidance: ${request.userGuidance}` : ''}`;

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
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
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
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { message: text };
    }

    return this.normalizeError({
      status: response.status,
      message: parsed.error?.message || parsed.message || text,
    });
  }
}
