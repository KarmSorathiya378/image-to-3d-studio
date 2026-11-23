import { MalformedModelOutputError } from '../errors/pipeline-errors.ts';
import type {
  StructuredObjectDescription,
  SupportedPrimitiveType,
  MaterialSemanticType,
  ObjectCategory,
} from './types.ts';

export const VALID_PRIMITIVES: readonly SupportedPrimitiveType[] = [
  'box',
  'cylinder',
  'sphere',
  'cone',
  'capsule',
  'torus',
  'lathe',
  'extrudedPolygon',
] as const;

export const VALID_MATERIAL_TYPES: readonly MaterialSemanticType[] = [
  'wood',
  'metal',
  'plastic',
  'ceramic',
  'glass',
  'fabric',
  'stone',
  'leather',
  'other',
] as const;

/**
 * Validates a StructuredObjectDescription strictly against schema requirements.
 */
export function validateStructuredObjectDescription(data: unknown): StructuredObjectDescription {
  if (!data || typeof data !== 'object') {
    throw new MalformedModelOutputError('StructuredObjectDescription must be a non-null object');
  }

  const obj = data as Record<string, unknown>;

  if (typeof obj.category !== 'string' || obj.category.trim() === '') {
    throw new MalformedModelOutputError('Missing or invalid "category" field');
  }

  const confidence = typeof obj.confidence === 'number' ? obj.confidence : 0.8;
  if (confidence < 0 || confidence > 1) {
    throw new MalformedModelOutputError('"confidence" must be between 0.0 and 1.0');
  }

  if (typeof obj.summary !== 'string') {
    throw new MalformedModelOutputError('Missing or invalid "summary" string');
  }

  // Validate cameraView
  if (!obj.cameraView || typeof obj.cameraView !== 'object') {
    throw new MalformedModelOutputError('Missing or invalid "cameraView" object');
  }
  const cv = obj.cameraView as Record<string, unknown>;
  const azimuth = typeof cv.estimatedAzimuthDeg === 'number' ? cv.estimatedAzimuthDeg : 35;
  const elevation = typeof cv.estimatedElevationDeg === 'number' ? cv.estimatedElevationDeg : 15;
  const distance = typeof cv.distanceEstimate === 'string' && ['close', 'medium', 'far'].includes(cv.distanceEstimate)
    ? cv.distanceEstimate as 'close' | 'medium' | 'far'
    : 'medium';

  // Validate proportions
  if (!obj.proportions || typeof obj.proportions !== 'object') {
    throw new MalformedModelOutputError('Missing or invalid "proportions" object');
  }
  const p = obj.proportions as Record<string, unknown>;
  const widthRatio = typeof p.widthRatio === 'number' && p.widthRatio > 0 ? p.widthRatio : 1.0;
  const depthRatio = typeof p.depthRatio === 'number' && p.depthRatio > 0 ? p.depthRatio : 1.0;
  const heightRatio = typeof p.heightRatio === 'number' && p.heightRatio > 0 ? p.heightRatio : 1.0;

  // Validate symmetry
  const sym = (obj.symmetry && typeof obj.symmetry === 'object') ? (obj.symmetry as Record<string, unknown>) : {};
  const hasSymmetry = typeof sym.hasSymmetry === 'boolean' ? sym.hasSymmetry : true;
  const symType = typeof sym.type === 'string' && ['bilateral', 'radial', 'none'].includes(sym.type)
    ? sym.type as 'bilateral' | 'radial' | 'none'
    : 'bilateral';
  const symPlanes = Array.isArray(sym.planes)
    ? (sym.planes as ('XY' | 'XZ' | 'YZ')[]).filter((pl) => ['XY', 'XZ', 'YZ'].includes(pl))
    : (['YZ'] as ('XY' | 'XZ' | 'YZ')[]);

  // Validate components
  if (!Array.isArray(obj.components) || obj.components.length === 0) {
    throw new MalformedModelOutputError('"components" must be a non-empty array of semantic parts');
  }

  const components = obj.components.map((c, idx) => {
    if (!c || typeof c !== 'object') {
      throw new MalformedModelOutputError(`Component at index ${idx} is not an object`);
    }
    const comp = c as Record<string, unknown>;
    const name = typeof comp.name === 'string' && comp.name.trim() !== '' ? comp.name : `part_${idx + 1}`;
    const semanticRole = typeof comp.semanticRole === 'string' ? comp.semanticRole : name;

    const prim = typeof comp.suggestedPrimitive === 'string' && VALID_PRIMITIVES.includes(comp.suggestedPrimitive as SupportedPrimitiveType)
      ? comp.suggestedPrimitive as SupportedPrimitiveType
      : 'box';

    const pos = Array.isArray(comp.relativePosition) && comp.relativePosition.length === 3
      ? [Number(comp.relativePosition[0]) || 0, Number(comp.relativePosition[1]) || 0, Number(comp.relativePosition[2]) || 0] as [number, number, number]
      : [0, 0, 0] as [number, number, number];

    const size = Array.isArray(comp.relativeSize) && comp.relativeSize.length === 3
      ? [Math.max(0.01, Number(comp.relativeSize[0]) || 1), Math.max(0.01, Number(comp.relativeSize[1]) || 1), Math.max(0.01, Number(comp.relativeSize[2]) || 1)] as [number, number, number]
      : [1, 1, 1] as [number, number, number];

    const rot = Array.isArray(comp.relativeRotationDeg) && comp.relativeRotationDeg.length === 3
      ? [Number(comp.relativeRotationDeg[0]) || 0, Number(comp.relativeRotationDeg[1]) || 0, Number(comp.relativeRotationDeg[2]) || 0] as [number, number, number]
      : [0, 0, 0] as [number, number, number];

    const rawColor = typeof comp.primaryColorHex === 'string' ? comp.primaryColorHex : '#888888';
    const primaryColorHex = normalizeHexColor(rawColor);

    const matType = typeof comp.materialType === 'string' && VALID_MATERIAL_TYPES.includes(comp.materialType as MaterialSemanticType)
      ? comp.materialType as MaterialSemanticType
      : 'wood';

    const materialId = typeof comp.materialId === 'string' && comp.materialId.trim() !== ''
      ? comp.materialId
      : `mat_${matType}`;

    const visibility = typeof comp.visibility === 'string' && ['fully_visible', 'partially_visible', 'inferred'].includes(comp.visibility)
      ? comp.visibility as 'fully_visible' | 'partially_visible' | 'inferred'
      : 'inferred';

    return {
      name,
      semanticRole,
      suggestedPrimitive: prim,
      relativePosition: pos,
      relativeSize: size,
      relativeRotationDeg: rot,
      primaryColorHex,
      materialType: matType,
      materialId,
      visibility,
    };
  });

  // Validate materials
  let materials = Array.isArray(obj.materials)
    ? obj.materials.map((m, idx) => {
        const mat = (m && typeof m === 'object') ? (m as Record<string, unknown>) : {};
        const id = typeof mat.id === 'string' && mat.id.trim() !== '' ? mat.id : `mat_${idx + 1}`;
        const name = typeof mat.name === 'string' ? mat.name : id;
        const baseColorHex = normalizeHexColor(typeof mat.baseColorHex === 'string' ? mat.baseColorHex : '#888888');
        const roughness = typeof mat.roughness === 'number' ? Math.max(0, Math.min(1, mat.roughness)) : 0.7;
        const metallic = typeof mat.metallic === 'number' ? Math.max(0, Math.min(1, mat.metallic)) : 0.0;
        return { id, name, baseColorHex, roughness, metallic };
      })
    : [];

  // Ensure all component materialIds exist in materials list
  const materialIds = new Set(materials.map((m) => m.id));
  for (const c of components) {
    if (!materialIds.has(c.materialId)) {
      materials.push({
        id: c.materialId,
        name: c.materialType,
        baseColorHex: c.primaryColorHex,
        roughness: c.materialType === 'metal' ? 0.3 : 0.7,
        metallic: c.materialType === 'metal' ? 0.9 : 0.0,
      });
      materialIds.add(c.materialId);
    }
  }

  // Validate uncertaintyFlags
  const uf = (obj.uncertaintyFlags && typeof obj.uncertaintyFlags === 'object')
    ? (obj.uncertaintyFlags as Record<string, unknown>)
    : {};
  const uncertaintyNotes = Array.isArray(uf.notes)
    ? uf.notes.filter((n): n is string => typeof n === 'string')
    : ['Single-image reconstruction; hidden surfaces and exact metric dimensions are inferred.'];

  const uncertaintyFlags = {
    unseenRearEstimated: typeof uf.unseenRearEstimated === 'boolean' ? uf.unseenRearEstimated : true,
    hiddenUndersideEstimated: typeof uf.hiddenUndersideEstimated === 'boolean' ? uf.hiddenUndersideEstimated : true,
    proportionsInferred: typeof uf.proportionsInferred === 'boolean' ? uf.proportionsInferred : true,
    symmetryAssumed: typeof uf.symmetryAssumed === 'boolean' ? uf.symmetryAssumed : true,
    notes: uncertaintyNotes,
  };

  return {
    category: obj.category as ObjectCategory,
    confidence,
    summary: obj.summary,
    cameraView: {
      estimatedAzimuthDeg: azimuth,
      estimatedElevationDeg: elevation,
      distanceEstimate: distance,
      viewAngleDescription: typeof cv.viewAngleDescription === 'string' ? cv.viewAngleDescription : 'Isometric perspective view',
    },
    symmetry: {
      hasSymmetry,
      type: symType,
      planes: symPlanes,
    },
    proportions: {
      widthRatio,
      depthRatio,
      heightRatio,
      relativeScaleNotes: typeof p.relativeScaleNotes === 'string'
        ? p.relativeScaleNotes
        : 'Normalized relative dimensions; real-world metric dimensions cannot be measured from a single photo without calibration fiducials.',
    },
    components,
    materials,
    uncertaintyFlags,
  };
}

export function normalizeHexColor(hex: string): string {
  if (!hex || typeof hex !== 'string') return '#808080';
  let clean = hex.trim();
  if (!clean.startsWith('#')) clean = `#${clean}`;
  if (/^#[0-9a-fA-F]{6}$/.test(clean)) return clean.toUpperCase();
  if (/^#[0-9a-fA-F]{3}$/.test(clean)) {
    const r = clean[1];
    const g = clean[2];
    const b = clean[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return '#808080';
}
