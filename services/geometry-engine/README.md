# services/geometry-engine

Deterministic Blender LTS compiler and GLB exporter for AI Image-to-3D Studio.

## Overview

The **geometry-engine** service executes procedural mesh generation from validated `SceneSpec` v1 payloads.

### Key Capabilities
- **Non-Fake 3D Pipeline:** Translates declarative primitive hierarchies into verified manifold meshes using headless Blender LTS (`bpy`).
- **Primitive Builders:** Procedural generators for `box`, `cylinder`, `sphere`, `cone`, `plane`, `capsule`, `torus`, `extrudedPolygon`, `lathe`, `parameterizedCurve`.
- **Modifiers:** Procedural `bevel`, `solidify`, `subdivision`, `mirror`, and `boolean` operations.
- **PBR Materials:** Principled BSDF node graphs configuring base color, roughness, metallic, emissive, and opacity.
- **Strict Pre-Validation:** Rejects NaN, infinite coordinates, or out-of-range bounds via `image-to-3d-contracts` before invoking Blender.
- **Automated Verification:** Inspects exported binary glTF 2.0 (`.glb`) files for non-empty triangles (>0), valid normal vectors, finite bounds, and proper glTF chunk layout.

## CLI Usage

```powershell
python -m geometry_engine.compiler --spec fixtures/mug_assembly.json --output fixtures/mug_assembly.glb
```

## Python API

```python
from geometry_engine.compiler import compile_scenespec_to_glb

result = compile_scenespec_to_glb(
    spec_data="fixtures/table_with_legs.json",
    output_glb_path="fixtures/table_with_legs.glb"
)

if result.success:
    print(f"Exported: {result.output_glb_path}")
    print(f"Triangles: {result.validation_report.triangle_count}")
```
