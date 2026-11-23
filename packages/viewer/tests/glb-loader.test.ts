import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createBoxGlbBuffer } from '../dist/utils/gltf-fixture.js';
import { calculateModelStats } from '../dist/utils/bounds.js';
import { disposeThreeObject } from '../dist/utils/disposal.js';

describe('Real GLB 3D Geometry Loading & Parsing', () => {
  it('loads real binary GLB and extracts real geometry, bounds, and triangles', async () => {
    const glbBuffer = createBoxGlbBuffer();
    const loader = new GLTFLoader();

    const gltf = await new Promise<{ scene: THREE.Group }>((resolve, reject) => {
      loader.parse(
        glbBuffer,
        '',
        (result) => resolve(result),
        (error) => reject(error)
      );
    });

    assert.ok(gltf.scene instanceof THREE.Group, 'Loaded GLB must produce a THREE.Group scene');

    // Inspect geometry stats
    const stats = calculateModelStats(gltf.scene, glbBuffer.byteLength);

    assert.strictEqual(stats.meshCount, 1, 'GLB fixture has 1 mesh');
    assert.strictEqual(stats.vertexCount, 24, 'Cube mesh has 24 vertices');
    assert.strictEqual(stats.triangleCount, 12, 'Cube mesh has 12 triangles');
    assert.strictEqual(stats.materialCount, 1, 'Cube mesh has 1 material');

    // Bounds check
    assert.strictEqual(stats.bounds.size[0], 1, 'Cube width = 1');
    assert.strictEqual(stats.bounds.size[1], 1, 'Cube height = 1');
    assert.strictEqual(stats.bounds.size[2], 1, 'Cube depth = 1');

    // Wireframe toggle test
    gltf.scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.wireframe = true;
        assert.strictEqual(mat.wireframe, true);
        mat.wireframe = false;
        assert.strictEqual(mat.wireframe, false);
      }
    });

    // Cleanup
    disposeThreeObject(gltf.scene);
  });

  it('fails gracefully when parsing corrupted binary data', async () => {
    const corruptedBuffer = new Uint8Array([0x00, 0x11, 0x22, 0x33, 0x44]).buffer;
    const loader = new GLTFLoader();

    await assert.rejects(
      async () => {
        await new Promise((resolve, reject) => {
          loader.parse(corruptedBuffer, '', resolve, reject);
        });
      },
      (err: Error) => {
        assert.ok(err.message.includes('glTF') || err.message.length > 0);
        return true;
      }
    );
  });
});
