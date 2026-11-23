"""Integration tests for Blender geometry compiler and GLB export."""

import os
import unittest
from pathlib import Path

from geometry_engine.compiler import compile_scenespec_to_glb, find_blender_binary
from geometry_engine.glb_validator import validate_glb_file


class TestBlenderGeometryCompiler(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine_dir = Path(__file__).resolve().parent.parent
        cls.fixtures_dir = cls.engine_dir / "fixtures"
        cls.blender_bin = find_blender_binary()
        print(f"\n[Test] Using Blender executable: {cls.blender_bin}")

    def test_compile_mug_assembly_fixture(self):
        spec_file = self.fixtures_dir / "mug_assembly.json"
        out_glb = self.fixtures_dir / "mug_assembly.glb"

        result = compile_scenespec_to_glb(
            spec_data=spec_file,
            output_glb_path=out_glb,
            blender_bin=self.blender_bin,
            timeout_seconds=240,
        )

        self.assertTrue(result.success, f"Compilation failed: {result.error_message}")
        self.assertTrue(out_glb.is_file(), f"GLB file was not created: {out_glb}")
        self.assertGreater(out_glb.stat().st_size, 1024, "GLB file is unexpectedly small")

        report = result.validation_report
        self.assertTrue(report.is_valid, f"GLB validation failed: {report.errors}")
        self.assertGreater(report.triangle_count, 100, f"Expected >100 triangles, got {report.triangle_count}")
        self.assertGreater(report.vertex_count, 50, f"Expected >50 vertices, got {report.vertex_count}")
        self.assertTrue(report.has_normals, "Exported GLB should contain normal vectors")
        self.assertTrue(report.is_finite, "All coordinates and bounding boxes must be finite")
        self.assertGreaterEqual(len(report.materials), 2, "Expected ceramic and wood materials")

        print(
            f"\n[Test] Mug GLB verified: {report.triangle_count} tris, {report.vertex_count} verts, "
            f"size={out_glb.stat().st_size} bytes"
        )

    def test_compile_table_with_legs_fixture(self):
        spec_file = self.fixtures_dir / "table_with_legs.json"
        out_glb = self.fixtures_dir / "table_with_legs.glb"

        result = compile_scenespec_to_glb(
            spec_data=spec_file,
            output_glb_path=out_glb,
            blender_bin=self.blender_bin,
            timeout_seconds=240,
        )

        self.assertTrue(result.success, f"Compilation failed: {result.error_message}")
        self.assertTrue(out_glb.is_file(), f"GLB file was not created: {out_glb}")
        self.assertGreater(out_glb.stat().st_size, 1024, "GLB file is unexpectedly small")

        report = result.validation_report
        self.assertTrue(report.is_valid, f"GLB validation failed: {report.errors}")
        self.assertGreater(report.triangle_count, 100, f"Expected >100 triangles, got {report.triangle_count}")
        self.assertGreater(report.vertex_count, 50, f"Expected >50 vertices, got {report.vertex_count}")
        self.assertTrue(report.has_normals, "Exported GLB should contain normal vectors")
        self.assertTrue(report.is_finite, "All coordinates and bounding boxes must be finite")

        print(
            f"\n[Test] Table GLB verified: {report.triangle_count} tris, {report.vertex_count} verts, "
            f"size={out_glb.stat().st_size} bytes"
        )

    def test_fixtures_are_distinct(self):
        mug_glb = self.fixtures_dir / "mug_assembly.glb"
        table_glb = self.fixtures_dir / "table_with_legs.glb"

        self.assertTrue(mug_glb.is_file(), "Mug GLB must exist")
        self.assertTrue(table_glb.is_file(), "Table GLB must exist")

        rep_mug = validate_glb_file(mug_glb)
        rep_table = validate_glb_file(table_glb)

        self.assertNotEqual(
            rep_mug.triangle_count,
            rep_table.triangle_count,
            "Two distinct fixtures must have different triangle topologies",
        )
        self.assertNotEqual(
            rep_mug.bounds_max,
            rep_table.bounds_max,
            "Two distinct fixtures must have different bounding box bounds",
        )

    def test_reject_out_of_range_and_nan(self):
        out_glb = self.fixtures_dir / "should_not_exist.glb"
        bad_spec = {
            "schemaVersion": "1.0",
            "metadata": {"objectName": "bad_spec"},
            "parts": [
                {
                    "id": "nan_box",
                    "type": "box",
                    "parameters": {"size": [float("nan"), 1.0, 1.0]},
                }
            ],
        }

        with self.assertRaises(ValueError):
            compile_scenespec_to_glb(bad_spec, out_glb, blender_bin=self.blender_bin)
        self.assertFalse(out_glb.exists())


if __name__ == "__main__":
    unittest.main()
