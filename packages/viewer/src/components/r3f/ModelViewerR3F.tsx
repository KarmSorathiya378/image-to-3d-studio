'use client';

import React, { useEffect } from 'react';
import * as THREE from 'three';
import '@react-three/fiber';
import type { ModelViewerProps } from '../../types.js';
import { useModelLoader } from '../../hooks/useModelLoader.js';

export interface R3FSceneContentProps {
  src?: string | Blob | ArrayBuffer | null;
  showGrid?: boolean;
  showWireframe?: boolean;
  autoRotate?: boolean;
  onLoad?: ModelViewerProps['onLoad'];
  onError?: ModelViewerProps['onError'];
}

/**
 * Pure Three.js inner scene graph component for use inside a React Three Fiber <Canvas>
 */
export function ModelSceneGraph({
  src,
  showGrid = true,
  showWireframe = false,
  onLoad,
  onError,
}: R3FSceneContentProps) {
  const { model } = useModelLoader({
    src,
    onLoad,
    onError,
  });

  // Apply wireframe mode whenever toggle changes
  useEffect(() => {
    if (!model) return;
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            for (const m of mesh.material) {
              if (m && 'wireframe' in m) {
                (m as { wireframe: boolean }).wireframe = showWireframe;
              }
            }
          } else if ('wireframe' in mesh.material) {
            (mesh.material as { wireframe: boolean }).wireframe = showWireframe;
          }
        }
      }
    });
  }, [model, showWireframe]);

  return (
    <group>
      {/* Default Three-point lighting */}
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 8, 5]} intensity={1.5} />
      <directionalLight position={[-5, 3, -4]} intensity={0.7} color="#90b0e0" />
      <directionalLight position={[0, 6, -6]} intensity={0.5} />

      {/* Grid */}
      {showGrid && <primitive object={new THREE.GridHelper(10, 20, 0x555555, 0x2e3238)} />}

      {/* Render real model if loaded */}
      {model && <primitive object={model} />}
    </group>
  );
}

export default ModelSceneGraph;

