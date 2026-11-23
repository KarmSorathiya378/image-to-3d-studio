"""Pure-Python glTF 2.0 Binary (.glb) validator and geometry inspector."""

from __future__ import annotations

import json
import math
import struct
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


@dataclass
class GlbValidationReport:
    is_valid: bool
    triangle_count: int = 0
    vertex_count: int = 0
    mesh_count: int = 0
    has_normals: bool = False
    is_finite: bool = True
    bounds_min: Tuple[float, float, float] = (0.0, 0.0, 0.0)
    bounds_max: Tuple[float, float, float] = (0.0, 0.0, 0.0)
    materials: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


def validate_glb_file(file_path: str | Path) -> GlbValidationReport:
    path = Path(file_path)
    if not path.is_file():
        return GlbValidationReport(is_valid=False, errors=[f"File not found: {path}"])

    data = path.read_bytes()
    if len(data) < 20:
        return GlbValidationReport(is_valid=False, errors=["File too small for valid GLB header"])

    # GLB Header: magic (4), version (4), length (4)
    magic, version, length = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF":
        return GlbValidationReport(is_valid=False, errors=[f"Invalid magic: {magic!r}, expected b'glTF'"])
    if version != 2:
        return GlbValidationReport(is_valid=False, errors=[f"Unsupported glTF version: {version}, expected 2"])
    if length != len(data):
        return GlbValidationReport(
            is_valid=False,
            warnings=[f"Header length ({length}) does not match actual file size ({len(data)})"]
        )

    # Chunk 0: JSON chunk
    chunk0_length, chunk0_type = struct.unpack_from("<II", data, 12)
    if chunk0_type != 0x4E4F534A:  # "JSON"
        return GlbValidationReport(is_valid=False, errors=["First chunk is not JSON chunk"])

    json_bytes = data[20 : 20 + chunk0_length]
    try:
        gltf = json.loads(json_bytes.decode("utf-8"))
    except Exception as exc:
        return GlbValidationReport(is_valid=False, errors=[f"Failed to parse GLB JSON chunk: {exc}"])

    report = GlbValidationReport(is_valid=True)

    # Inspect materials
    if "materials" in gltf:
        for mat in gltf["materials"]:
            name = mat.get("name", "unnamed_material")
            report.materials.append(name)

    # Inspect meshes and primitives
    meshes = gltf.get("meshes", [])
    accessors = gltf.get("accessors", [])
    report.mesh_count = len(meshes)

    if not meshes:
        report.is_valid = False
        report.errors.append("GLB contains no meshes")
        return report

    all_mins: List[List[float]] = []
    all_maxs: List[List[float]] = []
    has_any_normals = False

    for mesh_idx, mesh in enumerate(meshes):
        primitives = mesh.get("primitives", [])
        for prim_idx, prim in enumerate(primitives):
            attributes = prim.get("attributes", {})

            # POSITION
            pos_acc_idx = attributes.get("POSITION")
            if pos_acc_idx is not None and pos_acc_idx < len(accessors):
                pos_acc = accessors[pos_acc_idx]
                report.vertex_count += pos_acc.get("count", 0)
                pos_min = pos_acc.get("min")
                pos_max = pos_acc.get("max")
                if pos_min and pos_max and len(pos_min) == 3 and len(pos_max) == 3:
                    all_mins.append(pos_min)
                    all_maxs.append(pos_max)
                    for val in pos_min + pos_max:
                        if not isinstance(val, (int, float)) or math.isnan(val) or math.isinf(val):
                            report.is_finite = False
                            report.errors.append(f"Non-finite bound coordinate in mesh {mesh_idx}: {val}")

            # NORMAL
            if "NORMAL" in attributes:
                has_any_normals = True

            # INDICES / TRIANGLES
            indices_acc_idx = prim.get("indices")
            mode = prim.get("mode", 4)  # 4 = TRIANGLES
            if indices_acc_idx is not None and indices_acc_idx < len(accessors):
                idx_acc = accessors[indices_acc_idx]
                count = idx_acc.get("count", 0)
                if mode == 4:
                    report.triangle_count += count // 3
            elif pos_acc_idx is not None and pos_acc_idx < len(accessors):
                # Non-indexed triangles
                count = accessors[pos_acc_idx].get("count", 0)
                if mode == 4:
                    report.triangle_count += count // 3

    report.has_normals = has_any_normals

    # Compute overall bounding box
    if all_mins and all_maxs:
        overall_min = (
            min(m[0] for m in all_mins),
            min(m[1] for m in all_mins),
            min(m[2] for m in all_mins),
        )
        overall_max = (
            max(m[0] for m in all_maxs),
            max(m[1] for m in all_maxs),
            max(m[2] for m in all_maxs),
        )
        report.bounds_min = overall_min
        report.bounds_max = overall_max

        # Check for zero or negative extents
        extents = (
            overall_max[0] - overall_min[0],
            overall_max[1] - overall_min[1],
            overall_max[2] - overall_min[2],
        )
        if any(e < 0.0001 for e in extents):
            report.warnings.append(f"Mesh bounding box has very flat or zero extent: {extents}")

    # Acceptance checks
    if report.triangle_count <= 0:
        report.is_valid = False
        report.errors.append(f"GLB has non-positive triangle count: {report.triangle_count}")

    if report.vertex_count <= 0:
        report.is_valid = False
        report.errors.append(f"GLB has non-positive vertex count: {report.vertex_count}")

    if not report.is_finite:
        report.is_valid = False
        report.errors.append("GLB contains non-finite coordinates or bounds")

    return report
