import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as THREE from 'three';
import { disposeThreeObject, disposeMaterial } from '../dist/utils/disposal.js';

describe('Resource Disposal & Cleanup', () => {
  it('disposes geometries and materials across hierarchy', () => {
    const group = new THREE.Group();

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    let geomDisposed = false;
    geometry.addEventListener('dispose', () => {
      geomDisposed = true;
    });

    const material = new THREE.MeshStandardMaterial();
    let matDisposed = false;
    material.addEventListener('dispose', () => {
      matDisposed = true;
    });

    const mesh = new THREE.Mesh(geometry, material);
    group.add(mesh);

    assert.strictEqual(group.children.length, 1);

    disposeThreeObject(group);

    assert.ok(geomDisposed, 'Geometry should be disposed');
    assert.ok(matDisposed, 'Material should be disposed');
    assert.strictEqual(group.children.length, 0, 'Children should be cleared');
  });

  it('disposes attached textures on material disposal', () => {
    const material = new THREE.MeshStandardMaterial();
    const texture = new THREE.Texture();
    let texDisposed = false;
    texture.addEventListener('dispose', () => {
      texDisposed = true;
    });

    material.map = texture;

    disposeMaterial(material);

    assert.ok(texDisposed, 'Attached texture should be disposed');
  });

  it('handles null and undefined safely without throwing', () => {
    assert.doesNotThrow(() => {
      disposeThreeObject(null);
      disposeThreeObject(undefined);
    });
  });
});
