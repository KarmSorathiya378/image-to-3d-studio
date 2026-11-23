/**
 * @image-to-3d/viewer
 * Interactive 3D GLB Viewer for Image-to-3D Studio
 */

export { ModelViewer, default } from './components/ModelViewer.js';
export { ModelSceneGraph } from './components/r3f/ModelViewerR3F.js';
export { useModelLoader } from './hooks/useModelLoader.js';

export {
  calculateModelBounds,
  calculateModelStats,
} from './utils/bounds.js';

export {
  disposeThreeObject,
  disposeRenderer,
  disposeMaterial,
} from './utils/disposal.js';

export {
  downloadGlbBlob,
  triggerBlobDownload,
} from './utils/download.js';

export {
  createBoxGlbBuffer,
  createBoxGlbBlob,
} from './utils/gltf-fixture.js';

export type {
  ModelViewerProps,
  ViewerControlsRef,
  ModelBounds,
  ModelStats,
  CameraPreset,
  LightingPreset,
} from './types.js';

export type {
  UseModelLoaderOptions,
  UseModelLoaderResult,
} from './hooks/useModelLoader.js';

export type {
  R3FSceneContentProps,
} from './components/r3f/ModelViewerR3F.js';
