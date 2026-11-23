"""Canonical SceneSpec v1 schema and validation rules."""

from __future__ import annotations

import math
import re
import uuid
from enum import Enum
from typing import Any, Dict, List, Literal, Optional, Tuple, Union
from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)


def _assert_finite(value: float, name: str = "value") -> float:
    """Ensure a float value is finite and not NaN or Infinity."""
    if not isinstance(value, (int, float)) or math.isnan(value) or math.isinf(value):
        raise ValueError(f"Field '{name}' must be a finite number, got {value}")
    return float(value)


def _assert_finite_vector(v: Tuple[float, ...], name: str = "vector") -> Tuple[float, ...]:
    """Ensure each component in a vector is finite."""
    return tuple(_assert_finite(x, f"{name}[{i}]") for i, x in enumerate(v))


class CoordinateSystem(str, Enum):
    Z_UP = "Z_UP"
    Y_UP = "Y_UP"


class UnitType(str, Enum):
    METERS = "meters"
    CENTIMETERS = "centimeters"
    MILLIMETERS = "millimeters"
    RELATIVE = "relative"


class PrimitiveType(str, Enum):
    BOX = "box"
    CYLINDER = "cylinder"
    SPHERE = "sphere"
    CONE = "cone"
    PLANE = "plane"
    CAPSULE = "capsule"
    TORUS = "torus"
    EXTRUDED_POLYGON = "extrudedPolygon"
    LATHE = "lathe"
    PARAMETERIZED_CURVE = "parameterizedCurve"


class ModifierOp(str, Enum):
    BOOLEAN = "boolean"
    BEVEL = "bevel"
    SOLIDIFY = "solidify"
    SUBDIVISION = "subdivision"
    MIRROR = "mirror"


class BooleanType(str, Enum):
    UNION = "union"
    DIFFERENCE = "difference"
    INTERSECTION = "intersection"


class MirrorAxis(str, Enum):
    X = "X"
    Y = "Y"
    Z = "Z"


class AlphaMode(str, Enum):
    OPAQUE = "OPAQUE"
    MASK = "MASK"
    BLEND = "BLEND"


class LightType(str, Enum):
    DIRECTIONAL = "directional"
    POINT = "point"
    SPOT = "spot"
    AMBIENT = "ambient"
    SUN = "sun"


class CurveType(str, Enum):
    HELIX = "helix"
    BEZIER = "bezier"
    LINE_STRIP = "line_strip"


# ---------------------------------------------------------------------------
# Primitive Parameters
# ---------------------------------------------------------------------------

class BaseContractModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class BoxParams(BaseContractModel):
    size: Tuple[float, float, float] = Field(
        default=(1.0, 1.0, 1.0),
        description="Width (X), Depth (Y), Height (Z) dimensions."
    )

    @field_validator("size")
    @classmethod
    def validate_size(cls, v: Tuple[float, float, float]) -> Tuple[float, float, float]:
        v = _assert_finite_vector(v, "size")
        for i, val in enumerate(v):
            if val <= 0.0 or val > 100.0:
                raise ValueError(f"Box dimension size[{i}] must be in range (0, 100], got {val}")
        return v


class CylinderParams(BaseContractModel):
    radius: float = Field(default=0.5, ge=0.001, le=50.0)
    height: float = Field(default=1.0, ge=0.001, le=100.0)
    segments: int = Field(default=32, ge=3, le=128)
    capTop: bool = Field(default=True)
    capBottom: bool = Field(default=True)

    @field_validator("radius", "height")
    @classmethod
    def validate_finite(cls, v: float, info: Any) -> float:
        return _assert_finite(v, info.field_name)


class SphereParams(BaseContractModel):
    radius: float = Field(default=0.5, ge=0.001, le=50.0)
    segments: int = Field(default=32, ge=3, le=128)
    ringCount: int = Field(default=16, ge=3, le=64)

    @field_validator("radius")
    @classmethod
    def validate_finite(cls, v: float) -> float:
        return _assert_finite(v, "radius")


class ConeParams(BaseContractModel):
    radiusBottom: float = Field(default=0.5, ge=0.0, le=50.0)
    radiusTop: float = Field(default=0.0, ge=0.0, le=50.0)
    height: float = Field(default=1.0, ge=0.001, le=100.0)
    segments: int = Field(default=32, ge=3, le=128)
    capTop: bool = Field(default=True)
    capBottom: bool = Field(default=True)

    @field_validator("radiusBottom", "radiusTop", "height")
    @classmethod
    def validate_finite(cls, v: float, info: Any) -> float:
        return _assert_finite(v, info.field_name)

    @model_validator(mode="after")
    def validate_non_zero_radii(self) -> ConeParams:
        if self.radiusBottom <= 0.0 and self.radiusTop <= 0.0:
            raise ValueError("Cone must have at least one of radiusBottom or radiusTop > 0")
        return self


class PlaneParams(BaseContractModel):
    size: Tuple[float, float] = Field(default=(1.0, 1.0))

    @field_validator("size")
    @classmethod
    def validate_size(cls, v: Tuple[float, float]) -> Tuple[float, float]:
        v = tuple(_assert_finite(x, f"size[{i}]") for i, x in enumerate(v))
        for i, val in enumerate(v):
            if val <= 0.0 or val > 100.0:
                raise ValueError(f"Plane size[{i}] must be in range (0, 100], got {val}")
        return v  # type: ignore


class CapsuleParams(BaseContractModel):
    radius: float = Field(default=0.25, ge=0.001, le=50.0)
    height: float = Field(default=1.0, ge=0.001, le=100.0)
    segments: int = Field(default=32, ge=3, le=128)

    @field_validator("radius", "height")
    @classmethod
    def validate_finite(cls, v: float, info: Any) -> float:
        return _assert_finite(v, info.field_name)


class TorusParams(BaseContractModel):
    majorRadius: float = Field(default=0.5, ge=0.001, le=50.0)
    minorRadius: float = Field(default=0.1, ge=0.001, le=25.0)
    majorSegments: int = Field(default=32, ge=3, le=128)
    minorSegments: int = Field(default=16, ge=3, le=64)

    @field_validator("majorRadius", "minorRadius")
    @classmethod
    def validate_finite(cls, v: float, info: Any) -> float:
        return _assert_finite(v, info.field_name)

    @model_validator(mode="after")
    def validate_radii_relationship(self) -> TorusParams:
        if self.minorRadius >= self.majorRadius:
            raise ValueError("Torus minorRadius must be strictly less than majorRadius")
        return self


class ExtrudedPolygonParams(BaseContractModel):
    points: List[Tuple[float, float]] = Field(
        ...,
        min_length=3,
        max_length=256,
        description="2D polygon vertices in counter-clockwise order."
    )
    depth: float = Field(default=0.2, ge=0.001, le=50.0)
    bevel: float = Field(default=0.0, ge=0.0, le=5.0)

    @field_validator("depth", "bevel")
    @classmethod
    def validate_finite_scalars(cls, v: float, info: Any) -> float:
        return _assert_finite(v, info.field_name)

    @field_validator("points")
    @classmethod
    def validate_points(cls, points: List[Tuple[float, float]]) -> List[Tuple[float, float]]:
        cleaned: List[Tuple[float, float]] = []
        for i, pt in enumerate(points):
            x = _assert_finite(pt[0], f"points[{i}][0]")
            y = _assert_finite(pt[1], f"points[{i}][1]")
            if abs(x) > 50.0 or abs(y) > 50.0:
                raise ValueError(f"ExtrudedPolygon point [{x}, {y}] exceeds bounds [-50, 50]")
            cleaned.append((x, y))
        return cleaned


class LatheParams(BaseContractModel):
    profile: List[Tuple[float, float]] = Field(
        ...,
        min_length=2,
        max_length=256,
        description="List of (radius, z) profile coordinates to revolve around Z axis."
    )
    segments: int = Field(default=32, ge=3, le=128)
    angleDeg: float = Field(default=360.0, ge=1.0, le=360.0)

    @field_validator("angleDeg")
    @classmethod
    def validate_finite_scalar(cls, v: float) -> float:
        return _assert_finite(v, "angleDeg")

    @field_validator("profile")
    @classmethod
    def validate_profile(cls, profile: List[Tuple[float, float]]) -> List[Tuple[float, float]]:
        cleaned: List[Tuple[float, float]] = []
        for i, pt in enumerate(profile):
            r = _assert_finite(pt[0], f"profile[{i}].radius")
            z = _assert_finite(pt[1], f"profile[{i}].z")
            if r < 0.0 or r > 50.0:
                raise ValueError(f"Lathe profile radius at index {i} must be in [0, 50], got {r}")
            if abs(z) > 50.0:
                raise ValueError(f"Lathe profile z at index {i} must be in [-50, 50], got {z}")
            cleaned.append((r, z))
        return cleaned


class ParameterizedCurveParams(BaseContractModel):
    curveType: CurveType = Field(default=CurveType.BEZIER)
    controlPoints: List[Tuple[float, float, float]] = Field(..., min_length=2, max_length=128)
    radius: float = Field(default=0.05, ge=0.001, le=25.0)
    segments: int = Field(default=16, ge=3, le=64)

    @field_validator("radius")
    @classmethod
    def validate_radius(cls, v: float) -> float:
        return _assert_finite(v, "radius")

    @field_validator("controlPoints")
    @classmethod
    def validate_control_points(cls, pts: List[Tuple[float, float, float]]) -> List[Tuple[float, float, float]]:
        cleaned: List[Tuple[float, float, float]] = []
        for i, pt in enumerate(pts):
            t = _assert_finite_vector(pt, f"controlPoints[{i}]")
            for val in t:
                if abs(val) > 100.0:
                    raise ValueError(f"Control point coordinate {val} exceeds [-100, 100]")
            cleaned.append((t[0], t[1], t[2]))
        return cleaned


# ---------------------------------------------------------------------------
# Modifiers & Hierarchy
# ---------------------------------------------------------------------------

class MeshModifier(BaseContractModel):
    op: ModifierOp
    booleanType: Optional[BooleanType] = None
    targetPartId: Optional[str] = None
    bevelWidth: Optional[float] = Field(default=None, ge=0.0001, le=5.0)
    bevelSegments: Optional[int] = Field(default=None, ge=1, le=16)
    solidifyThickness: Optional[float] = Field(default=None, ge=-5.0, le=5.0)
    subdivisionLevels: Optional[int] = Field(default=None, ge=1, le=4)
    mirrorAxis: Optional[MirrorAxis] = None

    @field_validator("bevelWidth", "solidifyThickness")
    @classmethod
    def validate_finite_modifier_floats(cls, v: Optional[float], info: Any) -> Optional[float]:
        if v is not None:
            return _assert_finite(v, info.field_name)
        return v

    @model_validator(mode="after")
    def validate_modifier_rules(self) -> MeshModifier:
        if self.op == ModifierOp.BOOLEAN:
            if not self.booleanType:
                raise ValueError("Boolean modifier requires 'booleanType' (union, difference, intersection)")
            if not self.targetPartId:
                raise ValueError("Boolean modifier requires 'targetPartId'")
        elif self.op == ModifierOp.BEVEL:
            if self.bevelWidth is None:
                self.bevelWidth = 0.02
        elif self.op == ModifierOp.SOLIDIFY:
            if self.solidifyThickness is None or abs(self.solidifyThickness) < 1e-5:
                raise ValueError("Solidify modifier requires non-zero 'solidifyThickness'")
        elif self.op == ModifierOp.SUBDIVISION:
            if self.subdivisionLevels is None:
                self.subdivisionLevels = 1
        elif self.op == ModifierOp.MIRROR:
            if not self.mirrorAxis:
                self.mirrorAxis = MirrorAxis.X
        return self


class ScenePart(BaseContractModel):
    id: str = Field(..., pattern=r"^[a-zA-Z0-9_\-]+$", min_length=1, max_length=64)
    name: Optional[str] = Field(default=None, max_length=128)
    type: PrimitiveType
    parameters: Dict[str, Any] = Field(..., description="Primitive specific parameters matching type.")
    parentId: Optional[str] = Field(default=None, pattern=r"^[a-zA-Z0-9_\-]+$")
    position: Tuple[float, float, float] = Field(default=(0.0, 0.0, 0.0))
    rotationDeg: Tuple[float, float, float] = Field(default=(0.0, 0.0, 0.0))
    scale: Tuple[float, float, float] = Field(default=(1.0, 1.0, 1.0))
    materialId: Optional[str] = Field(default=None, pattern=r"^[a-zA-Z0-9_\-]+$")
    modifiers: List[MeshModifier] = Field(default_factory=list)
    smoothShading: bool = Field(default=True)
    visible: bool = Field(default=True)

    @field_validator("position", "rotationDeg", "scale")
    @classmethod
    def validate_transform_vectors(cls, v: Tuple[float, float, float], info: Any) -> Tuple[float, float, float]:
        v = _assert_finite_vector(v, info.field_name)
        field = info.field_name
        if field == "position":
            for x in v:
                if abs(x) > 1000.0:
                    raise ValueError(f"Position coordinate {x} exceeds bounds [-1000, 1000]")
        elif field == "rotationDeg":
            for r in v:
                if abs(r) > 3600.0:
                    raise ValueError(f"Rotation degree {r} exceeds range [-3600, 3600]")
        elif field == "scale":
            for s in v:
                if abs(s) < 0.0001 or abs(s) > 100.0:
                    raise ValueError(f"Scale coordinate {s} must be in range [0.0001, 100.0]")
        return v

    @model_validator(mode="after")
    def validate_parameters_conformance(self) -> ScenePart:
        # Validate that parameters dictionary conforms to primitive type
        param_models = {
            PrimitiveType.BOX: BoxParams,
            PrimitiveType.CYLINDER: CylinderParams,
            PrimitiveType.SPHERE: SphereParams,
            PrimitiveType.CONE: ConeParams,
            PrimitiveType.PLANE: PlaneParams,
            PrimitiveType.CAPSULE: CapsuleParams,
            PrimitiveType.TORUS: TorusParams,
            PrimitiveType.EXTRUDED_POLYGON: ExtrudedPolygonParams,
            PrimitiveType.LATHE: LatheParams,
            PrimitiveType.PARAMETERIZED_CURVE: ParameterizedCurveParams,
        }
        model_cls = param_models.get(self.type)
        if model_cls and isinstance(self.parameters, dict):
            validated = model_cls(**self.parameters)
            object.__setattr__(self, "parameters", validated.model_dump())
        return self


# ---------------------------------------------------------------------------
# Materials, Camera, Lighting
# ---------------------------------------------------------------------------

HEX_COLOR_REGEX = re.compile(r"^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$")


class MaterialSpec(BaseContractModel):
    id: str = Field(..., pattern=r"^[a-zA-Z0-9_\-]+$", min_length=1, max_length=64)
    name: Optional[str] = Field(default=None, max_length=128)
    baseColor: str = Field(default="#8F684A", description="Hex color format e.g. #RRGGBB or #RRGGBBAA")
    roughness: float = Field(default=0.7, ge=0.0, le=1.0)
    metallic: float = Field(default=0.0, ge=0.0, le=1.0)
    emissiveColor: Optional[str] = Field(default=None)
    emissiveIntensity: float = Field(default=0.0, ge=0.0, le=100.0)
    opacity: float = Field(default=1.0, ge=0.0, le=1.0)
    alphaMode: AlphaMode = Field(default=AlphaMode.OPAQUE)

    @field_validator("baseColor", "emissiveColor")
    @classmethod
    def validate_hex_color(cls, v: Optional[str], info: Any) -> Optional[str]:
        if v is not None:
            if not HEX_COLOR_REGEX.match(v):
                raise ValueError(f"{info.field_name} must be a valid hex color string (e.g. #FFFFFF), got '{v}'")
        return v

    @field_validator("roughness", "metallic", "emissiveIntensity", "opacity")
    @classmethod
    def validate_material_floats(cls, v: float, info: Any) -> float:
        return _assert_finite(v, info.field_name)


class CameraHint(BaseContractModel):
    position: Tuple[float, float, float] = Field(default=(2.0, -3.0, 2.0))
    target: Tuple[float, float, float] = Field(default=(0.0, 0.0, 0.5))
    fov: float = Field(default=45.0, ge=10.0, le=120.0)

    @field_validator("position", "target")
    @classmethod
    def validate_camera_vectors(cls, v: Tuple[float, float, float], info: Any) -> Tuple[float, float, float]:
        return _assert_finite_vector(v, info.field_name)

    @field_validator("fov")
    @classmethod
    def validate_fov(cls, v: float) -> float:
        return _assert_finite(v, "fov")


class LightSpec(BaseContractModel):
    id: str = Field(..., pattern=r"^[a-zA-Z0-9_\-]+$", min_length=1, max_length=64)
    type: LightType = Field(default=LightType.DIRECTIONAL)
    position: Tuple[float, float, float] = Field(default=(4.0, -4.0, 5.0))
    color: str = Field(default="#FFFFFF")
    intensity: float = Field(default=2.0, ge=0.0, le=1000.0)

    @field_validator("position")
    @classmethod
    def validate_light_pos(cls, v: Tuple[float, float, float]) -> Tuple[float, float, float]:
        return _assert_finite_vector(v, "position")

    @field_validator("color")
    @classmethod
    def validate_color(cls, v: str) -> str:
        if not HEX_COLOR_REGEX.match(v):
            raise ValueError(f"Light color must be hex string, got '{v}'")
        return v

    @field_validator("intensity")
    @classmethod
    def validate_intensity(cls, v: float) -> float:
        return _assert_finite(v, "intensity")


class SceneMetadata(BaseContractModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    schemaVersion: Literal["1.0"] = "1.0"
    objectName: str = Field(..., min_length=1, max_length=128)
    description: Optional[str] = Field(default=None, max_length=1024)
    generator: Optional[str] = Field(default="vlm-geometry-planner")
    createdAt: Optional[str] = None


# ---------------------------------------------------------------------------
# Root SceneSpec
# ---------------------------------------------------------------------------

class SceneSpec(BaseContractModel):
    schemaVersion: Literal["1.0"] = "1.0"
    metadata: SceneMetadata
    coordinateSystem: CoordinateSystem = Field(default=CoordinateSystem.Z_UP)
    units: UnitType = Field(default=UnitType.RELATIVE)
    parts: List[ScenePart] = Field(..., min_length=1, max_length=128)
    materials: List[MaterialSpec] = Field(default_factory=list, max_length=64)
    camera: Optional[CameraHint] = None
    lights: List[LightSpec] = Field(default_factory=list, max_length=16)
    uncertaintyNotes: List[str] = Field(default_factory=list, max_length=32)

    @model_validator(mode="after")
    def validate_scene_invariants(self) -> SceneSpec:
        # 1. Unique part IDs
        part_ids: set[str] = set()
        for part in self.parts:
            if part.id in part_ids:
                raise ValueError(f"Duplicate part id detected: '{part.id}'")
            part_ids.add(part.id)

        # 2. Unique material IDs
        material_ids: set[str] = set()
        for mat in self.materials:
            if mat.id in material_ids:
                raise ValueError(f"Duplicate material id detected: '{mat.id}'")
            material_ids.add(mat.id)

        # 3. Material references must resolve
        for part in self.parts:
            if part.materialId and part.materialId not in material_ids:
                raise ValueError(
                    f"Part '{part.id}' references undefined materialId '{part.materialId}'. "
                    f"Defined materials: {list(material_ids)}"
                )

        # 4. Parent references must resolve and form a directed acyclic graph (no cycles)
        parent_map: Dict[str, Optional[str]] = {}
        for part in self.parts:
            if part.parentId:
                if part.parentId not in part_ids:
                    raise ValueError(
                        f"Part '{part.id}' references non-existent parentId '{part.parentId}'"
                    )
                if part.parentId == part.id:
                    raise ValueError(f"Part '{part.id}' cannot be its own parent")
            parent_map[part.id] = part.parentId

        # Cycle detection
        for start_id in part_ids:
            visited = set()
            curr: Optional[str] = start_id
            while curr:
                if curr in visited:
                    raise ValueError(f"Cyclic parent-child hierarchy detected involving part '{curr}'")
                visited.add(curr)
                curr = parent_map.get(curr)

        # 5. Boolean modifier targetPartId validation
        for part in self.parts:
            for mod in part.modifiers:
                if mod.op == ModifierOp.BOOLEAN:
                    if mod.targetPartId not in part_ids:
                        raise ValueError(
                            f"Boolean modifier on part '{part.id}' references unknown targetPartId '{mod.targetPartId}'"
                        )
                    if mod.targetPartId == part.id:
                        raise ValueError(
                            f"Boolean modifier on part '{part.id}' cannot target itself"
                        )

        return self


def validate_scenespec(data: Union[Dict[str, Any], SceneSpec]) -> SceneSpec:
    """Validate data dictionary or SceneSpec instance against SceneSpec schema."""
    if isinstance(data, SceneSpec):
        return data
    return SceneSpec.model_validate(data)


def validate_scenespec_json(json_str: str) -> SceneSpec:
    """Validate raw JSON string against SceneSpec schema."""
    return SceneSpec.model_validate_json(json_str)
