import type * as THREE from 'three';

const TEXTURE_PROPERTIES = [
  'map',
  'alphaMap',
  'aoMap',
  'bumpMap',
  'displacementMap',
  'emissiveMap',
  'envMap',
  'lightMap',
  'metalnessMap',
  'normalMap',
  'roughnessMap',
] as const;

/**
 * Disposes of a single material and all textures attached to it.
 */
export function disposeMaterial(material: THREE.Material): void {
  const mat = material as unknown as Record<string, unknown>;

  for (const prop of TEXTURE_PROPERTIES) {
    const tex = mat[prop];
    if (tex && typeof (tex as { dispose?: () => void }).dispose === 'function') {
      (tex as { dispose: () => void }).dispose();
    }
  }

  material.dispose();
}

/**
 * Recursively disposes of all geometries, materials, and textures attached to a 3D object.
 * Also removes all children to prevent memory leaks in WebGL contexts.
 */
export function disposeThreeObject(object: THREE.Object3D | null | undefined): void {
  if (!object) return;

  object.traverse((child) => {
    // Dispose geometry
    const mesh = child as unknown as {
      geometry?: THREE.BufferGeometry;
      material?: THREE.Material | THREE.Material[];
    };

    if (mesh.geometry && typeof mesh.geometry.dispose === 'function') {
      mesh.geometry.dispose();
    }

    // Dispose material(s)
    if (mesh.material) {
      if (Array.isArray(mesh.material)) {
        for (const mat of mesh.material) {
          if (mat && typeof mat.dispose === 'function') {
            disposeMaterial(mat);
          }
        }
      } else if (typeof mesh.material.dispose === 'function') {
        disposeMaterial(mesh.material);
      }
    }
  });

  // Clear children
  if (typeof object.clear === 'function') {
    object.clear();
  }
}

/**
 * Disposes of a WebGLRenderer and forces WebGL context loss.
 */
export function disposeRenderer(renderer: THREE.WebGLRenderer | null | undefined): void {
  if (!renderer) return;

  try {
    renderer.dispose();
    const forceContextLoss = renderer.forceContextLoss?.bind(renderer);
    if (forceContextLoss) {
      forceContextLoss();
    }
    const domElement = renderer.domElement;
    if (domElement && domElement.parentNode) {
      domElement.parentNode.removeChild(domElement);
    }
  } catch {
    // Ignore context loss errors during cleanup
  }
}
