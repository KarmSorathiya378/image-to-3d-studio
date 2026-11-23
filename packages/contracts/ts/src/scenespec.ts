/**
 * Canonical SceneSpec TypeScript definitions (mirror of Python Pydantic v2 schema).
 */

export type CoordinateSystem = "Z_UP" | "Y_UP";
export type UnitType = "meters" | "centimeters" | "millimeters" | "relative";

export type PrimitiveType =
  | "box"
  | "cylinder"
  | "sphere"
  | "cone"
  | "plane"
  | "capsule"
  | "torus"
  | "extrudedPolygon"
  | "lathe"
  | "parameterizedCurve";

export type ModifierOp =
  | "boolean"
  | "bevel"
  | "solidify"
  | "subdivision"
  | "mirror";

export type BooleanType = "union" | "difference" | "intersection";
export type MirrorAxis = "X" | "Y" | "Z";
export type AlphaMode = "OPAQUE" | "MASK" | "BLEND";
export type LightType = "directional" | "point" | "spot" | "ambient" | "sun";
export type CurveType = "helix" | "bezier" | "line_strip";

export interface BoxParams {
  size: [number, number, number];
}

export interface CylinderParams {
  radius: number;
  height: number;
  segments?: number;
  capTop?: boolean;
  capBottom?: boolean;
}

export interface SphereParams {
  radius: number;
  segments?: number;
  ringCount?: number;
}

export interface ConeParams {
  radiusBottom: number;
  radiusTop: number;
  height: number;
  segments?: number;
  capTop?: boolean;
  capBottom?: boolean;
}

export interface PlaneParams {
  size: [number, number];
}

export interface CapsuleParams {
  radius: number;
  height: number;
  segments?: number;
}

export interface TorusParams {
  majorRadius: number;
  minorRadius: number;
  majorSegments?: number;
  minorSegments?: number;
}

export interface ExtrudedPolygonParams {
  points: [number, number][];
  depth: number;
  bevel?: number;
}

export interface LatheParams {
  profile: [number, number][];
  segments?: number;
  angleDeg?: number;
}

export interface ParameterizedCurveParams {
  curveType?: CurveType;
  controlPoints: [number, number, number][];
  radius?: number;
  segments?: number;
}

export interface MeshModifier {
  op: ModifierOp;
  booleanType?: BooleanType;
  targetPartId?: string;
  bevelWidth?: number;
  bevelSegments?: number;
  solidifyThickness?: number;
  subdivisionLevels?: number;
  mirrorAxis?: MirrorAxis;
}

export interface ScenePart {
  id: string;
  name?: string;
  type: PrimitiveType;
  parameters: Record<string, any>;
  parentId?: string;
  position?: [number, number, number];
  rotationDeg?: [number, number, number];
  scale?: [number, number, number];
  materialId?: string;
  modifiers?: MeshModifier[];
  smoothShading?: boolean;
  visible?: boolean;
}

export interface MaterialSpec {
  id: string;
  name?: string;
  baseColor: string;
  roughness: number;
  metallic: number;
  emissiveColor?: string;
  emissiveIntensity?: number;
  opacity?: number;
  alphaMode?: AlphaMode;
}

export interface CameraHint {
  position: [number, number, number];
  target: [number, number, number];
  fov?: number;
}

export interface LightSpec {
  id: string;
  type: LightType;
  position: [number, number, number];
  color: string;
  intensity: number;
}

export interface SceneMetadata {
  id?: string;
  schemaVersion: "1.0";
  objectName: string;
  description?: string;
  generator?: string;
  createdAt?: string;
}

export interface SceneSpec {
  schemaVersion: "1.0";
  metadata: SceneMetadata;
  coordinateSystem: CoordinateSystem;
  units: UnitType;
  parts: ScenePart[];
  materials?: MaterialSpec[];
  camera?: CameraHint;
  lights?: LightSpec[];
  uncertaintyNotes?: string[];
}
