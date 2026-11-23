'use client';

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type {
  ModelViewerProps,
  ViewerControlsRef,
  CameraPreset,
  LightingPreset,
  ModelStats,
} from '../types.js';
import { useModelLoader } from '../hooks/useModelLoader.js';
import { calculateModelBounds } from '../utils/bounds.js';
import { disposeRenderer, disposeThreeObject } from '../utils/disposal.js';
import { downloadGlbBlob, triggerBlobDownload } from '../utils/download.js';

export const ModelViewer = forwardRef<ViewerControlsRef, ModelViewerProps>(
  (
    {
      src,
      alt = '3D Model Viewport',
      className = '',
      style = {},
      backgroundColor = '#121316',
      showGrid: initialShowGrid = true,
      showWireframe: initialShowWireframe = false,
      showAxes: initialShowAxes = false,
      autoRotate = false,
      autoRotateSpeed = 1.0,
      lighting = 'studio',
      lightingIntensity = 1.0,
      initialCameraPosition,
      cameraFov = 45,
      showControls = true,
      showStats: initialShowStats = false,
      loadingFallback,
      downloadFilename = 'model.glb',
      onLoading,
      onProgress,
      onLoad,
      onError,
      onCameraReset,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);

    // Three.js core state refs
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const gridRef = useRef<THREE.GridHelper | null>(null);
    const axesRef = useRef<THREE.AxesHelper | null>(null);
    const lightsGroupRef = useRef<THREE.Group | null>(null);
    const currentModelGroupRef = useRef<THREE.Group | null>(null);
    const animationFrameIdRef = useRef<number | null>(null);

    // Initial camera transform backup for reset
    const defaultCameraPosRef = useRef<THREE.Vector3>(new THREE.Vector3(2.5, 2.0, 3.5));
    const defaultTargetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));

    // Interactive UI states
    const [bgColor, setBgColor] = useState<string>(backgroundColor);
    const [gridVisible, setGridVisible] = useState<boolean>(initialShowGrid);
    const [wireframeActive, setWireframeActive] = useState<boolean>(initialShowWireframe);
    const [statsVisible, setStatsVisible] = useState<boolean>(initialShowStats);
    const [isDownloading, setIsDownloading] = useState<boolean>(false);

    // Synchronize prop updates
    useEffect(() => {
      setBgColor(backgroundColor);
    }, [backgroundColor]);

    useEffect(() => {
      setGridVisible(initialShowGrid);
    }, [initialShowGrid]);

    useEffect(() => {
      setWireframeActive(initialShowWireframe);
    }, [initialShowWireframe]);

    // Model loader hook
    const { model, stats, isLoading, progress, error, reload } = useModelLoader({
      src,
      onLoading,
      onProgress,
      onLoad,
      onError,
    });

    /**
     * Traverses current model meshes and toggles wireframe property
     */
    const applyWireframe = useCallback((enabled: boolean) => {
      if (!currentModelGroupRef.current) return;

      currentModelGroupRef.current.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (mesh.material) {
            if (Array.isArray(mesh.material)) {
              for (const mat of mesh.material) {
                if (mat && 'wireframe' in mat) {
                  (mat as { wireframe: boolean }).wireframe = enabled;
                }
              }
            } else if ('wireframe' in mesh.material) {
              (mesh.material as { wireframe: boolean }).wireframe = enabled;
            }
          }
        }
      });
    }, []);

    /**
     * Centers and frames the camera around the current model's bounds
     */
    const autoFrame = useCallback(() => {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      const currentModel = currentModelGroupRef.current;

      if (!camera || !controls || !currentModel) return;

      const bounds = calculateModelBounds(currentModel);
      const center = new THREE.Vector3(...bounds.center);
      const maxDim = Math.max(...bounds.size);

      // Position camera so object fits within FOV comfortably
      const fovRad = (camera.fov * Math.PI) / 180;
      let cameraDistance = Math.abs(maxDim / 2 / Math.tan(fovRad / 2));
      cameraDistance = Math.max(cameraDistance * 1.5, 1.2);

      // Preserve current view angle direction, or default isometric offset
      const currentDir = new THREE.Vector3().subVectors(camera.position, controls.target);
      if (currentDir.lengthSq() < 0.001) {
        currentDir.set(1, 0.8, 1.2);
      }
      currentDir.normalize().multiplyScalar(cameraDistance);

      camera.position.copy(center).add(currentDir);
      controls.target.copy(center);
      camera.lookAt(center);
      controls.update();

      // Adjust camera near/far planes based on model size
      camera.near = Math.max(0.01, cameraDistance / 100);
      camera.far = Math.max(1000, cameraDistance * 100);
      camera.updateProjectionMatrix();

      // Store as default for camera resets
      defaultCameraPosRef.current.copy(camera.position);
      defaultTargetRef.current.copy(center);
    }, []);

    /**
     * Resets camera back to default framed viewpoint
     */
    const resetCamera = useCallback(() => {
      const camera = cameraRef.current;
      const controls = controlsRef.current;

      if (!camera || !controls) return;

      camera.position.copy(defaultCameraPosRef.current);
      controls.target.copy(defaultTargetRef.current);
      camera.lookAt(defaultTargetRef.current);
      controls.update();

      onCameraReset?.();
    }, [onCameraReset]);

    /**
     * Sets camera to predefined orthogonal/isometric presets
     */
    const setCameraPreset = useCallback((preset: CameraPreset) => {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (!camera || !controls) return;

      const target = controls.target.clone();
      const dist = camera.position.distanceTo(target) || 3;

      switch (preset) {
        case 'front':
          camera.position.set(target.x, target.y, target.z + dist);
          break;
        case 'back':
          camera.position.set(target.x, target.y, target.z - dist);
          break;
        case 'top':
          camera.position.set(target.x, target.y + dist, target.z + 0.0001);
          break;
        case 'bottom':
          camera.position.set(target.x, target.y - dist, target.z + 0.0001);
          break;
        case 'left':
          camera.position.set(target.x - dist, target.y, target.z);
          break;
        case 'right':
          camera.position.set(target.x + dist, target.y, target.z);
          break;
        case 'isometric':
        default: {
          const isoDist = dist / Math.sqrt(3);
          camera.position.set(target.x + isoDist, target.y + isoDist, target.z + isoDist);
          break;
        }
      }

      camera.lookAt(target);
      controls.update();
    }, []);

    /**
     * Download helper triggered from viewer
     */
    const handleDownload = useCallback(
      async (filename = downloadFilename): Promise<Blob> => {
        if (!src) {
          throw new Error('No 3D model source available to download');
        }

        setIsDownloading(true);
        try {
          const blob = await downloadGlbBlob(src, filename);
          triggerBlobDownload(blob, filename);
          return blob;
        } finally {
          setIsDownloading(false);
        }
      },
      [src, downloadFilename]
    );

    // Expose imperative API through ref
    useImperativeHandle(
      ref,
      () => ({
        resetCamera,
        autoFrame,
        setCameraPreset,
        toggleGrid: () => setGridVisible((v) => !v),
        toggleWireframe: () => {
          setWireframeActive((prev) => {
            const next = !prev;
            applyWireframe(next);
            return next;
          });
        },
        setWireframe: (enabled: boolean) => {
          setWireframeActive(enabled);
          applyWireframe(enabled);
        },
        setBackgroundColor: (color: string) => {
          setBgColor(color);
        },
        downloadGlb: handleDownload,
        getStats: () => stats,
        getModel: () => currentModelGroupRef.current,
      }),
      [resetCamera, autoFrame, setCameraPreset, applyWireframe, handleDownload, stats]
    );

    /**
     * Setup Three.js scene, camera, lights, renderer, and controls on mount
     */
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const width = container.clientWidth || 600;
      const height = container.clientHeight || 450;

      // 1. Scene
      const scene = new THREE.Scene();
      sceneRef.current = scene;

      // 2. Camera
      const initialPos = initialCameraPosition || [2.5, 2.0, 3.5];
      const camera = new THREE.PerspectiveCamera(cameraFov, width / height, 0.05, 1000);
      camera.position.set(initialPos[0], initialPos[1], initialPos[2]);
      cameraRef.current = camera;
      defaultCameraPosRef.current.set(initialPos[0], initialPos[1], initialPos[2]);

      // 3. Renderer with antialiasing and correct color management
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      rendererRef.current = renderer;
      container.appendChild(renderer.domElement);

      // 4. OrbitControls
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.screenSpacePanning = true;
      controls.minDistance = 0.1;
      controls.maxDistance = 500;
      controls.maxPolarAngle = Math.PI; // Full orbit
      controlsRef.current = controls;

      // 5. Grid Helper
      const grid = new THREE.GridHelper(10, 20, 0x555555, 0x2e3238);
      grid.position.y = 0;
      gridRef.current = grid;
      scene.add(grid);

      // 6. Orientation Axes
      const axes = new THREE.AxesHelper(1.5);
      axes.visible = initialShowAxes;
      axesRef.current = axes;
      scene.add(axes);

      // 7. Lighting Group
      const lightsGroup = new THREE.Group();
      lightsGroupRef.current = lightsGroup;

      const setupLighting = (preset: LightingPreset, intensityMultiplier: number) => {
        lightsGroup.clear();

        let ambientColor = 0xffffff;
        let ambientIntensity = 0.8 * intensityMultiplier;
        let keyColor = 0xffffff;
        let keyIntensity = 1.5 * intensityMultiplier;
        let fillColor = 0x90b0e0;
        let fillIntensity = 0.7 * intensityMultiplier;

        if (preset === 'warm') {
          ambientColor = 0xfff0e0;
          keyColor = 0xffe8c0;
          fillColor = 0xd09060;
        } else if (preset === 'cool') {
          ambientColor = 0xe0f0ff;
          keyColor = 0xd8eeff;
          fillColor = 0x7090c0;
        } else if (preset === 'minimal') {
          ambientIntensity = 1.2 * intensityMultiplier;
          keyIntensity = 0.6 * intensityMultiplier;
          fillIntensity = 0.3 * intensityMultiplier;
        }

        const ambientLight = new THREE.AmbientLight(ambientColor, ambientIntensity);
        lightsGroup.add(ambientLight);

        // Key light
        const keyLight = new THREE.DirectionalLight(keyColor, keyIntensity);
        keyLight.position.set(5, 8, 5);
        lightsGroup.add(keyLight);

        // Fill light
        const fillLight = new THREE.DirectionalLight(fillColor, fillIntensity);
        fillLight.position.set(-5, 3, -4);
        lightsGroup.add(fillLight);

        // Rim / back light
        const rimLight = new THREE.DirectionalLight(0xffffff, 0.5 * intensityMultiplier);
        rimLight.position.set(0, 6, -6);
        lightsGroup.add(rimLight);
      };

      setupLighting(lighting, lightingIntensity);
      scene.add(lightsGroup);

      // 8. Animation & Render Loop
      const animate = () => {
        animationFrameIdRef.current = requestAnimationFrame(animate);

        if (controlsRef.current) {
          if (autoRotate) {
            controlsRef.current.autoRotate = true;
            controlsRef.current.autoRotateSpeed = autoRotateSpeed;
          } else {
            controlsRef.current.autoRotate = false;
          }
          controlsRef.current.update();
        }

        if (rendererRef.current && sceneRef.current && cameraRef.current) {
          rendererRef.current.render(sceneRef.current, cameraRef.current);
        }
      };

      animate();

      // 9. Resize Handling via ResizeObserver
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width: newW, height: newH } = entry.contentRect;
          if (newW > 0 && newH > 0 && rendererRef.current && cameraRef.current) {
            cameraRef.current.aspect = newW / newH;
            cameraRef.current.updateProjectionMatrix();
            rendererRef.current.setSize(newW, newH);
          }
        }
      });

      resizeObserver.observe(container);

      // Cleanup on unmount
      return () => {
        resizeObserver.disconnect();
        if (animationFrameIdRef.current !== null) {
          cancelAnimationFrame(animationFrameIdRef.current);
          animationFrameIdRef.current = null;
        }

        if (controlsRef.current) {
          controlsRef.current.dispose();
          controlsRef.current = null;
        }

        if (currentModelGroupRef.current) {
          scene.remove(currentModelGroupRef.current);
          disposeThreeObject(currentModelGroupRef.current);
          currentModelGroupRef.current = null;
        }

        disposeThreeObject(lightsGroup);
        disposeThreeObject(grid);
        disposeThreeObject(axes);
        disposeThreeObject(scene);

        disposeRenderer(rendererRef.current);
        rendererRef.current = null;
        sceneRef.current = null;
        cameraRef.current = null;
      };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Update grid visibility
    useEffect(() => {
      if (gridRef.current) {
        gridRef.current.visible = gridVisible;
      }
    }, [gridVisible]);

    // Update axes visibility
    useEffect(() => {
      if (axesRef.current) {
        axesRef.current.visible = initialShowAxes;
      }
    }, [initialShowAxes]);

    // Attach loaded model to scene and frame camera
    useEffect(() => {
      const scene = sceneRef.current;
      if (!scene) return;

      // Remove existing model from scene
      if (currentModelGroupRef.current) {
        scene.remove(currentModelGroupRef.current);
        currentModelGroupRef.current = null;
      }

      if (model) {
        currentModelGroupRef.current = model;
        scene.add(model);

        // Apply current wireframe mode to newly loaded model
        applyWireframe(wireframeActive);

        // Auto-frame camera to model bounds
        autoFrame();
      }
    }, [model, autoFrame, applyWireframe, wireframeActive]);

    // Update wireframe when state changes
    useEffect(() => {
      applyWireframe(wireframeActive);
    }, [wireframeActive, applyWireframe]);

    return (
      <div
        ref={containerRef}
        className={`relative w-full h-full min-h-[300px] overflow-hidden select-none ${className}`}
        style={{
          backgroundColor: bgColor,
          ...style,
        }}
        aria-label={alt}
        role="region"
      >
        {/* Loading Indicator */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs z-20 pointer-events-none transition-opacity">
            {loadingFallback || (
              <div className="flex flex-col items-center gap-3 p-4 bg-zinc-900/90 border border-zinc-800 rounded-xl shadow-2xl">
                <div
                  className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"
                  role="status"
                  aria-label="Loading model..."
                />
                <div className="text-xs font-medium text-zinc-300">
                  Loading 3D asset{progress > 0 ? ` (${progress}%)` : '...'}
                </div>
                {progress > 0 && (
                  <div className="w-36 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 transition-all duration-150"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Error Notification Overlay */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-black/75 z-20 text-center">
            <div className="max-w-md p-5 bg-zinc-900 border border-red-500/30 rounded-xl shadow-2xl">
              <div className="w-10 h-10 mx-auto mb-3 text-red-400 flex items-center justify-center rounded-full bg-red-950/50 border border-red-800/40">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h4 className="text-sm font-semibold text-zinc-100 mb-1">Failed to Load 3D Asset</h4>
              <p className="text-xs text-zinc-400 mb-4 leading-relaxed">{error.message}</p>
              <button
                type="button"
                onClick={reload}
                className="px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-100 rounded-lg border border-zinc-700 transition-colors cursor-pointer"
              >
                Retry Loading
              </button>
            </div>
          </div>
        )}

        {/* Floating Toolbar Controls */}
        {showControls && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900/85 backdrop-blur-md border border-zinc-800/80 rounded-full shadow-xl">
            {/* Reset Camera */}
            <button
              type="button"
              onClick={resetCamera}
              title="Reset Camera View"
              className="p-1.5 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-full transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>

            {/* Auto-Frame */}
            <button
              type="button"
              onClick={autoFrame}
              title="Auto-Frame Model"
              className="p-1.5 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-full transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8V5a2 2 0 012-2h3m10 0h3a2 2 0 012 2v3m0 8v3a2 2 0 01-2 2h-3M8 21H5a2 2 0 01-2-2v-3"
                />
              </svg>
            </button>

            <div className="w-[1px] h-4 bg-zinc-700/60 mx-0.5" />

            {/* Wireframe Toggle */}
            <button
              type="button"
              onClick={() => {
                setWireframeActive((prev) => {
                  const next = !prev;
                  applyWireframe(next);
                  return next;
                });
              }}
              title="Toggle Wireframe Mode"
              className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                wireframeActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </button>

            {/* Grid Toggle */}
            <button
              type="button"
              onClick={() => setGridVisible((v) => !v)}
              title="Toggle Floor Grid"
              className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                gridVisible
                  ? 'bg-zinc-700 text-white'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16M6 4v16M12 4v16M18 4v16"
                />
              </svg>
            </button>

            {/* Background Color Switcher */}
            <button
              type="button"
              onClick={() => {
                setBgColor((prev) => {
                  if (prev === '#121316') return '#262930';
                  if (prev === '#262930') return '#f3f4f6';
                  return '#121316';
                });
              }}
              title="Cycle Background Tone"
              className="p-1.5 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-full transition-colors cursor-pointer"
            >
              <div
                className="w-3.5 h-3.5 rounded-full border border-zinc-500"
                style={{ backgroundColor: bgColor }}
              />
            </button>

            {/* Model Stats Toggle */}
            <button
              type="button"
              onClick={() => setStatsVisible((v) => !v)}
              title="Inspect Geometry Bounds & Stats"
              className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                statsVisible
                  ? 'bg-zinc-700 text-white'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </button>

            <div className="w-[1px] h-4 bg-zinc-700/60 mx-0.5" />

            {/* Download GLB Button */}
            <button
              type="button"
              onClick={() => void handleDownload()}
              disabled={!src || isDownloading}
              title="Download Verified GLB"
              className="p-1.5 text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-40 disabled:pointer-events-none rounded-full transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
            </button>
          </div>
        )}

        {/* Inspect Model Stats Overlay */}
        {statsVisible && stats && (
          <div className="absolute top-4 right-4 z-10 p-3 bg-zinc-900/90 backdrop-blur-md border border-zinc-800 rounded-xl shadow-xl text-xs text-zinc-300 space-y-1.5 min-w-[200px]">
            <div className="flex items-center justify-between pb-1 border-b border-zinc-800">
              <span className="font-semibold text-zinc-100">Model Inspection</span>
              <button
                type="button"
                onClick={() => setStatsVisible(false)}
                className="text-zinc-500 hover:text-zinc-300 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Triangles:</span>
              <span className="font-mono text-zinc-200">{stats.triangleCount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Vertices:</span>
              <span className="font-mono text-zinc-200">{stats.vertexCount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Meshes:</span>
              <span className="font-mono text-zinc-200">{stats.meshCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Materials:</span>
              <span className="font-mono text-zinc-200">{stats.materialCount}</span>
            </div>
            <div className="pt-1 border-t border-zinc-800/80">
              <span className="text-zinc-400 block mb-0.5">Dimensions (X, Y, Z):</span>
              <span className="font-mono text-[11px] text-zinc-200 block">
                {stats.bounds.size[0].toFixed(2)} × {stats.bounds.size[1].toFixed(2)} ×{' '}
                {stats.bounds.size[2].toFixed(2)}
              </span>
            </div>
            {stats.fileSizeBytes && (
              <div className="flex justify-between pt-1 border-t border-zinc-800/80">
                <span className="text-zinc-400">File Size:</span>
                <span className="font-mono text-zinc-200">
                  {(stats.fileSizeBytes / 1024).toFixed(1)} KB
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);

ModelViewer.displayName = 'ModelViewer';
export default ModelViewer;
