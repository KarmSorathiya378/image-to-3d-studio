import { SceneSpecValidationError } from '../errors/pipeline-errors.ts';
import { VALID_PRIMITIVES, normalizeHexColor } from '../vision/schemas.ts';
import type { SceneSpec, ScenePart, SceneMaterial } from './types.ts';
import type { SupportedPrimitiveType } from '../vision/types.ts';

export const MAX_SCENE_PARTS = 64;
export const MAX_COORDINATE_BOUND = 10.0;
export const MIN_COORDINATE_BOUND = -10.0;
export const MAX_PART_SIZE = 20.0;
export const MIN_PART_SIZE = 0.005;

/**
 * Strict validator for SceneSpec v1 complying with architecture and PRD requirements.
 */
export function validateSceneSpec(data: unknown): SceneSpec {
  if (!data || typeof data !== 'object') {
    throw new SceneSpecValidationError('SceneSpec must be a non-null JSON object');
  }

  const spec = data as Record<string, unknown>;

  // 1. schemaVersion
  if (spec.schemaVersion !== '1.0') {
    throw new SceneSpecValidationError(
      `Unsupported schemaVersion "${String(spec.schemaVersion)}". Expected "1.0"`
    );
  }

  // 2. objectName
  if (typeof spec.objectName !== 'string' || spec.objectName.trim() === '') {
    throw new SceneSpecValidationError('Missing or empty "objectName" field');
  }
  const cleanName = spec.objectName.trim().replace(/[^a-zA-Z0-9_-]/g, '_');

  // 3. coordinateSystem
  if (spec.coordinateSystem !== 'Z_UP') {
    throw new SceneSpecValidationError(
      `Unsupported coordinateSystem "${String(spec.coordinateSystem)}". Expected "Z_UP"`
    );
  }

  // 4. units
  if (spec.units !== 'relative') {
    throw new SceneSpecValidationError(`Unsupported units "${String(spec.units)}". Expected "relative"`);
  }

  // 5. referenceView
  if (!spec.referenceView || typeof spec.referenceView !== 'object') {
    throw new SceneSpecValidationError('Missing or invalid "referenceView" object');
  }
  const rv = spec.referenceView as Record<string, unknown>;
  const azimuthDeg = typeof rv.azimuthDeg === 'number' && Number.isFinite(rv.azimuthDeg) ? rv.azimuthDeg : 35.0;
  const elevationDeg = typeof rv.elevationDeg === 'number' && Number.isFinite(rv.elevationDeg) ? rv.elevationDeg : 15.0;

  // 6. materials validation
  if (!Array.isArray(spec.materials) || spec.materials.length === 0) {
    throw new SceneSpecValidationError('"materials" must be a non-empty array');
  }

  const materialIds = new Set<string>();
  const validatedMaterials: SceneMaterial[] = [];

  for (let i = 0; i < spec.materials.length; i++) {
    const rawMat = spec.materials[i];
    if (!rawMat || typeof rawMat !== 'object') {
      throw new SceneSpecValidationError(`Material at index ${i} is not a valid object`);
    }
    const m = rawMat as Record<string, unknown>;

    if (typeof m.id !== 'string' || m.id.trim() === '') {
      throw new SceneSpecValidationError(`Material at index ${i} has missing or empty "id"`);
    }
    const id = m.id.trim();
    if (materialIds.has(id)) {
      throw new SceneSpecValidationError(`Duplicate material id "${id}" at index ${i}`);
    }
    materialIds.add(id);

    const baseColor = normalizeHexColor(typeof m.baseColor === 'string' ? m.baseColor : '#808080');

    const roughness = typeof m.roughness === 'number' && Number.isFinite(m.roughness)
      ? Math.max(0.0, Math.min(1.0, m.roughness))
      : 0.7;

    const metallic = typeof m.metallic === 'number' && Number.isFinite(m.metallic)
      ? Math.max(0.0, Math.min(1.0, m.metallic))
      : 0.0;

    validatedMaterials.push({ id, baseColor, roughness, metallic });
  }

  // 7. parts validation
  if (!Array.isArray(spec.parts) || spec.parts.length === 0) {
    throw new SceneSpecValidationError('"parts" must be a non-empty array of SceneParts');
  }

  if (spec.parts.length > MAX_SCENE_PARTS) {
    throw new SceneSpecValidationError(
      `Part count (${spec.parts.length}) exceeds maximum allowable parts (${MAX_SCENE_PARTS})`
    );
  }

  const partIds = new Set<string>();
  const validatedParts: ScenePart[] = [];

  for (let i = 0; i < spec.parts.length; i++) {
    const rawPart = spec.parts[i];
    if (!rawPart || typeof rawPart !== 'object') {
      throw new SceneSpecValidationError(`Part at index ${i} is not an object`);
    }
    const p = rawPart as Record<string, unknown>;

    if (typeof p.id !== 'string' || p.id.trim() === '') {
      throw new SceneSpecValidationError(`Part at index ${i} has missing or empty "id"`);
    }
    const id = p.id.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    if (partIds.has(id)) {
      throw new SceneSpecValidationError(`Duplicate part id "${id}" at index ${i}`);
    }
    partIds.add(id);

    // Primitive type
    if (typeof p.type !== 'string' || !VALID_PRIMITIVES.includes(p.type as SupportedPrimitiveType)) {
      throw new SceneSpecValidationError(
        `Part "${id}" has unsupported primitive type "${String(p.type)}". Supported: ${VALID_PRIMITIVES.join(', ')}`
      );
    }
    const type = p.type as SupportedPrimitiveType;

    // Size [x, y, z]
    if (!Array.isArray(p.size) || p.size.length !== 3) {
      throw new SceneSpecValidationError(`Part "${id}" must have a 3-element numeric "size" array [x, y, z]`);
    }
    const sx = Number(p.size[0]);
    const sy = Number(p.size[1]);
    const sz = Number(p.size[2]);
    if (!Number.isFinite(sx) || !Number.isFinite(sy) || !Number.isFinite(sz) || sx <= 0 || sy <= 0 || sz <= 0) {
      throw new SceneSpecValidationError(`Part "${id}" dimensions must be finite positive numbers`);
    }
    if (sx > MAX_PART_SIZE || sy > MAX_PART_SIZE || sz > MAX_PART_SIZE) {
      throw new SceneSpecValidationError(
        `Part "${id}" dimension exceeds maximum allowed size (${MAX_PART_SIZE})`
      );
    }
    const size: [number, number, number] = [
      Math.max(MIN_PART_SIZE, sx),
      Math.max(MIN_PART_SIZE, sy),
      Math.max(MIN_PART_SIZE, sz),
    ];

    // Position [x, y, z]
    if (!Array.isArray(p.position) || p.position.length !== 3) {
      throw new SceneSpecValidationError(`Part "${id}" must have a 3-element numeric "position" array [x, y, z]`);
    }
    const px = Number(p.position[0]);
    const py = Number(p.position[1]);
    const pz = Number(p.position[2]);
    if (!Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(pz)) {
      throw new SceneSpecValidationError(`Part "${id}" position coordinates must be finite numbers`);
    }
    if (
      px < MIN_COORDINATE_BOUND || px > MAX_COORDINATE_BOUND ||
      py < MIN_COORDINATE_BOUND || py > MAX_COORDINATE_BOUND ||
      pz < MIN_COORDINATE_BOUND || pz > MAX_COORDINATE_BOUND
    ) {
      throw new SceneSpecValidationError(
        `Part "${id}" position coordinates [${px}, ${py}, ${pz}] exceed bounded coordinate range [${MIN_COORDINATE_BOUND}, ${MAX_COORDINATE_BOUND}]`
      );
    }
    const position: [number, number, number] = [px, py, pz];

    // Rotation [rx, ry, rz]
    const rawRot = Array.isArray(p.rotationDeg) && p.rotationDeg.length === 3 ? p.rotationDeg : [0, 0, 0];
    const rx = Number(rawRot[0]) || 0;
    const ry = Number(rawRot[1]) || 0;
    const rz = Number(rawRot[2]) || 0;
    const rotationDeg: [number, number, number] = [rx, ry, rz];

    // Material reference
    if (typeof p.materialId !== 'string' || !materialIds.has(p.materialId)) {
      throw new SceneSpecValidationError(
        `Part "${id}" references unknown materialId "${String(p.materialId)}"`
      );
    }
    const materialId = p.materialId;

    const validatedPart: ScenePart = {
      id,
      type,
      size,
      position,
      rotationDeg,
      materialId,
    };

    if (typeof p.parentId === 'string' && p.parentId.trim() !== '') {
      validatedPart.parentId = p.parentId.trim();
    }

    if (type === 'lathe' && Array.isArray(p.profile)) {
      validatedPart.profile = p.profile
        .filter((pt): pt is [number, number] => Array.isArray(pt) && pt.length === 2)
        .map((pt) => [Number(pt[0]) || 0, Number(pt[1]) || 0]);
    }

    if (type === 'extrudedPolygon' && Array.isArray(p.polygonPoints)) {
      validatedPart.polygonPoints = p.polygonPoints
        .filter((pt): pt is [number, number] => Array.isArray(pt) && pt.length === 2)
        .map((pt) => [Number(pt[0]) || 0, Number(pt[1]) || 0]);
    }

    validatedParts.push(validatedPart);
  }

  // Check for circular hierarchy in parentId
  for (const part of validatedParts) {
    if (part.parentId) {
      if (!partIds.has(part.parentId)) {
        throw new SceneSpecValidationError(`Part "${part.id}" references nonexistent parentId "${part.parentId}"`);
      }
      if (part.parentId === part.id) {
        throw new SceneSpecValidationError(`Part "${part.id}" cannot be parent to itself`);
      }
      // Walk ancestors to detect cycles
      let currParent: string | undefined = part.parentId;
      const visited = new Set<string>([part.id]);
      while (currParent) {
        if (visited.has(currParent)) {
          throw new SceneSpecValidationError(`Cyclic hierarchy detected involving part "${part.id}" and "${currParent}"`);
        }
        visited.add(currParent);
        const parentPart = validatedParts.find((pt) => pt.id === currParent);
        currParent = parentPart?.parentId;
      }
    }
  }

  // 8. uncertaintyNotes
  const uncertaintyNotes = Array.isArray(spec.uncertaintyNotes)
    ? spec.uncertaintyNotes.filter((n): n is string => typeof n === 'string')
    : ['Procedural model inferred from single 2D image; hidden geometry approximated.'];

  return {
    schemaVersion: '1.0',
    objectName: cleanName,
    coordinateSystem: 'Z_UP',
    units: 'relative',
    referenceView: {
      azimuthDeg,
      elevationDeg,
    },
    parts: validatedParts,
    materials: validatedMaterials,
    uncertaintyNotes,
  };
}
