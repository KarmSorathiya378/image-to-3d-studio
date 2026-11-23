/**
 * Normalized SceneSpec v1 schema & ImageAnalysis contracts.
 * Matches docs/architecture.md and docs/image_to_3d_core_product_prd.md.
 */

export type ScenePrimitiveType =
  | 'box'
  | 'cylinder'
  | 'sphere'
  | 'cone'
  | 'capsule'
  | 'torus'
  | 'lathe'
  | 'extrudedPolygon';

export interface SceneReferenceView {
  readonly azimuthDeg: number;
  readonly elevationDeg: number;
  readonly estimatedDistance?: number;
}

export interface SceneMaterial {
  readonly id: string;
  readonly baseColor: string; // Hex color (e.g. "#8F684A")
  readonly roughness: number; // 0.0 - 1.0
  readonly metallic: number;  // 0.0 - 1.0
  readonly name?: string;
}

export interface ScenePart {
  readonly id: string;
  readonly type: ScenePrimitiveType;
  readonly size: readonly [number, number, number]; // [x, y, z] bounded dimensions
  readonly position: readonly [number, number, number]; // [x, y, z] relative coordinates
  readonly rotationDeg: readonly [number, number, number]; // [rx, ry, rz] Euler angles in degrees
  readonly materialId: string;
  readonly name?: string;
  readonly parentId?: string;
}

/**
 * SceneSpec v1 specification
 */
export interface SceneSpecV1 {
  readonly $schema?: string;
  readonly schemaVersion: '1.0';
  readonly objectName: string;
  readonly coordinateSystem: 'Z_UP';
  readonly units: 'relative';
  readonly referenceView: SceneReferenceView;
  readonly parts: readonly ScenePart[];
  readonly materials: readonly SceneMaterial[];
  readonly uncertaintyNotes: readonly string[];
}

/**
 * Structured Object Description from Vision Stage (VLM)
 */
export interface ImageAnalysisPartDescription {
  readonly name: string;
  readonly estimatedShape: ScenePrimitiveType | string;
  readonly relativeProportions: readonly [number, number, number];
  readonly visibleSurfaceColor: string;
  readonly estimatedMaterial: string;
  readonly confidence: number; // 0.0 - 1.0
}

export interface ImageAnalysisResult {
  readonly objectClass: string;
  readonly overallDescription: string;
  readonly referenceView: SceneReferenceView;
  readonly visibleParts: readonly ImageAnalysisPartDescription[];
  readonly estimatedDominantMaterials: readonly string[];
  readonly hiddenOrOccludedFeatures: readonly string[];
  readonly confidenceScore: number;
  readonly reasoningNotes: readonly string[];
}
