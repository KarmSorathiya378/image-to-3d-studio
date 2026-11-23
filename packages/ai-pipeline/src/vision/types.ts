export type ObjectCategory =
  | 'chair'
  | 'stool'
  | 'desk_lamp'
  | 'table'
  | 'mug'
  | 'box'
  | 'bottle'
  | 'shelf'
  | 'planter'
  | 'prop'
  | 'other';

export type SupportedPrimitiveType =
  | 'box'
  | 'cylinder'
  | 'sphere'
  | 'cone'
  | 'capsule'
  | 'torus'
  | 'lathe'
  | 'extrudedPolygon';

export type MaterialSemanticType =
  | 'wood'
  | 'metal'
  | 'plastic'
  | 'ceramic'
  | 'glass'
  | 'fabric'
  | 'stone'
  | 'leather'
  | 'other';

export interface SemanticComponent {
  name: string;
  semanticRole: string;
  suggestedPrimitive: SupportedPrimitiveType;
  /** Relative position [x, y, z] within bounded coordinate space [-5.0, 5.0] */
  relativePosition: [number, number, number];
  /** Relative dimension [width_x, depth_y, height_z], all positive */
  relativeSize: [number, number, number];
  /** Relative orientation in degrees [rot_x, rot_y, rot_z] */
  relativeRotationDeg?: [number, number, number];
  primaryColorHex: string;
  materialType: MaterialSemanticType;
  materialId: string;
  visibility: 'fully_visible' | 'partially_visible' | 'inferred';
}

export interface MaterialDescription {
  id: string;
  name: string;
  baseColorHex: string;
  roughness: number; // 0.0 to 1.0
  metallic: number; // 0.0 to 1.0
}

export interface CameraViewDescription {
  estimatedAzimuthDeg: number; // e.g. 35
  estimatedElevationDeg: number; // e.g. 15
  distanceEstimate: 'close' | 'medium' | 'far';
  viewAngleDescription: string;
}

export interface SymmetryDescription {
  hasSymmetry: boolean;
  type: 'bilateral' | 'radial' | 'none';
  planes: ('XY' | 'XZ' | 'YZ')[];
}

export interface ProportionsDescription {
  /** Relative width (X axis ratio) */
  widthRatio: number;
  /** Relative depth (Y axis ratio) */
  depthRatio: number;
  /** Relative height (Z axis ratio) */
  heightRatio: number;
  /** Explains relative aspect ratios without claiming exact real-world dimensions */
  relativeScaleNotes: string;
}

export interface UncertaintyFlags {
  unseenRearEstimated: boolean;
  hiddenUndersideEstimated: boolean;
  proportionsInferred: boolean;
  symmetryAssumed: boolean;
  notes: string[];
}

export interface StructuredObjectDescription {
  category: ObjectCategory;
  confidence: number; // 0.0 to 1.0
  summary: string;
  cameraView: CameraViewDescription;
  symmetry: SymmetryDescription;
  proportions: ProportionsDescription;
  components: SemanticComponent[];
  materials: MaterialDescription[];
  uncertaintyFlags: UncertaintyFlags;
}
