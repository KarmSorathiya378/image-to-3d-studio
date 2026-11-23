# @image-to-3d/viewer

Interactive Three.js and React Three Fiber 3D GLB Viewer for the **AI Image-to-3D Studio**.

## Overview

The viewer renders real exported geometry from the backend pipeline (`.glb` binary assets), providing:
- **OrbitControls**: Orbit (rotate), zoom, and pan with smooth damping.
- **Auto-Frame**: Automatically bounds the model and positions the camera for an optimal view.
- **Camera Controls**: Reset camera view, predefined angles (`front`, `back`, `top`, `bottom`, `left`, `right`, `isometric`).
- **Lighting Controls**: Multi-point lighting presets (`studio`, `outdoor`, `warm`, `cool`, `minimal`) with intensity adjustments.
- **Material & Wireframe Mode**: Traverses mesh hierarchy and toggles wireframe rendering while preserving base material parameters.
- **Floor Grid & Axes**: Toggleable ground grid helper and coordinate axes.
- **Background Tone**: Dynamic background color switcher (dark, neutral, studio light).
- **Model Inspection**: Real-time bounds dimensions (X, Y, Z), triangle count, vertex count, and mesh count overlay.
- **Download Helper**: Downloads the exact real GLB binary as a `Blob` (`downloadGlbBlob` and `triggerBlobDownload`).
- **Resource Disposal**: Complete disposal of geometries, materials, textures, scene objects, and WebGL contexts on unmount to eliminate memory leaks.
- **Error Handling**: Graceful error UI with user-friendly retry mechanism for corrupt or failed assets.

---

## Installation & Import

Import directly in `apps/web` or any React client component:

```tsx
'use client';

import { ModelViewer, type ViewerControlsRef } from '@image-to-3d/viewer';
import { useRef } from 'react';

export function StudioViewport({ glbUrl }: { glbUrl: string }) {
  const viewerRef = useRef<ViewerControlsRef>(null);

  return (
    <div className="w-full h-[600px] rounded-xl overflow-hidden">
      <ModelViewer
        ref={viewerRef}
        src={glbUrl}
        backgroundColor="#121316"
        showGrid={true}
        showWireframe={false}
        lighting="studio"
        downloadFilename="my-generated-model.glb"
        onLoad={(stats) => {
          console.log(`Loaded ${stats.triangleCount} triangles across ${stats.meshCount} meshes`);
        }}
        onError={(err) => {
          console.error('Failed to load 3D model:', err);
        }}
      />
    </div>
  );
}
```

---

## Imperative Controls API (`ViewerControlsRef`)

```tsx
const viewerRef = useRef<ViewerControlsRef>(null);

// Reset camera to initial viewpoint
viewerRef.current?.resetCamera();

// Center and frame camera to model bounding box
viewerRef.current?.autoFrame();

// Set camera angle preset
viewerRef.current?.setCameraPreset('isometric');

// Toggle wireframe mode
viewerRef.current?.toggleWireframe();

// Toggle floor grid
viewerRef.current?.toggleGrid();

// Download verified GLB binary
const blob = await viewerRef.current?.downloadGlb('custom-name.glb');

// Access geometric statistics
const stats = viewerRef.current?.getStats();
```

---

## Download Helper

```ts
import { downloadGlbBlob, triggerBlobDownload } from '@image-to-3d/viewer';

// 1. Fetch GLB as a real binary Blob
const blob = await downloadGlbBlob(modelUrl, 'stool.glb');

// 2. Trigger browser download
triggerBlobDownload(blob, 'stool.glb');
```

---

## Testing

Run unit tests verifying bounds calculation, resource disposal, real GLB binary loading, wireframe traversal, and download helpers:

```bash
cd packages/viewer
node --experimental-strip-types --test tests/**/*.test.ts
```
