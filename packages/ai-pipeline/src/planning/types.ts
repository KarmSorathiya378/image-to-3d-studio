import type { SupportedPrimitiveType } from '../vision/types.ts';

export interface SceneReferenceView {
  azimuthDeg: number;
  elevationDeg: number;
}

export interface ScenePart {
  id: string;
  type: SupportedPrimitiveType;
  /** [width_x, depth_y, height_z] dimensions, strictly positive (0.01 to 20.0) */
  size: [number, number, number];
  /** [x, y, z] center position bounded within [-10.0, 10.0] */
  position: [number, number, number];
  /** [rx, ry, rz] Euler rotation angles in degrees */
  rotationDeg: [number, number, number];
  /** Must match a material id in the materials array */
  materialId: string;
  /** Optional hierarchical parent part ID (acyclic) */
  parentId?: string;
  /** Optional lathe 2D profile points [r, z] */
  profile?: [number, number][];
  /** Optional 2D polygon vertices [x, y] for extrudedPolygon */
  polygonPoints?: [number, number][];
}

export interface SceneMaterial {
  id: string;
  baseColor: string; // Hex color: #RRGGBB or #RRGGBBAA
  roughness: number; // 0.0 to 1.0
  metallic: number; // 0.0 to 1.0
}

export interface SceneSpec {
  $schema?: string;
  schemaVersion: '1.0';
  objectName: string;
  coordinateSystem: 'Z_UP';
  units: 'relative';
  referenceView: SceneReferenceView;
  parts: ScenePart[];
  materials: SceneMaterial[];
  uncertaintyNotes: string[];
}

export interface GeometryPlanningOptions {
  mockMode?: boolean;
  normalizeGroundPlane?: boolean; // Ensure bottom-most part sits at Z=0
  centerHorizontal?: boolean; // Center model at X=0, Y=0
  plannerCaller?: (systemPrompt: string, userPrompt: string) => Promise<string>;
}
