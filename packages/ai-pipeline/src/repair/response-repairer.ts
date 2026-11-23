import { normalizeHexColor, VALID_PRIMITIVES, VALID_MATERIAL_TYPES } from '../vision/schemas.ts';
import type { StructuredObjectDescription, SupportedPrimitiveType, MaterialSemanticType } from '../vision/types.ts';
import type { DomainRepairResult } from './types.ts';

/**
 * Domain-specific repair for StructuredObjectDescription.
 * Normalizes invalid primitive types, clamps out-of-range coordinates,
 * supplies missing materials, and ensures strict invariants.
 */
export function repairStructuredDescription(raw: unknown): DomainRepairResult<StructuredObjectDescription> {
  const actions: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return {
      data: {
        category: 'prop',
        confidence: 0.5,
        summary: 'Repaired empty object description',
        cameraView: { estimatedAzimuthDeg: 35, estimatedElevationDeg: 15, distanceEstimate: 'medium', viewAngleDescription: 'Standard perspective' },
        symmetry: { hasSymmetry: false, type: 'none', planes: [] },
        proportions: { widthRatio: 1, depthRatio: 1, heightRatio: 1, relativeScaleNotes: 'Default unit scale' },
        components: [
          {
            name: 'main_body',
            semanticRole: 'primary form',
            suggestedPrimitive: 'box',
            relativePosition: [0, 0, 0.5],
            relativeSize: [1, 1, 1],
            primaryColorHex: '#808080',
            materialType: 'other',
            materialId: 'mat_default',
            visibility: 'inferred',
          },
        ],
        materials: [{ id: 'mat_default', name: 'Default', baseColorHex: '#808080', roughness: 0.7, metallic: 0.0 }],
        uncertaintyFlags: { unseenRearEstimated: true, hiddenUndersideEstimated: true, proportionsInferred: true, symmetryAssumed: false, notes: ['Fully synthesized fallback'] },
      },
      repaired: true,
      repairActions: ['Synthesized default StructuredObjectDescription for non-object payload'],
    };
  }

  const data = JSON.parse(JSON.stringify(raw)) as Record<string, unknown>;

  // Repair category
  if (typeof data.category !== 'string' || data.category.trim() === '') {
    data.category = 'prop';
    actions.push('Defaulted category to "prop"');
  }

  // Repair confidence
  if (typeof data.confidence !== 'number' || data.confidence < 0 || data.confidence > 1) {
    data.confidence = 0.8;
    actions.push('Clamped confidence to 0.8');
  }

  // Repair summary
  if (typeof data.summary !== 'string' || data.summary.trim() === '') {
    data.summary = `Procedural ${String(data.category)} description`;
    actions.push('Generated fallback summary');
  }

  // Repair cameraView
  if (!data.cameraView || typeof data.cameraView !== 'object') {
    data.cameraView = {
      estimatedAzimuthDeg: 35.0,
      estimatedElevationDeg: 15.0,
      distanceEstimate: 'medium',
      viewAngleDescription: 'Isometric front three-quarters',
    };
    actions.push('Supplied default cameraView');
  }

  // Repair proportions
  if (!data.proportions || typeof data.proportions !== 'object') {
    data.proportions = {
      widthRatio: 1.0,
      depthRatio: 1.0,
      heightRatio: 1.0,
      relativeScaleNotes: 'Estimated relative aspect ratios.',
    };
    actions.push('Supplied default proportions');
  }

  // Repair components array
  if (!Array.isArray(data.components) || data.components.length === 0) {
    data.components = [
      {
        name: 'body',
        semanticRole: 'main structure',
        suggestedPrimitive: 'box',
        relativePosition: [0, 0, 0.5],
        relativeSize: [1, 1, 1],
        primaryColorHex: '#8F684A',
        materialType: 'wood',
        materialId: 'mat_wood',
        visibility: 'inferred',
      },
    ];
    actions.push('Synthesized default box component for empty components list');
  }

  // Enforce max 64 components
  if ((data.components as unknown[]).length > 64) {
    data.components = (data.components as unknown[]).slice(0, 64);
    actions.push('Truncated components to max 64 elements');
  }

  const components = (data.components as Record<string, unknown>[]).map((comp, idx) => {
    // Name
    const name = typeof comp.name === 'string' && comp.name.trim() !== ''
      ? comp.name.replace(/[^a-zA-Z0-9_-]/g, '_')
      : `component_${idx + 1}`;

    // Primitive mapping/fallback
    let prim = typeof comp.suggestedPrimitive === 'string' ? comp.suggestedPrimitive.toLowerCase() : 'box';
    // Common fuzzy LLM primitive aliases
    if (prim === 'cube' || prim === 'rectangular' || prim === 'rect' || prim === 'cuboid') prim = 'box';
    if (prim === 'disc' || prim === 'circle' || prim === 'pipe' || prim === 'tube' || prim === 'rod') prim = 'cylinder';
    if (prim === 'ball' || prim === 'globe') prim = 'sphere';
    if (prim === 'ring' || prim === 'donut') prim = 'torus';
    if (prim === 'pill') prim = 'capsule';

    if (!VALID_PRIMITIVES.includes(prim as SupportedPrimitiveType)) {
      prim = 'box';
      actions.push(`Mapped unsupported primitive "${String(comp.suggestedPrimitive)}" in ${name} to "box"`);
    }

    // Position clamping [-10.0, 10.0]
    const rawPos = Array.isArray(comp.relativePosition) ? comp.relativePosition : [0, 0, 0];
    const pos: [number, number, number] = [
      clampNumber(Number(rawPos[0]) || 0, -10.0, 10.0),
      clampNumber(Number(rawPos[1]) || 0, -10.0, 10.0),
      clampNumber(Number(rawPos[2]) || 0, -10.0, 10.0),
    ];

    // Size clamping [0.01, 20.0]
    const rawSize = Array.isArray(comp.relativeSize) ? comp.relativeSize : [1, 1, 1];
    const size: [number, number, number] = [
      clampNumber(Number(rawSize[0]) || 1, 0.01, 20.0),
      clampNumber(Number(rawSize[1]) || 1, 0.01, 20.0),
      clampNumber(Number(rawSize[2]) || 1, 0.01, 20.0),
    ];

    // Color
    const primaryColorHex = normalizeHexColor(String(comp.primaryColorHex || ''));

    // Material type
    let matType = typeof comp.materialType === 'string' ? comp.materialType.toLowerCase() : 'wood';
    if (!VALID_MATERIAL_TYPES.includes(matType as MaterialSemanticType)) {
      matType = 'other';
    }

    const materialId = typeof comp.materialId === 'string' && comp.materialId.trim() !== ''
      ? comp.materialId
      : `mat_${matType}`;

    return {
      name,
      semanticRole: typeof comp.semanticRole === 'string' ? comp.semanticRole : name,
      suggestedPrimitive: prim as SupportedPrimitiveType,
      relativePosition: pos,
      relativeSize: size,
      primaryColorHex,
      materialType: matType as MaterialSemanticType,
      materialId,
      visibility: comp.visibility === 'fully_visible' || comp.visibility === 'partially_visible' ? comp.visibility : 'inferred',
    };
  });

  data.components = components;

  // Repair materials list and link dangling component materialIds
  const existingMaterials = Array.isArray(data.materials) ? (data.materials as Record<string, unknown>[]) : [];
  const materialMap = new Map<string, { id: string; name: string; baseColorHex: string; roughness: number; metallic: number }>();

  for (const m of existingMaterials) {
    if (m && typeof m === 'object' && typeof m.id === 'string') {
      materialMap.set(m.id, {
        id: m.id,
        name: typeof m.name === 'string' ? m.name : m.id,
        baseColorHex: normalizeHexColor(String(m.baseColorHex || '')),
        roughness: clampNumber(Number(m.roughness) || 0.7, 0.0, 1.0),
        metallic: clampNumber(Number(m.metallic) || 0.0, 0.0, 1.0),
      });
    }
  }

  for (const c of components) {
    if (!materialMap.has(c.materialId)) {
      materialMap.set(c.materialId, {
        id: c.materialId,
        name: c.materialType,
        baseColorHex: c.primaryColorHex,
        roughness: c.materialType === 'metal' ? 0.35 : 0.75,
        metallic: c.materialType === 'metal' ? 0.85 : 0.0,
      });
      actions.push(`Created auto-generated material entry for "${c.materialId}"`);
    }
  }

  data.materials = Array.from(materialMap.values());

  // Repair uncertaintyFlags
  if (!data.uncertaintyFlags || typeof data.uncertaintyFlags !== 'object') {
    data.uncertaintyFlags = {
      unseenRearEstimated: true,
      hiddenUndersideEstimated: true,
      proportionsInferred: true,
      symmetryAssumed: true,
      notes: ['Single-image reconstruction: unobserved sides are estimated.'],
    };
    actions.push('Supplied default uncertaintyFlags');
  }

  return {
    data: data as unknown as StructuredObjectDescription,
    repaired: actions.length > 0,
    repairActions: actions,
  };
}

function clampNumber(val: number, min: number, max: number): number {
  if (Number.isNaN(val) || !Number.isFinite(val)) return min;
  return Math.max(min, Math.min(max, val));
}
