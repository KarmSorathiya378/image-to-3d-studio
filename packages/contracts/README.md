# @image-to-3d/contracts

Canonical SceneSpec v1 schema, shared DTOs, and validation contracts for AI Image-to-3D Studio.

## Architecture

This package is the **single source of truth** for all geometric and service contracts:
- **Python (Pydantic v2):** `image_to_3d_contracts.scenespec` and `image_to_3d_contracts.dto`
- **JSON Schema:** `schemas/scenespec.v1.json`
- **TypeScript:** `packages/contracts/ts/src/index.ts`

## SceneSpec v1 Capabilities

- **Scene Metadata:** Object name, description, schema version (`1.0`), generator provenance, timestamps.
- **Coordinate System & Units:** Explicit `Z_UP` / `Y_UP`, metric (`meters`, `centimeters`, `millimeters`) and `relative`.
- **Primitives Supported:** `box`, `cylinder`, `sphere`, `cone`, `plane`, `capsule`, `torus`, `extrudedPolygon`, `lathe`, `parameterizedCurve`.
- **Component Hierarchy & Transforms:** Parent-child links (DAG-verified, no cycles), local position `[x,y,z]`, rotation `[rx,ry,rz]`, scale `[sx,sy,sz]`.
- **Mesh Modifiers:** `boolean` (union/diff/intersection), `bevel`, `solidify`, `subdivision`, `mirror`.
- **PBR Materials:** Base color (hex format), roughness, metallic, emissive, opacity, alpha mode.
- **Camera & Lighting:** Perspective FOV, lookAt target, directional/point/spot lights.
- **Safety Constraints:** N-fold finite number checks (rejects NaN, Infinity), strict positive dimension bounds, clamped physical values.
