"""Host runner for Blender geometry compiler."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional, Union

# Import contracts validation
try:
    from image_to_3d_contracts.scenespec import validate_scenespec, SceneSpec
except ImportError:
    import sys
    contracts_src = Path(__file__).resolve().parent.parent.parent.parent / "packages" / "contracts" / "src"
    if str(contracts_src) not in sys.path:
        sys.path.insert(0, str(contracts_src))
    from image_to_3d_contracts.scenespec import validate_scenespec, SceneSpec

from .glb_validator import validate_glb_file, GlbValidationReport


@dataclass
class GeometryEngineResult:
    success: bool
    output_glb_path: str
    validation_report: GlbValidationReport
    error_message: Optional[str] = None
    stats: Optional[Dict[str, Any]] = None


def find_blender_binary() -> str:
    """Locate the Blender executable on the host system."""
    # 1. Environment variable
    env_bin = os.getenv("BLENDER_BIN")
    if env_bin and Path(env_bin).is_file():
        return env_bin

    # 2. PATH lookup
    path_bin = shutil.which("blender")
    if path_bin:
        return path_bin

    # 3. Known Windows installations
    candidate_paths = [
        Path(r"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"),
        Path(r"C:\Program Files\Blender Foundation\Blender 4.2\blender.exe"),
        Path(r"C:\Program Files\Blender Foundation\Blender 4.1\blender.exe"),
        Path(r"C:\Program Files\Blender Foundation\Blender 4.0\blender.exe"),
        Path(r"C:\Program Files\Blender Foundation\Blender 3.6\blender.exe"),
    ]
    for candidate in candidate_paths:
        if candidate.is_file():
            return str(candidate)

    # 4. Search recursively in Program Files if not found
    prog_files = Path(r"C:\Program Files\Blender Foundation")
    if prog_files.is_dir():
        for found in prog_files.rglob("blender.exe"):
            if found.is_file():
                return str(found)

    raise FileNotFoundError(
        "Blender executable not found. Please install Blender LTS or set BLENDER_BIN environment variable."
    )


def compile_scenespec_to_glb(
    spec_data: Union[Dict[str, Any], SceneSpec, str, Path],
    output_glb_path: Union[str, Path],
    blender_bin: Optional[str] = None,
    timeout_seconds: int = 180,
) -> GeometryEngineResult:
    """Validate SceneSpec, execute Blender compiler headless, and validate the output GLB.
    
    Raises ValueError if SceneSpec validation fails.
    """
    # 1. Load and Validate SceneSpec
    if isinstance(spec_data, (str, Path)):
        spec_path = Path(spec_data)
        if spec_path.is_file():
            raw_text = spec_path.read_text(encoding="utf-8")
            raw_dict = json.loads(raw_text)
        else:
            raw_dict = json.loads(str(spec_data))
        validated = validate_scenespec(raw_dict)
    elif isinstance(spec_data, SceneSpec):
        validated = spec_data
    else:
        validated = validate_scenespec(spec_data)

    out_path = Path(output_glb_path).resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)

    # 2. Locate Blender
    blender_path = blender_bin or find_blender_binary()

    # 3. Locate builder script
    builder_script = Path(__file__).resolve().parent / "blender_builder.py"
    if not builder_script.is_file():
        raise FileNotFoundError(f"Builder script missing: {builder_script}")

    # 4. Write validated spec to temporary file
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_spec_file = Path(tmp_dir) / "spec.json"
        tmp_stats_file = Path(tmp_dir) / "stats.json"
        tmp_spec_file.write_text(validated.model_dump_json(indent=2), encoding="utf-8")

        # 5. Invoke Blender in headless background mode
        cmd = [
            blender_path,
            "--background",
            "--factory-startup",
            "-P",
            str(builder_script),
            "--",
            "--spec",
            str(tmp_spec_file),
            "--output",
            str(out_path),
            "--stats",
            str(tmp_stats_file),
        ]

        proc = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=timeout_seconds,
        )

        if proc.returncode != 0:
            return GeometryEngineResult(
                success=False,
                output_glb_path=str(out_path),
                validation_report=GlbValidationReport(is_valid=False, errors=[proc.stderr or proc.stdout]),
                error_message=f"Blender process exited with code {proc.returncode}:\n{proc.stderr}\n{proc.stdout}",
            )

        stats = {}
        if tmp_stats_file.is_file():
            try:
                stats = json.loads(tmp_stats_file.read_text(encoding="utf-8"))
            except Exception:
                pass

    # 6. Validate exported GLB
    report = validate_glb_file(out_path)
    if not report.is_valid:
        return GeometryEngineResult(
            success=False,
            output_glb_path=str(out_path),
            validation_report=report,
            error_message=f"GLB validation failed: {report.errors}",
            stats=stats,
        )

    return GeometryEngineResult(
        success=True,
        output_glb_path=str(out_path),
        validation_report=report,
        stats=stats,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Compile SceneSpec JSON to verified GLB")
    parser.add_argument("--spec", required=True, help="Input SceneSpec JSON path")
    parser.add_argument("--output", required=True, help="Output .glb path")
    args = parser.parse_args()

    result = compile_scenespec_to_glb(args.spec, args.output)
    if result.success:
        print(f"Compilation successful: {result.output_glb_path}")
        print(f"Triangles: {result.validation_report.triangle_count}, Vertices: {result.validation_report.vertex_count}")
    else:
        print(f"Compilation failed: {result.error_message}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
