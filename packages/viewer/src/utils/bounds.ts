import * as THREE from 'three';
import type { ModelBounds, ModelStats } from '../types.js';

/**
 * Computes bounding box, center, dimensions, and bounding sphere for a Three.js object.
 */
export function calculateModelBounds(object: THREE.Object3D): ModelBounds {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);

  if (box.isEmpty()) {
    return {
      min: [0, 0, 0],
      max: [0, 0, 0],
      center: [0, 0, 0],
      size: [0, 0, 0],
      radius: 0,
    };
  }

  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(size);

  const sphere = new THREE.Sphere();
  box.getBoundingSphere(sphere);

  return {
    min: [box.min.x, box.min.y, box.min.z],
    max: [box.max.x, box.max.y, box.max.z],
    center: [center.x, center.y, center.z],
    size: [size.x, size.y, size.z],
    radius: sphere.radius,
  };
}

/**
 * Computes full geometric stats including vertex count, triangle count, mesh count,
 * unique material count, and bounding box dimensions.
 */
export function calculateModelStats(
  object: THREE.Object3D,
  fileSizeBytes?: number
): ModelStats {
  let vertexCount = 0;
  let triangleCount = 0;
  let meshCount = 0;
  const materialsSet = new Set<THREE.Material>();

  object.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      meshCount++;

      const geometry = mesh.geometry;
      if (geometry) {
        const position = geometry.attributes['position'];
        if (position) {
          vertexCount += position.count;

          if (geometry.index) {
            triangleCount += Math.floor(geometry.index.count / 3);
          } else {
            triangleCount += Math.floor(position.count / 3);
          }
        }
      }

      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          for (const mat of mesh.material) {
            materialsSet.add(mat);
          }
        } else {
          materialsSet.add(mesh.material);
        }
      }
    }
  });

  const bounds = calculateModelBounds(object);

  return {
    vertexCount,
    triangleCount,
    meshCount,
    materialCount: materialsSet.size,
    bounds,
    fileSizeBytes,
  };
}
