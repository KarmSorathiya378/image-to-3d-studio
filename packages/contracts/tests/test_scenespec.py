"""Unit tests for SceneSpec schema validation and error rejection."""

import math
import unittest
from image_to_3d_contracts.scenespec import (
    SceneSpec,
    SceneMetadata,
    ScenePart,
    PrimitiveType,
    MaterialSpec,
    BoxParams,
    CylinderParams,
    MeshModifier,
    ModifierOp,
    BooleanType,
    validate_scenespec,
)
from image_to_3d_contracts.export_schema import generate_json_schema


class TestSceneSpecValidation(unittest.TestCase):
    def setUp(self):
        self.valid_data = {
            "schemaVersion": "1.0",
            "metadata": {
                "objectName": "test_chair",
                "description": "A unit test chair",
            },
            "coordinateSystem": "Z_UP",
            "units": "relative",
            "materials": [
                {
                    "id": "mat_wood",
                    "baseColor": "#8F684A",
                    "roughness": 0.6,
                    "metallic": 0.0,
                }
            ],
            "parts": [
                {
                    "id": "seat",
                    "name": "Chair Seat",
                    "type": "box",
                    "parameters": {"size": [1.0, 1.0, 0.1]},
                    "position": [0.0, 0.0, 0.5],
                    "materialId": "mat_wood",
                },
                {
                    "id": "leg_1",
                    "name": "Leg Front Left",
                    "type": "cylinder",
                    "parameters": {"radius": 0.04, "height": 0.5, "segments": 16},
                    "parentId": "seat",
                    "position": [-0.4, -0.4, -0.25],
                    "materialId": "mat_wood",
                },
            ],
        }

    def test_valid_scenespec(self):
        spec = validate_scenespec(self.valid_data)
        self.assertEqual(spec.metadata.objectName, "test_chair")
        self.assertEqual(len(spec.parts), 2)
        self.assertEqual(spec.parts[0].type, PrimitiveType.BOX)
        self.assertEqual(spec.parts[1].parentId, "seat")

    def test_reject_nan_in_size(self):
        invalid_data = dict(self.valid_data)
        invalid_data["parts"] = [
            {
                "id": "bad_box",
                "type": "box",
                "parameters": {"size": [float("nan"), 1.0, 1.0]},
            }
        ]
        with self.assertRaises(ValueError):
            validate_scenespec(invalid_data)

    def test_reject_inf_in_position(self):
        invalid_data = dict(self.valid_data)
        invalid_data["parts"] = [
            {
                "id": "bad_pos",
                "type": "box",
                "parameters": {"size": [1.0, 1.0, 1.0]},
                "position": [0.0, float("inf"), 0.0],
            }
        ]
        with self.assertRaises(ValueError):
            validate_scenespec(invalid_data)

    def test_reject_negative_or_zero_box_size(self):
        invalid_data = dict(self.valid_data)
        invalid_data["parts"] = [
            {
                "id": "bad_dim",
                "type": "box",
                "parameters": {"size": [0.0, 1.0, 1.0]},
            }
        ]
        with self.assertRaises(ValueError):
            validate_scenespec(invalid_data)

    def test_reject_out_of_range_dimension(self):
        invalid_data = dict(self.valid_data)
        invalid_data["parts"] = [
            {
                "id": "oversize",
                "type": "box",
                "parameters": {"size": [1000.0, 1.0, 1.0]},  # Max is 100.0
            }
        ]
        with self.assertRaises(ValueError):
            validate_scenespec(invalid_data)

    def test_reject_undefined_material_reference(self):
        invalid_data = dict(self.valid_data)
        invalid_data["parts"] = [
            {
                "id": "part1",
                "type": "box",
                "parameters": {"size": [1.0, 1.0, 1.0]},
                "materialId": "non_existent_mat",
            }
        ]
        with self.assertRaises(ValueError) as ctx:
            validate_scenespec(invalid_data)
        self.assertIn("references undefined materialId", str(ctx.exception))

    def test_reject_undefined_parent_reference(self):
        invalid_data = dict(self.valid_data)
        invalid_data["parts"] = [
            {
                "id": "part1",
                "type": "box",
                "parameters": {"size": [1.0, 1.0, 1.0]},
                "parentId": "ghost_parent",
            }
        ]
        with self.assertRaises(ValueError) as ctx:
            validate_scenespec(invalid_data)
        self.assertIn("references non-existent parentId", str(ctx.exception))

    def test_reject_cyclic_parent_hierarchy(self):
        invalid_data = dict(self.valid_data)
        invalid_data["parts"] = [
            {
                "id": "partA",
                "type": "box",
                "parameters": {"size": [1.0, 1.0, 1.0]},
                "parentId": "partB",
            },
            {
                "id": "partB",
                "type": "box",
                "parameters": {"size": [1.0, 1.0, 1.0]},
                "parentId": "partA",
            },
        ]
        with self.assertRaises(ValueError) as ctx:
            validate_scenespec(invalid_data)
        self.assertIn("Cyclic parent-child hierarchy detected", str(ctx.exception))

    def test_reject_self_parenting(self):
        invalid_data = dict(self.valid_data)
        invalid_data["parts"] = [
            {
                "id": "partSelf",
                "type": "box",
                "parameters": {"size": [1.0, 1.0, 1.0]},
                "parentId": "partSelf",
            }
        ]
        with self.assertRaises(ValueError) as ctx:
            validate_scenespec(invalid_data)
        self.assertIn("cannot be its own parent", str(ctx.exception))

    def test_reject_boolean_self_reference(self):
        invalid_data = dict(self.valid_data)
        invalid_data["parts"] = [
            {
                "id": "partBool",
                "type": "box",
                "parameters": {"size": [1.0, 1.0, 1.0]},
                "modifiers": [
                    {
                        "op": "boolean",
                        "booleanType": "difference",
                        "targetPartId": "partBool",
                    }
                ],
            }
        ]
        with self.assertRaises(ValueError) as ctx:
            validate_scenespec(invalid_data)
        self.assertIn("cannot target itself", str(ctx.exception))

    def test_json_schema_export(self):
        schema_json = generate_json_schema()
        self.assertIn("SceneSpec", schema_json)
        self.assertIn("parts", schema_json)
        self.assertIn("materials", schema_json)


if __name__ == "__main__":
    unittest.main()
