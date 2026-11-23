import { preprocessImage } from './preprocessing/index.ts';
import { analyzeImageWithVlm } from './vision/index.ts';
import { planGeometryFromDescription } from './planning/index.ts';
import type { PreprocessedImage, ImagePreprocessOptions } from './preprocessing/types.ts';
import type { StructuredObjectDescription, ObjectCategory } from './vision/types.ts';
import type { SceneSpec } from './planning/types.ts';

export interface PipelineExecutionOptions {
  mockMode?: boolean;
  mockCategory?: ObjectCategory;
  userInstructions?: string;
  imageOptions?: ImagePreprocessOptions;
  originalFilename?: string;
  vlmCaller?: (systemPrompt: string, userPrompt: string, imageBase64: string) => Promise<string>;
  plannerCaller?: (systemPrompt: string, userPrompt: string) => Promise<string>;
}

export interface PipelineExecutionResult {
  success: boolean;
  preprocessedImage: PreprocessedImage;
  objectDescription: StructuredObjectDescription;
  sceneSpec: SceneSpec;
  repairLogs: string[];
  durationMs: number;
}

/**
 * Executes the complete AI Image-to-3D pipeline:
 * 1. Image preprocessing (signature sniffing, decode, size limits, EXIF, safe upload)
 * 2. Vision-language analysis (structured object description, relative bounds, uncertainty flags)
 * 3. Geometry planning (validated SceneSpec with grounded Z=0, supported primitives, physical materials)
 */
export async function executeAiPipeline(
  imageBuffer: Buffer,
  options: PipelineExecutionOptions = {}
): Promise<PipelineExecutionResult> {
  const startTime = Date.now();
  const repairLogs: string[] = [];

  // Stage 1: Preprocess Image
  const preprocessedImage = preprocessImage(
    imageBuffer,
    options.originalFilename,
    options.imageOptions
  );

  // Stage 2: Vision-Language Analysis
  const visionResult = await analyzeImageWithVlm(preprocessedImage.base64DataUrl, {
    mockMode: options.mockMode ?? true,
    mockCategory: options.mockCategory,
    userInstructions: options.userInstructions,
    vlmCaller: options.vlmCaller,
  });

  if (visionResult.repaired) {
    repairLogs.push(...visionResult.repairLogs);
  }

  // Stage 3: Geometry Planning
  const planningResult = await planGeometryFromDescription(visionResult.description, {
    mockMode: options.mockMode ?? true,
    plannerCaller: options.plannerCaller,
  });

  if (planningResult.repaired) {
    repairLogs.push(...planningResult.repairLogs);
  }

  const durationMs = Date.now() - startTime;

  return {
    success: true,
    preprocessedImage,
    objectDescription: visionResult.description,
    sceneSpec: planningResult.sceneSpec,
    repairLogs,
    durationMs,
  };
}
