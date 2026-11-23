import type * as THREE from 'three';

export interface ModelBounds {
  min: [number, number, number];
  max: [number, number, number];
  center: [number, number, number];
  size: [number, number, number];
  radius: number;
}

export interface ModelStats {
  vertexCount: number;
  triangleCount: number;
  meshCount: number;
  materialCount: number;
  bounds: ModelBounds;
  fileSizeBytes?: number;
}

export type CameraPreset = 'front' | 'back' | 'top' | 'bottom' | 'left' | 'right' | 'isometric';

export type LightingPreset = 'studio' | 'outdoor' | 'warm' | 'cool' | 'minimal';

export interface ViewerControlsRef {
  /** Reset camera to initial position and target */
  resetCamera: () => void;
  /** Center and frame the camera to fit the model bounding box */
  autoFrame: () => void;
  /** Set camera to a specific preset angle */
  setCameraPreset: (preset: CameraPreset) => void;
  /** Toggle floor grid display */
  toggleGrid: () => void;
  /** Toggle wireframe mode across all model meshes */
  toggleWireframe: () => void;
  /** Explicitly set wireframe mode */
  setWireframe: (enabled: boolean) => void;
  /** Change background color dynamically */
  setBackgroundColor: (color: string) => void;
  /** Download the current GLB as a real binary Blob */
  downloadGlb: (filename?: string) => Promise<Blob>;
  /** Get current model geometric stats and bounds */
  getStats: () => ModelStats | null;
  /** Access the loaded THREE.Group */
  getModel: () => THREE.Group | null;
}

export interface ModelViewerProps {
  /** URL, Blob, or ArrayBuffer of the GLB 3D model */
  src?: string | Blob | ArrayBuffer | null;
  /** Descriptive label for accessibility */
  alt?: string;
  /** CSS class name for container */
  className?: string;
  /** Inline style for container */
  style?: React.CSSProperties;
  /** Canvas background color (hex, rgb, or 'transparent'). Default: '#121316' */
  backgroundColor?: string;
  /** Show ground grid helper. Default: true */
  showGrid?: boolean;
  /** Render model in wireframe mode. Default: false */
  showWireframe?: boolean;
  /** Show XYZ orientation axes. Default: false */
  showAxes?: boolean;
  /** Automatically rotate model when idle. Default: false */
  autoRotate?: boolean;
  /** Auto rotation speed. Default: 1.0 */
  autoRotateSpeed?: number;
  /** Lighting preset ('studio' | 'outdoor' | 'warm' | 'cool' | 'minimal'). Default: 'studio' */
  lighting?: LightingPreset;
  /** Overall lighting intensity multiplier. Default: 1.0 */
  lightingIntensity?: number;
  /** Initial camera position [x, y, z] */
  initialCameraPosition?: [number, number, number];
  /** Field of view in degrees. Default: 45 */
  cameraFov?: number;
  /** Display floating interactive controls overlay. Default: true */
  showControls?: boolean;
  /** Display model statistics and bounds overlay. Default: false */
  showStats?: boolean;
  /** Custom fallback component while loading */
  loadingFallback?: React.ReactNode;
  /** Filename used when user clicks download. Default: 'model.glb' */
  downloadFilename?: string;
  /** Callback when loading starts or finishes */
  onLoading?: (isLoading: boolean) => void;
  /** Callback for loading progress (0 to 100) */
  onProgress?: (progressPercent: number) => void;
  /** Callback when model successfully loads and passes inspection */
  onLoad?: (stats: ModelStats, model: THREE.Group) => void;
  /** Callback when model loading or rendering encounters an error */
  onError?: (error: Error) => void;
  /** Callback when camera is reset */
  onCameraReset?: () => void;
}
