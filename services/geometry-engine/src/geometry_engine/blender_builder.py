"""Headless Blender mesh builder and GLB compiler.

Executed inside Blender using:
    blender --background --factory-startup -P blender_builder.py -- --spec <spec.json> --output <out.glb> [--stats <stats.json>]
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

try:
    import bpy
    import bmesh
except ImportError:
    print("ERROR: blender_builder.py must be executed within Blender's Python environment.", file=sys.stderr)
    sys.exit(1)


def hex_to_linear_rgb(hex_str: str) -> tuple[float, float, float, float]:
    """Convert hex string (#RGB, #RRGGBB, #RRGGBBAA) to linear RGBA floats."""
    hex_clean = hex_str.lstrip("#")
    if len(hex_clean) == 3:
        r = int(hex_clean[0] * 2, 16) / 255.0
        g = int(hex_clean[1] * 2, 16) / 255.0
        b = int(hex_clean[2] * 2, 16) / 255.0
        a = 1.0
    elif len(hex_clean) == 6:
        r = int(hex_clean[0:2], 16) / 255.0
        g = int(hex_clean[2:4], 16) / 255.0
        b = int(hex_clean[4:6], 16) / 255.0
        a = 1.0
    elif len(hex_clean) == 8:
        r = int(hex_clean[0:2], 16) / 255.0
        g = int(hex_clean[2:4], 16) / 255.0
        b = int(hex_clean[4:6], 16) / 255.0
        a = int(hex_clean[6:8], 16) / 255.0
    else:
        return (0.8, 0.8, 0.8, 1.0)

    # Convert sRGB to linear for Blender Principled BSDF
    def srgb_to_linear(c: float) -> float:
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), a)


def clear_scene() -> None:
    """Clear all default objects, meshes, curves, materials, and lights."""
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)

    for mesh in list(bpy.data.meshes):
        bpy.data.meshes.remove(mesh)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat)
    for curve in list(bpy.data.curves):
        bpy.data.curves.remove(curve)
    for light in list(bpy.data.lights):
        bpy.data.lights.remove(light)
    for cam in list(bpy.data.cameras):
        bpy.data.cameras.remove(cam)


def create_material(mat_spec: dict) -> bpy.types.Material:
    """Create a Blender Principled BSDF material from MaterialSpec."""
    mat_id = mat_spec["id"]
    mat = bpy.data.materials.new(name=mat_id)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")

    if bsdf:
        base_color = hex_to_linear_rgb(mat_spec.get("baseColor", "#8F684A"))
        bsdf.inputs["Base Color"].default_value = base_color
        bsdf.inputs["Roughness"].default_value = float(mat_spec.get("roughness", 0.7))
        bsdf.inputs["Metallic"].default_value = float(mat_spec.get("metallic", 0.0))

        if "emissiveColor" in mat_spec and mat_spec["emissiveColor"]:
            emissive_rgba = hex_to_linear_rgb(mat_spec["emissiveColor"])
            if "Emission Color" in bsdf.inputs:
                bsdf.inputs["Emission Color"].default_value = emissive_rgba
            if "Emission Strength" in bsdf.inputs:
                bsdf.inputs["Emission Strength"].default_value = float(mat_spec.get("emissiveIntensity", 1.0))

        opacity = float(mat_spec.get("opacity", 1.0))
        if opacity < 1.0:
            if "Alpha" in bsdf.inputs:
                bsdf.inputs["Alpha"].default_value = opacity
            mat.blend_method = "BLEND"

    return mat


def build_primitive(part: dict) -> bpy.types.Object:
    """Construct individual primitive mesh object based on part specification."""
    part_type = part["type"]
    params = part.get("parameters", {})
    part_id = part["id"]

    bpy.ops.object.select_all(action="DESELECT")

    if part_type == "box":
        size = params.get("size", [1.0, 1.0, 1.0])
        bpy.ops.mesh.primitive_cube_add(size=1.0)
        obj = bpy.context.active_object
        obj.scale = (size[0], size[1], size[2])
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    elif part_type == "cylinder":
        radius = float(params.get("radius", 0.5))
        height = float(params.get("height", 1.0))
        segments = int(params.get("segments", 32))
        cap = bool(params.get("capTop", True) or params.get("capBottom", True))
        end_fill = "NGON" if cap else "NOTHING"
        bpy.ops.mesh.primitive_cylinder_add(
            radius=radius,
            depth=height,
            vertices=segments,
            end_fill_type=end_fill
        )
        obj = bpy.context.active_object

    elif part_type == "sphere":
        radius = float(params.get("radius", 0.5))
        segments = int(params.get("segments", 32))
        ring_count = int(params.get("ringCount", 16))
        bpy.ops.mesh.primitive_uv_sphere_add(
            radius=radius,
            segments=segments,
            ring_count=ring_count
        )
        obj = bpy.context.active_object

    elif part_type == "cone":
        r1 = float(params.get("radiusBottom", 0.5))
        r2 = float(params.get("radiusTop", 0.0))
        height = float(params.get("height", 1.0))
        segments = int(params.get("segments", 32))
        bpy.ops.mesh.primitive_cone_add(
            radius1=r1,
            radius2=r2,
            depth=height,
            vertices=segments
        )
        obj = bpy.context.active_object

    elif part_type == "plane":
        size = params.get("size", [1.0, 1.0])
        bpy.ops.mesh.primitive_plane_add(size=1.0)
        obj = bpy.context.active_object
        obj.scale = (size[0], size[1], 1.0)
        bpy.ops.object.transform_apply(scale=True)

    elif part_type == "capsule":
        radius = float(params.get("radius", 0.25))
        height = float(params.get("height", 1.0))
        segments = int(params.get("segments", 32))
        cyl_height = max(height - 2.0 * radius, 0.01)
        bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=cyl_height, vertices=segments)
        obj = bpy.context.active_object

        bpy.ops.mesh.primitive_uv_sphere_add(
            radius=radius,
            segments=segments,
            location=(0.0, 0.0, cyl_height / 2.0)
        )
        top_sphere = bpy.context.active_object

        bpy.ops.mesh.primitive_uv_sphere_add(
            radius=radius,
            segments=segments,
            location=(0.0, 0.0, -cyl_height / 2.0)
        )
        bot_sphere = bpy.context.active_object

        top_sphere.select_set(True)
        bot_sphere.select_set(True)
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.join()

    elif part_type == "torus":
        major_r = float(params.get("majorRadius", 0.5))
        minor_r = float(params.get("minorRadius", 0.1))
        major_s = int(params.get("majorSegments", 32))
        minor_s = int(params.get("minorSegments", 16))
        bpy.ops.mesh.primitive_torus_add(
            major_radius=major_r,
            minor_radius=minor_r,
            major_segments=major_s,
            minor_segments=minor_s
        )
        obj = bpy.context.active_object

    elif part_type == "extrudedPolygon":
        points = params.get("points", [])
        depth = float(params.get("depth", 0.2))
        mesh = bpy.data.meshes.new(name=f"mesh_{part_id}")
        obj = bpy.data.objects.new(part_id, mesh)
        bpy.context.collection.objects.link(obj)

        bm = bmesh.new()
        verts = [bm.verts.new((float(pt[0]), float(pt[1]), 0.0)) for pt in points]
        if len(verts) >= 3:
            face = bm.faces.new(verts)
            res = bmesh.ops.extrude_face_region(bm, geom=[face])
            extruded_verts = [v for v in res["geom"] if isinstance(v, bmesh.types.BMVert)]
            bmesh.ops.translate(bm, vec=(0.0, 0.0, depth), verts=extruded_verts)
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(mesh)
        bm.free()

    elif part_type == "lathe":
        profile = params.get("profile", [])
        segments = int(params.get("segments", 32))
        angle_rad = math.radians(float(params.get("angleDeg", 360.0)))
        mesh = bpy.data.meshes.new(name=f"lathe_{part_id}")
        obj = bpy.data.objects.new(part_id, mesh)
        bpy.context.collection.objects.link(obj)

        bm = bmesh.new()
        verts = [bm.verts.new((float(pt[0]), 0.0, float(pt[1]))) for pt in profile]
        edges = [bm.edges.new((verts[i], verts[i + 1])) for i in range(len(verts) - 1)]
        bmesh.ops.spin(
            bm,
            geom=verts + edges,
            axis=(0.0, 0.0, 1.0),
            cent=(0.0, 0.0, 0.0),
            angle=angle_rad,
            steps=segments,
            use_duplicate=False
        )
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(mesh)
        bm.free()

    elif part_type == "parameterizedCurve":
        pts = params.get("controlPoints", [])
        radius = float(params.get("radius", 0.05))
        segments = int(params.get("segments", 16))

        curve_data = bpy.data.curves.new(name=f"curve_{part_id}", type="CURVE")
        curve_data.dimensions = "3D"
        curve_data.bevel_depth = radius
        curve_data.bevel_resolution = max(segments // 4, 2)
        curve_data.use_fill_caps = True

        polyline = curve_data.splines.new("POLY")
        polyline.points.add(len(pts) - 1)
        for i, pt in enumerate(pts):
            polyline.points[i].co = (float(pt[0]), float(pt[1]), float(pt[2]), 1.0)

        obj = bpy.data.objects.new(part_id, curve_data)
        bpy.context.collection.objects.link(obj)

        # Convert curve to mesh for consistent modifier and export behavior
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.convert(target="MESH")
        obj = bpy.context.active_object

    else:
        # Fallback to standard cube
        bpy.ops.mesh.primitive_cube_add(size=1.0)
        obj = bpy.context.active_object

    obj.name = part_id
    return obj


def apply_transforms_and_shading(obj: bpy.types.Object, part: dict) -> None:
    """Set local transform, rotation, scale, and smooth shading."""
    pos = part.get("position", [0.0, 0.0, 0.0])
    rot = part.get("rotationDeg", [0.0, 0.0, 0.0])
    scale = part.get("scale", [1.0, 1.0, 1.0])

    obj.location = (float(pos[0]), float(pos[1]), float(pos[2]))
    obj.rotation_euler = (
        math.radians(float(rot[0])),
        math.radians(float(rot[1])),
        math.radians(float(rot[2])),
    )
    obj.scale = (float(scale[0]), float(scale[1]), float(scale[2]))

    # Shading and normals
    if part.get("smoothShading", True) and obj.type == "MESH":
        for poly in obj.data.polygons:
            poly.use_smooth = True


def apply_modifiers(obj: bpy.types.Object, part: dict, part_objects: dict[str, bpy.types.Object]) -> None:
    """Apply procedural mesh modifiers (bevel, solidify, subdivision, mirror, boolean)."""
    modifiers = part.get("modifiers", [])
    for idx, mod_spec in enumerate(modifiers):
        op = mod_spec.get("op")
        mod_name = f"{op}_{idx}"

        if op == "bevel":
            mod = obj.modifiers.new(name=mod_name, type="BEVEL")
            mod.width = float(mod_spec.get("bevelWidth", 0.02))
            mod.segments = int(mod_spec.get("bevelSegments", 2))

        elif op == "solidify":
            mod = obj.modifiers.new(name=mod_name, type="SOLIDIFY")
            mod.thickness = float(mod_spec.get("solidifyThickness", 0.05))

        elif op == "subdivision":
            mod = obj.modifiers.new(name=mod_name, type="SUBSURF")
            mod.levels = int(mod_spec.get("subdivisionLevels", 1))

        elif op == "mirror":
            mod = obj.modifiers.new(name=mod_name, type="MIRROR")
            axis = mod_spec.get("mirrorAxis", "X")
            mod.use_axis = (axis == "X", axis == "Y", axis == "Z")

        elif op == "boolean":
            target_id = mod_spec.get("targetPartId")
            if target_id and target_id in part_objects:
                target_obj = part_objects[target_id]
                mod = obj.modifiers.new(name=mod_name, type="BOOLEAN")
                mod.object = target_obj
                bool_type = mod_spec.get("booleanType", "difference").upper()
                mod.operation = bool_type


def compile_scene_spec(spec: dict, output_glb_path: str, stats_path: str | None = None) -> dict:
    """Execute full compilation: scene setup, primitive creation, hierarchy, modifiers, export."""
    clear_scene()

    # 1. Create Materials
    materials = spec.get("materials", [])
    mat_map: dict[str, bpy.types.Material] = {}
    for mat_spec in materials:
        mat_obj = create_material(mat_spec)
        mat_map[mat_spec["id"]] = mat_obj

    # 2. Build Part Objects
    parts = spec.get("parts", [])
    part_objects: dict[str, bpy.types.Object] = {}

    for part in parts:
        obj = build_primitive(part)
        part_objects[part["id"]] = obj

        # Assign Material
        mat_id = part.get("materialId")
        if mat_id and mat_id in mat_map:
            obj.data.materials.append(mat_map[mat_id])

        # Transforms & Shading
        apply_transforms_and_shading(obj, part)

    # Update dependency graph to compute transforms
    bpy.context.view_layer.update()

    # 3. Apply Parenting Hierarchy
    for part in parts:
        parent_id = part.get("parentId")
        if parent_id and parent_id in part_objects:
            child_obj = part_objects[part["id"]]
            parent_obj = part_objects[parent_id]
            child_obj.parent = parent_obj
            child_obj.matrix_parent_inverse = parent_obj.matrix_world.inverted()

    bpy.context.view_layer.update()

    # 4. Apply Modifiers
    for part in parts:
        obj = part_objects[part["id"]]
        apply_modifiers(obj, part, part_objects)

    bpy.context.view_layer.update()

    # 5. Export glTF / GLB
    out_path = Path(output_glb_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=str(out_path.resolve()),
        export_format="GLB",
        export_apply=True,
        export_yup=True,
    )

    # 6. Compute scene statistics
    total_triangles = 0
    total_vertices = 0
    for obj in part_objects.values():
        if obj.type == "MESH" and obj.data:
            total_vertices += len(obj.data.vertices)
            total_triangles += len(obj.data.polygons)

    stats = {
        "success": True,
        "outputPath": str(out_path.resolve()),
        "meshCount": len(part_objects),
        "totalVerticesEstimated": total_vertices,
        "totalPolygonsEstimated": total_triangles,
    }

    if stats_path:
        stats_file = Path(stats_path)
        stats_file.parent.mkdir(parents=True, exist_ok=True)
        stats_file.write_text(json.dumps(stats, indent=2), encoding="utf-8")

    print(f"GLB Compilation Successful: {out_path} ({len(part_objects)} parts)")
    return stats


def main() -> None:
    # Extract arguments after "--"
    argv = sys.argv
    if "--" in argv:
        args_to_parse = argv[argv.index("--") + 1 :]
    else:
        args_to_parse = []

    parser = argparse.ArgumentParser(description="Blender SceneSpec to GLB compiler")
    parser.add_argument("--spec", required=True, help="Path to SceneSpec JSON file")
    parser.add_argument("--output", required=True, help="Output .glb destination path")
    parser.add_argument("--stats", required=False, help="Optional output stats JSON path")

    args = parser.parse_args(args_to_parse)

    spec_path = Path(args.spec)
    if not spec_path.is_file():
        print(f"Error: Spec file not found: {spec_path}", file=sys.stderr)
        sys.exit(1)

    spec_data = json.loads(spec_path.read_text(encoding="utf-8"))
    compile_scene_spec(spec_data, args.output, args.stats)


if __name__ == "__main__":
    main()
