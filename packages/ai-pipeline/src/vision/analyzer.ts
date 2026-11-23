import { validateStructuredObjectDescription } from './schemas.ts';
import { getMockObjectDescription } from './mock-analyzer.ts';
import { VLM_SYSTEM_PROMPT, buildVlmUserPrompt } from './prompts.ts';
import { repairModelJsonResponse } from '../repair/json-repair.ts';
import { repairStructuredDescription } from '../repair/response-repairer.ts';
import type { StructuredObjectDescription, ObjectCategory } from './types.ts';

export interface VlmInvokeOptions {
  mockMode?: boolean;
  mockCategory?: ObjectCategory;
  userInstructions?: string;
  /** Function to invoke external VLM endpoint if not in mock mode */
  vlmCaller?: (systemPrompt: string, userPrompt: string, imageBase64: string) => Promise<string>;
}

export interface VisionAnalysisResult {
  description: StructuredObjectDescription;
  rawResponse?: string;
  repaired: boolean;
  repairLogs: string[];
}

/**
 * Analyzes an image with a VLM (or deterministic mock) and returns a validated StructuredObjectDescription.
 */
export async function analyzeImageWithVlm(
  imageBase64DataUrl: string,
  options: VlmInvokeOptions = {}
): Promise<VisionAnalysisResult> {
  const repairLogs: string[] = [];

  // Mock mode: return deterministic fixture immediately
  if (options.mockMode || !options.vlmCaller) {
    const mock = getMockObjectDescription(options.mockCategory ?? 'stool');
    return {
      description: mock,
      repaired: false,
      repairLogs: ['Mock analyzer used for deterministic offline execution'],
    };
  }

  const systemPrompt = VLM_SYSTEM_PROMPT;
  const userPrompt = buildVlmUserPrompt({ userInstructions: options.userInstructions });

  const rawOutput = await options.vlmCaller(systemPrompt, userPrompt, imageBase64DataUrl);

  // Parse and repair raw output
  const jsonResult = repairModelJsonResponse(rawOutput);
  if (jsonResult.repaired) {
    repairLogs.push(...jsonResult.repairActions);
  }

  // Domain repair and clamping
  const domainRepair = repairStructuredDescription(jsonResult.parsed);
  if (domainRepair.repaired) {
    repairLogs.push(...domainRepair.repairActions);
  }

  // Strict validation
  const validated = validateStructuredObjectDescription(domainRepair.data);

  return {
    description: validated,
    rawResponse: rawOutput,
    repaired: repairLogs.length > 0,
    repairLogs,
  };
}
