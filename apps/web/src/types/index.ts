export type Role = "admin" | "creator" | "viewer";

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: Role;
  createdAt: number;
}

export type GenerationStage =
  | "idle"
  | "uploading"
  | "analyzing"
  | "planning"
  | "building"
  | "validating"
  | "succeeded"
  | "failed";

export interface BoundingBox {
  width: number;
  height: number;
  depth: number;
}

export interface ModelMaterial {
  id: string;
  name: string;
  baseColor: string;
  roughness: number;
  metallic: number;
}

export interface ModelPart {
  id: string;
  name: string;
  type: "box" | "cylinder" | "sphere" | "torus" | "cone";
  size: [number, number, number];
  position: [number, number, number];
  rotationDeg: [number, number, number];
  materialId: string;
}

export interface SceneSpec {
  schemaVersion: string;
  objectName: string;
  coordinateSystem: "Z_UP" | "Y_UP";
  units: "relative" | "meters";
  referenceView: {
    azimuthDeg: number;
    elevationDeg: number;
  };
  parts: ModelPart[];
  materials: ModelMaterial[];
  uncertaintyNotes?: string[];
}

export interface ModelAsset {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  format: "glb" | "gltf" | "obj" | "stl";
  status: "ready" | "processing" | "failed";
  triangles: number;
  vertices: number;
  dimensions: BoundingBox;
  sizeBytes: number;
  thumbnailUrl?: string;
  glbUrl?: string;
  sourceImageUrl?: string;
  sceneSpec?: SceneSpec;
  createdAt: number;
  version: number;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  modelsCount: number;
  thumbnailUrl?: string;
  activeModelId?: string;
}

export type ProviderId =
  | "openai"
  | "groq"
  | "inception"
  | "gemini"
  | "anthropic"
  | "custom";

export type Capability =
  | "vision"
  | "text"
  | "structuredOutput"
  | "codeGeneration"
  | "imageTo3D";

export interface AIModel {
  id: string;
  name: string;
  description: string;
  capabilities: Capability[];
  contextTokens?: number;
}

export interface AIProvider {
  id: ProviderId;
  displayName: string;
  officialDocUrl: string;
  supportedCapabilities: Capability[];
  models: AIModel[];
  status: "verified" | "untested" | "invalid" | "unconfigured";
  apiKeyMasked?: string;
  nickname?: string;
  isDefaultVision?: boolean;
  isDefaultPlanner?: boolean;
  latencyMs?: number;
}

export interface GenerationConfig {
  visionProvider: ProviderId;
  visionModel: string;
  plannerProvider: ProviderId;
  plannerModel: string;
  promptNotes?: string;
  detailLevel: "simple" | "standard" | "high";
  coordinateSystem: "Z_UP" | "Y_UP";
}

export interface GenerationJob {
  id: string;
  projectId: string;
  status: GenerationStage;
  progressPercent: number;
  stageMessage: string;
  sourceImageName: string;
  sourceImagePreview?: string;
  config: GenerationConfig;
  logs: { timestamp: number; message: string; stage: GenerationStage }[];
  error?: string;
  resultModelId?: string;
  createdAt: number;
  completedAt?: number;
}

export type LightingPreset = "studio" | "outdoor" | "cyberpunk" | "softWarm";

export interface ViewerSettings {
  wireframe: boolean;
  showGrid: boolean;
  autoRotate: boolean;
  autoRotateSpeed: number;
  lightingPreset: LightingPreset;
  exposure: number;
  cameraFov: number;
  backgroundColor: string;
}
