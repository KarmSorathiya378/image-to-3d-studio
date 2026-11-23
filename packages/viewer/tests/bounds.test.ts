import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as THREE from 'three';
import { calculateModelBounds, calculateModelStats } from '../dist/utils/bounds.js';

describe('Geometry Bounds & Inspection Utilities', () => {
  it('calculates bounding box and dimensions correctly for a unit cube mesh', () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const mesh = new THREE.Mesh(geometry, material);

    const bounds = calculateModelBounds(mesh);

    assert.strictEqual(bounds.size[0], 1);
    assert.strictEqual(bounds.size[1], 1);
    assert.strictEqual(bounds.size[2], 1);
    assert.strictEqual(bounds.center[0], 0);
    assert.strictEqual(bounds.center[1], 0);
    assert.strictEqual(bounds.center[2], 0);
    assert.ok(bounds.radius > 0, 'Radius must be greater than 0');
  });

  it('calculates vertex, triangle, and mesh counts for multi-mesh group', () => {
    const group = new THREE.Group();

    // Box 1: 8 vertices, 12 triangles (indexed box geometry has 24 vertices for normals)
    const boxGeom = new THREE.BoxGeometry(2, 2, 2);
    const boxMesh = new THREE.Mesh(boxGeom, new THREE.MeshBasicMaterial());
    group.add(boxMesh);

    // Box 2: positioned offset
    const boxGeom2 = new THREE.BoxGeometry(1, 1, 1);
    const boxMesh2 = new THREE.Mesh(boxGeom2, new THREE.MeshBasicMaterial());
    boxMesh2.position.set(5, 0, 0);
    group.add(boxMesh2);

    const stats = calculateModelStats(group, 1024);

    assert.strictEqual(stats.meshCount, 2, 'Should detect 2 meshes');
    assert.strictEqual(stats.triangleCount, 24, '2 boxes should have 12 + 12 = 24 triangles');
    assert.strictEqual(stats.materialCount, 2, 'Should detect 2 materials');
    assert.strictEqual(stats.fileSizeBytes, 1024);

    // Bounds should span both meshes: X from -1 to 5.5 => size.x = 6.5
    assert.strictEqual(stats.bounds.min[0], -1);
    assert.strictEqual(stats.bounds.max[0], 5.5);
    assert.strictEqual(stats.bounds.size[0], 6.5);
  });

  it('handles empty group gracefully with zeroed bounds', () => {
    const emptyGroup = new THREE.Group();
    const bounds = calculateModelBounds(emptyGroup);

    assert.deepStrictEqual(bounds.min, [0, 0, 0]);
    assert.deepStrictEqual(bounds.max, [0, 0, 0]);
    assert.deepStrictEqual(bounds.size, [0, 0, 0]);
    assert.strictEqual(bounds.radius, 0);
  });
});
