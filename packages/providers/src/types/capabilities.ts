/**
 * Capability taxonomy for AI models in the Image-to-3D Studio pipeline.
 */

export const ModelCapability = {
  TEXT: 'text',
  IMAGE_INPUT: 'image_input',
  VISION_ANALYSIS: 'vision_analysis',
  STRUCTURED_OUTPUT: 'structured_output',
  CODE_GENERATION: 'code_generation',
  IMAGE_GENERATION: 'image_generation',
  IMAGE_TO_3D: 'image_to_3d',
  TEXTURE_GENERATION: 'texture_generation',
} as const;

export type ModelCapabilityType = (typeof ModelCapability)[keyof typeof ModelCapability];

/**
 * Pipeline stages where model compatibility is strictly enforced.
 */
export const WorkflowStage = {
  VISION_ANALYSIS: 'vision_analysis',
  GEOMETRY_PLANNING: 'geometry_planning',
  TEXTURE_GENERATION: 'texture_generation',
  SPECIALIST_IMAGE_TO_3D: 'specialist_image_to_3d',
} as const;

export type WorkflowStageType = (typeof WorkflowStage)[keyof typeof WorkflowStage];

/**
 * Required capabilities per workflow stage.
 */
export const STAGE_CAPABILITY_REQUIREMENTS: Record<WorkflowStageType, readonly ModelCapabilityType[]> = {
  [WorkflowStage.VISION_ANALYSIS]: [ModelCapability.IMAGE_INPUT, ModelCapability.VISION_ANALYSIS],
  [WorkflowStage.GEOMETRY_PLANNING]: [ModelCapability.STRUCTURED_OUTPUT, ModelCapability.TEXT],
  [WorkflowStage.TEXTURE_GENERATION]: [ModelCapability.TEXTURE_GENERATION],
  [WorkflowStage.SPECIALIST_IMAGE_TO_3D]: [ModelCapability.IMAGE_TO_3D],
};

/**
 * Model classification and metadata.
 */
export interface ModelClassification {
  readonly id: string;
  readonly name: string;
  readonly providerId: string;
  readonly description?: string;
  readonly capabilities: readonly ModelCapabilityType[];
  readonly maxContextTokens?: number;
  readonly maxOutputTokens?: number;
  readonly supportsCustomEndpoint?: boolean;
  readonly isSpecialist?: boolean;
  readonly isDeprecated?: boolean;
  readonly costEstimateNote?: string;
}

/**
 * Capability validation result.
 */
export interface CapabilityValidationResult {
  readonly compatible: boolean;
  readonly modelId: string;
  readonly stage: WorkflowStageType;
  readonly missingCapabilities: readonly ModelCapabilityType[];
  readonly reason?: string;
}
