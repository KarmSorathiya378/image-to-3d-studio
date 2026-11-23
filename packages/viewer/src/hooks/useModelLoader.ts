import { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { ModelStats } from '../types.js';
import { calculateModelStats } from '../utils/bounds.js';
import { disposeThreeObject } from '../utils/disposal.js';

export interface UseModelLoaderOptions {
  src?: string | Blob | ArrayBuffer | null;
  onLoading?: (isLoading: boolean) => void;
  onProgress?: (percent: number) => void;
  onLoad?: (stats: ModelStats, model: THREE.Group) => void;
  onError?: (error: Error) => void;
}

export interface UseModelLoaderResult {
  model: THREE.Group | null;
  stats: ModelStats | null;
  isLoading: boolean;
  progress: number;
  error: Error | null;
  reload: () => void;
}

export function useModelLoader({
  src,
  onLoading,
  onProgress,
  onLoad,
  onError,
}: UseModelLoaderOptions): UseModelLoaderResult {
  const [model, setModel] = useState<THREE.Group | null>(null);
  const [stats, setStats] = useState<ModelStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<Error | null>(null);
  const [reloadNonce, setReloadNonce] = useState<number>(0);

  const currentModelRef = useRef<THREE.Group | null>(null);
  const isCancelledRef = useRef<boolean>(false);

  const reload = useCallback(() => {
    setReloadNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    isCancelledRef.current = false;

    if (!src) {
      if (currentModelRef.current) {
        disposeThreeObject(currentModelRef.current);
        currentModelRef.current = null;
      }
      setModel(null);
      setStats(null);
      setIsLoading(false);
      setProgress(0);
      setError(null);
      onLoading?.(false);
      return;
    }

    setIsLoading(true);
    setProgress(0);
    setError(null);
    onLoading?.(true);

    const loader = new GLTFLoader();

    const handleLoadedGltf = (gltfScene: THREE.Group, byteSize?: number) => {
      if (isCancelledRef.current) {
        disposeThreeObject(gltfScene);
        return;
      }

      // Dispose previous model
      if (currentModelRef.current) {
        disposeThreeObject(currentModelRef.current);
      }

      currentModelRef.current = gltfScene;

      const calculatedStats = calculateModelStats(gltfScene, byteSize);
      setModel(gltfScene);
      setStats(calculatedStats);
      setIsLoading(false);
      setProgress(100);
      onLoading?.(false);
      onProgress?.(100);
      onLoad?.(calculatedStats, gltfScene);
    };

    const handleLoadError = (err: unknown) => {
      if (isCancelledRef.current) return;

      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      setIsLoading(false);
      onLoading?.(false);
      onError?.(errorObj);
    };

    const loadAsync = async () => {
      try {
        let buffer: ArrayBuffer;
        let byteSize: number | undefined;

        if (src instanceof ArrayBuffer) {
          buffer = src;
          byteSize = src.byteLength;
        } else if (typeof Blob !== 'undefined' && src instanceof Blob) {
          buffer = await src.arrayBuffer();
          byteSize = src.size;
        } else if (typeof src === 'string') {
          // Fetch the remote/local URL
          const response = await fetch(src);
          if (!response.ok) {
            throw new Error(`Failed to fetch 3D model asset: HTTP ${response.status} ${response.statusText}`);
          }

          const contentLengthHeader = response.headers.get('content-length');
          const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;

          if (response.body && totalBytes > 0) {
            const reader = response.body.getReader();
            let receivedBytes = 0;
            const chunks: Uint8Array[] = [];

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (value) {
                chunks.push(value);
                receivedBytes += value.length;
                const percent = Math.min(99, Math.round((receivedBytes / totalBytes) * 100));
                setProgress(percent);
                onProgress?.(percent);
              }
            }

            // Concatenate chunks
            const allChunks = new Uint8Array(receivedBytes);
            let position = 0;
            for (const chunk of chunks) {
              allChunks.set(chunk, position);
              position += chunk.length;
            }
            buffer = allChunks.buffer;
            byteSize = receivedBytes;
          } else {
            buffer = await response.arrayBuffer();
            byteSize = buffer.byteLength;
          }
        } else {
          throw new Error(`Invalid GLB source type: ${typeof src}`);
        }

        if (isCancelledRef.current) return;

        // Parse GLB ArrayBuffer with Three.js GLTFLoader
        loader.parse(
          buffer,
          '',
          (gltf) => {
            handleLoadedGltf(gltf.scene, byteSize);
          },
          (err) => {
            handleLoadError(err);
          }
        );
      } catch (err) {
        handleLoadError(err);
      }
    };

    void loadAsync();

    return () => {
      isCancelledRef.current = true;
      if (currentModelRef.current) {
        disposeThreeObject(currentModelRef.current);
        currentModelRef.current = null;
      }
    };
  }, [src, reloadNonce, onLoad, onError, onLoading, onProgress]);

  return {
    model,
    stats,
    isLoading,
    progress,
    error,
    reload,
  };
}
