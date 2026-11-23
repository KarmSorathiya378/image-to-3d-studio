import { validateSceneSpec } from './scenespec-schema.ts';
import { getSceneSpecContract } from './contract-loader.ts';
import { getMockSceneSpec } from './mock-planner.ts';
import { determineOptimalPrimitive } from './primitive-rules.ts';
import { PLANNER_SYSTEM_PROMPT, buildPlannerUserPrompt } from './prompts.ts';
import { repairModelJsonResponse } from '../repair/json-repair.ts';
import type { StructuredObjectDescription } from '../vision/types.ts';
import type { SceneSpec, ScenePart, SceneMaterial, GeometryPlanningOptions } from './types.ts';

export interface GeometryPlanningResult {
  sceneSpec: SceneSpec;
  rawResponse?: string;
  repaired: boolean;
  repairLogs: string[];
}

/**
 * Transforms a StructuredObjectDescription into a validated SceneSpec.
 * Ensures grounding to Z=0 and horizontal centering.
 */
export async function planGeometryFromDescription(
  description: StructuredObjectDescription,
  options: GeometryPlanningOptions = {}
): Promise<GeometryPlanningResult> {
  const repairLogs: string[] = [];

  // Mock mode: return deterministic fixture or procedurally convert description
  if (options.mockMode || !options.plannerCaller) {
    // If description has components, procedurally synthesize the SceneSpec
    const synthesized = synthesizeSceneSpecFromDescription(description, options);
    const contract = await getSceneSpecContract();
    const validated = contract.validate(synthesized);

    return {
      sceneSpec: validated,
      repaired: false,
      repairLogs: ['Procedural deterministic geometry planning applied'],
    };
  }

  // Live planner invocation
  const systemPrompt = PLANNER_SYSTEM_PROMPT;
  const userPrompt = buildPlannerUserPrompt(description);

  const rawOutput = await options.plannerCaller(systemPrompt, userPrompt);

  const jsonResult = repairModelJsonResponse<SceneSpec>(rawOutput);
  if (jsonResult.repaired) {
    repairLogs.push(...jsonResult.repairActions);
  }

  // Normalize grounding and bounding
  let sceneCandidate = jsonResult.parsed;
  sceneCandidate = applyGroundingAndCentering(sceneCandidate, options);

  const contract = await getSceneSpecContract();
  const validated = contract.validate(sceneCandidate);

  return {
    sceneSpec: validated,
    rawResponse: rawOutput,
    repaired: repairLogs.length > 0,
    repairLogs,
  };
}

/**
 * Procedurally converts StructuredObjectDescription into SceneSpec directly without external API.
 */
export function synthesizeSceneSpecFromDescription(
  description: StructuredObjectDescription,
  options: GeometryPlanningOptions = {}
): SceneSpec {
  const objectName = `procedural_${description.category}_${Date.now().toString(36).substring(4)}`;

  const materials: SceneMaterial[] = description.materials.map((m) => ({
    id: m.id,
    baseColor: m.baseColorHex,
    roughness: m.roughness,
    metallic: m.metallic,
  }));

  const parts: ScenePart[] = description.components.map((c, idx) => {
    const id = c.name.replace(/[^a-zA-Z0-9_-]/g, '_') || `part_${idx + 1}`;
    const type = determineOptimalPrimitive(c.semanticRole, c.suggestedPrimitive);
    const size: [number, number, number] = [c.relativeSize[0], c.relativeSize[1], c.relativeSize[2]];
    const position: [number, number, number] = [c.relativePosition[0], c.relativePosition[1], c.relativePosition[2]];
    const rotationDeg: [number, number, number] = c.relativeRotationDeg
      ? [c.relativeRotationDeg[0], c.relativeRotationDeg[1], c.relativeRotationDeg[2]]
      : [0, 0, 0];

    return {
      id,
      type,
      size,
      position,
      rotationDeg,
      materialId: c.materialId,
    };
  });

  const rawSpec: SceneSpec = {
    schemaVersion: '1.0',
    objectName,
    coordinateSystem: 'Z_UP',
    units: 'relative',
    referenceView: {
      azimuthDeg: description.cameraView.estimatedAzimuthDeg,
      elevationDeg: description.cameraView.estimatedElevationDeg,
    },
    parts,
    materials,
    uncertaintyNotes: description.uncertaintyFlags.notes,
  };

  return applyGroundingAndCentering(rawSpec, options);
}

/**
 * Adjusts parts positions so the lowest surface touches Z=0 (ground plane)
 * and the center of the bounding box is positioned at X=0, Y=0.
 */
export function applyGroundingAndCentering(
  spec: SceneSpec,
  options: GeometryPlanningOptions = {}
): SceneSpec {
  const normalizeGround = options.normalizeGroundPlane ?? true;
  const centerXY = options.centerHorizontal ?? true;

  if (!spec.parts || spec.parts.length === 0) return spec;

  let minZ = Infinity;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const part of spec.parts) {
    const pz = part.position[2];
    const sz = part.size[2];
    const bottomZ = pz - sz / 2;
    if (bottomZ < minZ) minZ = bottomZ;

    const px = part.position[0];
    const sx = part.size[0];
    if (px - sx / 2 < minX) minX = px - sx / 2;
    if (px + sx / 2 > maxX) maxX = px + sx / 2;

    const py = part.position[1];
    const sy = part.size[1];
    if (py - sy / 2 < minY) minY = py - sy / 2;
    if (py + sy / 2 > maxY) maxY = py + sy / 2;
  }

  const offsetZ = normalizeGround && Number.isFinite(minZ) ? -minZ : 0;
  const offsetX = centerXY && Number.isFinite(minX) && Number.isFinite(maxX) ? -((minX + maxX) / 2) : 0;
  const offsetY = centerXY && Number.isFinite(minY) && Number.isFinite(maxY) ? -((minY + maxY) / 2) : 0;

  if (offsetZ === 0 && offsetX === 0 && offsetY === 0) {
    return spec;
  }

  const shiftedParts: ScenePart[] = spec.parts.map((p) => ({
    ...p,
    position: [
      Number((p.position[0] + offsetX).toFixed(4)),
      Number((p.position[1] + offsetY).toFixed(4)),
      Number((p.position[2] + offsetZ).toFixed(4)),
    ],
  }));

  return {
    ...spec,
    parts: shiftedParts,
  };
}
