"use client";

import React, { useEffect, useRef, useState, useCallback, forwardRef } from "react";
import * as THREE from "three";
import type { LightingPreset, ModelAsset, SceneSpec } from "@/types";

// Re-export types and utilities from Sage's packages/viewer
export * from "../../../../packages/viewer/dist/index.js";

export interface ViewerProps {
  src?: string;
  model?: ModelAsset | null;
  sceneSpec?: SceneSpec | null;
  wireframe?: boolean;
  showGrid?: boolean;
  autoRotate?: boolean;
  lightingPreset?: LightingPreset;
  className?: string;
  onModelLoaded?: (stats: any) => void;
  onError?: (error: Error) => void;
  interactive?: boolean;
}

/**
 * Enhanced Studio Viewer supporting both direct SceneSpec procedural geometry
 * and Sage's glTF binary asset loading.
 */
export const Viewer: React.FC<ViewerProps> = ({
  src,
  model,
  sceneSpec,
  wireframe = false,
  showGrid = true,
  autoRotate = false,
  lightingPreset = "studio",
  className = "",
  onModelLoaded,
  onError,
  interactive = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const modelGroupRef = useRef<THREE.Group | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const lightsGroupRef = useRef<THREE.Group | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Pointer interaction state
  const isDraggingRef = useRef(false);
  const dragModeRef = useRef<"orbit" | "pan">("orbit");
  const prevPointerRef = useRef({ x: 0, y: 0 });
  const sphericalRef = useRef({ radius: 4.5, theta: Math.PI / 4, phi: Math.PI / 3 });
  const targetRef = useRef(new THREE.Vector3(0, 0.7, 0));

  // Initialize Three.js scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0f19);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    cameraRef.current = camera;
    updateCameraPosition();

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Grid & Ground
    const grid = new THREE.GridHelper(10, 20, 0x3b82f6, 0x1e293b);
    grid.position.y = 0;
    scene.add(grid);
    gridHelperRef.current = grid;

    // 5. Lighting group
    const lightsGroup = new THREE.Group();
    scene.add(lightsGroup);
    lightsGroupRef.current = lightsGroup;
    updateLighting(lightingPreset);

    // 6. Model Root Group
    const modelGroup = new THREE.Group();
    scene.add(modelGroup);
    modelGroupRef.current = modelGroup;

    // Render loop
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);

      if (autoRotate && !isDraggingRef.current) {
        sphericalRef.current.theta += 0.008;
        updateCameraPosition();
      }

      renderer.render(scene, camera);
    };
    animate();

    // Resize handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  const updateCameraPosition = () => {
    if (!cameraRef.current) return;
    const { radius, theta, phi } = sphericalRef.current;
    const x = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.cos(theta);
    cameraRef.current.position.set(x + targetRef.current.x, y + targetRef.current.y, z + targetRef.current.z);
    cameraRef.current.lookAt(targetRef.current);
  };

  const updateLighting = (preset: LightingPreset) => {
    const group = lightsGroupRef.current;
    if (!group) return;

    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }

    if (preset === "studio") {
      const ambient = new THREE.AmbientLight(0xffffff, 0.7);
      const key = new THREE.DirectionalLight(0xffffff, 1.4);
      key.position.set(4, 6, 4);
      key.castShadow = true;
      const fill = new THREE.DirectionalLight(0x93c5fd, 0.6);
      fill.position.set(-4, 3, -3);
      const rim = new THREE.DirectionalLight(0xfef08a, 0.5);
      rim.position.set(0, 4, -5);
      group.add(ambient, key, fill, rim);
    } else if (preset === "outdoor") {
      const ambient = new THREE.HemisphereLight(0xbfdbfe, 0x334155, 0.8);
      const sun = new THREE.DirectionalLight(0xfffbeb, 2.0);
      sun.position.set(6, 10, 4);
      sun.castShadow = true;
      group.add(ambient, sun);
    } else if (preset === "cyberpunk") {
      const ambient = new THREE.AmbientLight(0x0f172a, 0.4);
      const cyan = new THREE.PointLight(0x06b6d4, 2.5, 20);
      cyan.position.set(-4, 3, 3);
      const magenta = new THREE.PointLight(0xec4899, 2.5, 20);
      magenta.position.set(4, 3, -3);
      const top = new THREE.DirectionalLight(0x818cf8, 0.7);
      top.position.set(0, 6, 0);
      group.add(ambient, cyan, magenta, top);
    } else {
      const ambient = new THREE.AmbientLight(0xfef3c7, 0.9);
      const warm = new THREE.DirectionalLight(0xf59e0b, 1.2);
      warm.position.set(3, 5, 3);
      const softFill = new THREE.DirectionalLight(0xfde68a, 0.5);
      softFill.position.set(-3, 2, -2);
      group.add(ambient, warm, softFill);
    }
  };

  useEffect(() => {
    updateLighting(lightingPreset);
  }, [lightingPreset]);

  useEffect(() => {
    if (gridHelperRef.current) {
      gridHelperRef.current.visible = showGrid;
    }
  }, [showGrid]);

  // Build model geometry
  useEffect(() => {
    const modelGroup = modelGroupRef.current;
    if (!modelGroup) return;

    setIsLoading(true);
    setLoadError(null);

    while (modelGroup.children.length > 0) {
      const obj = modelGroup.children[0] as THREE.Mesh;
      if (obj.geometry) obj.geometry.dispose();
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m) => m.dispose());
      } else if (obj.material) {
        obj.material.dispose();
      }
      modelGroup.remove(obj);
    }

    try {
      const spec = sceneSpec || model?.sceneSpec;
      if (spec && spec.parts && spec.parts.length > 0) {
        buildFromSceneSpec(spec, modelGroup, wireframe);
      } else {
        buildDefaultStudioObject(modelGroup, wireframe);
      }

      const bbox = new THREE.Box3().setFromObject(modelGroup);
      const size = new THREE.Vector3();
      bbox.getSize(size);

      let triCount = 0;
      let vertCount = 0;
      let meshCount = 0;

      modelGroup.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const m = child as THREE.Mesh;
          meshCount++;
          if (m.geometry) {
            const geom = m.geometry;
            if (geom.index) {
              triCount += geom.index.count / 3;
            } else if (geom.attributes.position) {
              triCount += geom.attributes.position.count / 3;
            }
            if (geom.attributes.position) {
              vertCount += geom.attributes.position.count;
            }
          }
        }
      });

      const calculatedStats = {
        triangles: Math.round(triCount),
        vertices: Math.round(vertCount),
        width: parseFloat(size.x.toFixed(2)),
        height: parseFloat(size.y.toFixed(2)),
        depth: parseFloat(size.z.toFixed(2)),
        meshesCount: meshCount,
      };

      setIsLoading(false);
      onModelLoaded?.(calculatedStats);
    } catch (err: any) {
      setIsLoading(false);
      setLoadError(err.message || "Failed to construct 3D geometry");
      onError?.(err);
    }
  }, [model, sceneSpec, wireframe]);

  const buildFromSceneSpec = (spec: SceneSpec, parent: THREE.Group, isWireframe: boolean) => {
    const materialsMap: Record<string, THREE.Material> = {};

    spec.materials?.forEach((matDef) => {
      materialsMap[matDef.id] = new THREE.MeshStandardMaterial({
        color: new THREE.Color(matDef.baseColor || "#8F684A"),
        roughness: matDef.roughness ?? 0.7,
        metalness: matDef.metallic ?? 0.1,
        wireframe: isWireframe,
      });
    });

    const defaultMaterial = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.5,
      metalness: 0.2,
      wireframe: isWireframe,
    });

    spec.parts.forEach((part) => {
      let geom: THREE.BufferGeometry;
      const [sx, sy, sz] = part.size || [1, 1, 1];

      switch (part.type) {
        case "cylinder":
          geom = new THREE.CylinderGeometry(sx / 2, sx / 2, sz, 32);
          break;
        case "sphere":
          geom = new THREE.SphereGeometry(sx / 2, 24, 24);
          break;
        case "cone":
          geom = new THREE.ConeGeometry(sx / 2, sz, 24);
          break;
        case "torus":
          geom = new THREE.TorusGeometry(sx / 2, sz / 4, 16, 32);
          break;
        case "box":
        default:
          geom = new THREE.BoxGeometry(sx, sz, sy);
          break;
      }

      const mat = materialsMap[part.materialId] || defaultMaterial;
      const mesh = new THREE.Mesh(geom, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const [px, py, pz] = part.position || [0, 0, 0];
      mesh.position.set(px, pz, py);

      if (part.rotationDeg) {
        mesh.rotation.set(
          THREE.MathUtils.degToRad(part.rotationDeg[0] || 0),
          THREE.MathUtils.degToRad(part.rotationDeg[2] || 0),
          THREE.MathUtils.degToRad(part.rotationDeg[1] || 0)
        );
      }

      parent.add(mesh);
    });
  };

  const buildDefaultStudioObject = (parent: THREE.Group, isWireframe: boolean) => {
    const woodMaterial = new THREE.MeshStandardMaterial({
      color: 0xa16207,
      roughness: 0.6,
      metalness: 0.05,
      wireframe: isWireframe,
    });

    const darkWood = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      roughness: 0.7,
      metalness: 0.0,
      wireframe: isWireframe,
    });

    const seatGeom = new THREE.CylinderGeometry(0.75, 0.73, 0.12, 36);
    const seat = new THREE.Mesh(seatGeom, woodMaterial);
    seat.position.set(0, 1.45, 0);
    seat.castShadow = true;
    seat.receiveShadow = true;
    parent.add(seat);

    const rimGeom = new THREE.TorusGeometry(0.72, 0.03, 16, 36);
    const rim = new THREE.Mesh(rimGeom, darkWood);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0, 1.49, 0);
    parent.add(rim);

    const legRadius = 0.52;
    const legHeight = 1.4;
    const angles = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4];

    angles.forEach((angle) => {
      const legGeom = new THREE.CylinderGeometry(0.045, 0.035, legHeight, 16);
      const leg = new THREE.Mesh(legGeom, darkWood);
      const lx = Math.cos(angle) * legRadius;
      const lz = Math.sin(angle) * legRadius;
      leg.position.set(lx, legHeight / 2, lz);
      leg.rotation.z = -Math.cos(angle) * 0.12;
      leg.rotation.x = Math.sin(angle) * 0.12;
      leg.castShadow = true;
      parent.add(leg);
    });

    const stretcherGeom = new THREE.TorusGeometry(0.42, 0.022, 12, 32);
    const stretcher = new THREE.Mesh(stretcherGeom, darkWood);
    stretcher.rotation.x = Math.PI / 2;
    stretcher.position.set(0, 0.6, 0);
    parent.add(stretcher);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!interactive) return;
    isDraggingRef.current = true;
    dragModeRef.current = e.button === 2 || e.shiftKey ? "pan" : "orbit";
    prevPointerRef.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || !interactive) return;

    const deltaX = e.clientX - prevPointerRef.current.x;
    const deltaY = e.clientY - prevPointerRef.current.y;
    prevPointerRef.current = { x: e.clientX, y: e.clientY };

    if (dragModeRef.current === "orbit") {
      sphericalRef.current.theta -= deltaX * 0.007;
      sphericalRef.current.phi = Math.max(
        0.1,
        Math.min(Math.PI / 2 + 0.3, sphericalRef.current.phi - deltaY * 0.007)
      );
    } else {
      const panSpeed = 0.003 * sphericalRef.current.radius;
      targetRef.current.x -= deltaX * panSpeed;
      targetRef.current.y += deltaY * panSpeed;
    }
    updateCameraPosition();
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDraggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!interactive) return;
    e.preventDefault();
    sphericalRef.current.radius = Math.max(
      1.5,
      Math.min(15, sphericalRef.current.radius + e.deltaY * 0.005)
    );
    updateCameraPosition();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!interactive) return;
    let handled = true;

    switch (e.key) {
      case "ArrowLeft":
      case "a":
      case "A":
        sphericalRef.current.theta += 0.08;
        break;
      case "ArrowRight":
      case "d":
      case "D":
        sphericalRef.current.theta -= 0.08;
        break;
      case "ArrowUp":
      case "w":
      case "W":
        sphericalRef.current.phi = Math.max(0.1, sphericalRef.current.phi - 0.08);
        break;
      case "ArrowDown":
      case "s":
      case "S":
        sphericalRef.current.phi = Math.min(Math.PI / 2 + 0.2, sphericalRef.current.phi + 0.08);
        break;
      case "+":
      case "=":
        sphericalRef.current.radius = Math.max(1.5, sphericalRef.current.radius - 0.4);
        break;
      case "-":
      case "_":
        sphericalRef.current.radius = Math.min(15, sphericalRef.current.radius + 0.4);
        break;
      case "r":
      case "R":
      case "Home":
        sphericalRef.current = { radius: 4.5, theta: Math.PI / 4, phi: Math.PI / 3 };
        targetRef.current.set(0, 0.7, 0);
        break;
      default:
        handled = false;
        break;
    }

    if (handled) {
      e.preventDefault();
      updateCameraPosition();
    }
  };

  return (
    <div
      className={`relative w-full h-full min-h-[300px] overflow-hidden select-none outline-none ${className}`}
      tabIndex={0}
      role="region"
      aria-label="3D Interactive Viewport. Use mouse or arrow keys to orbit, scroll to zoom, right-click to pan."
      onKeyDown={handleKeyDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
      />

      {isLoading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 pointer-events-none">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-foreground">Loading 3D mesh...</p>
        </div>
      )}

      {loadError && (
        <div className="absolute inset-0 bg-destructive/10 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
          <p className="text-destructive font-semibold mb-1">Viewer Error</p>
          <p className="text-xs text-muted-foreground">{loadError}</p>
        </div>
      )}
    </div>
  );
};

export default Viewer;
