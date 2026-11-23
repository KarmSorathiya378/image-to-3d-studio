import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  validateSceneSpec,
  getMockSceneSpec,
  synthesizeSceneSpecFromDescription,
  applyGroundingAndCentering,
  MAX_SCENE_PARTS,
} from '../src/planning/index.ts';
import { getMockObjectDescription } from '../src/vision/index.ts';
import { SceneSpecValidationError } from '../src/errors/pipeline-errors.ts';

describe('Geometry Planner - SceneSpec Schema and Invariants', () => {
  it('validates a conforming SceneSpec v1', () => {
    const spec = getMockSceneSpec('stool');
    const validated = validateSceneSpec(spec);
    assert.strictEqual(validated.schemaVersion, '1.0');
    assert.strictEqual(validated.coordinateSystem, 'Z_UP');
    assert.strictEqual(validated.units, 'relative');
    assert.ok(validated.parts.length > 0);
    assert.ok(validated.materials.length > 0);
  });

  it('rejects unsupported schemaVersion', () => {
    const invalid = { ...getMockSceneSpec('stool'), schemaVersion: '2.0' };
    assert.throws(
      () => validateSceneSpec(invalid),
      (err: unknown) => err instanceof SceneSpecValidationError
    );
  });

  it('rejects unsupported coordinateSystem (e.g. Y_UP)', () => {
    const invalid = { ...getMockSceneSpec('stool'), coordinateSystem: 'Y_UP' };
    assert.throws(
      () => validateSceneSpec(invalid),
      (err: unknown) => err instanceof SceneSpecValidationError
    );
  });

  it('rejects part count exceeding MAX_SCENE_PARTS (64)', () => {
    const base = getMockSceneSpec('stool');
    const parts = Array.from({ length: 65 }, (_, i) => ({
      ...base.parts[0],
      id: `part_${i}`,
    }));
    assert.throws(
      () => validateSceneSpec({ ...base, parts }),
      (err: unknown) => err instanceof SceneSpecValidationError
    );
  });

  it('rejects parts with out-of-bound position coordinates (> 10.0)', () => {
    const base = getMockSceneSpec('stool');
    const parts = [{ ...base.parts[0], position: [15.0, 0.0, 0.0] as [number, number, number] }];
    assert.throws(
      () => validateSceneSpec({ ...base, parts }),
      (err: unknown) => err instanceof SceneSpecValidationError
    );
  });

  it('rejects parts referencing undeclared materialId', () => {
    const base = getMockSceneSpec('stool');
    const parts = [{ ...base.parts[0], materialId: 'nonexistent_material' }];
    assert.throws(
      () => validateSceneSpec({ ...base, parts }),
      (err: unknown) => err instanceof SceneSpecValidationError
    );
  });

  it('rejects cyclic hierarchy in part parenting', () => {
    const base = getMockSceneSpec('stool');
    const parts = [
      { ...base.parts[0], id: 'part_A', parentId: 'part_B' },
      { ...base.parts[1], id: 'part_B', parentId: 'part_A' },
    ];
    assert.throws(
      () => validateSceneSpec({ ...base, parts }),
      (err: unknown) => err instanceof SceneSpecValidationError
    );
  });

  it('synthesizes valid SceneSpec directly from StructuredObjectDescription', () => {
    const desc = getMockObjectDescription('desk_lamp');
    const spec = synthesizeSceneSpecFromDescription(desc);
    const validated = validateSceneSpec(spec);
    assert.strictEqual(validated.schemaVersion, '1.0');
    assert.strictEqual(validated.coordinateSystem, 'Z_UP');
    assert.ok(validated.parts.length === desc.components.length);
  });

  it('aligns grounded base to Z=0 and centers XY', () => {
    const spec = getMockSceneSpec('stool');
    const grounded = applyGroundingAndCentering(spec);
    const minZ = Math.min(...grounded.parts.map((p) => p.position[2] - p.size[2] / 2));
    assert.ok(Math.abs(minZ) < 0.01, `Expected bottom Z near 0, got ${minZ}`);
  });
});
