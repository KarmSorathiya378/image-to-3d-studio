"""
Blender Geometry Worker HTTP service for AI Image-to-3D Studio.
Runs headless Blender LTS mesh compilation inside an isolated container.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel
import uvicorn

# Import compiler and contracts
from geometry_engine.compiler import compile_scenespec_to_glb, find_blender_binary
from image_to_3d_contracts.scenespec import validate_scenespec

app = FastAPI(
    title="Blender Geometry Worker",
    version="1.0.0",
    docs_url="/docs",
)


class CompileRequest(BaseModel):
    spec: Dict[str, Any]
    output_filename: Optional[str] = "model.glb"


class CompileResponse(BaseModel):
    success: bool
    output_glb_path: Optional[str] = None
    triangle_count: Optional[int] = 0
    vertex_count: Optional[int] = 0
    errors: list[str] = []
    stats: Optional[Dict[str, Any]] = None


@app.get("/healthz", status_code=status.HTTP_200_OK)
async def healthz():
    blender_path = find_blender_binary()
    return {
        "status": "ok",
        "service": "blender-geometry-worker",
        "blender_path": blender_path,
        "blender_available": blender_path is not None and Path(blender_path).is_file(),
    }


@app.get("/readyz", status_code=status.HTTP_200_OK)
async def readyz():
    blender_path = find_blender_binary()
    if not blender_path or not Path(blender_path).is_file():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Blender binary not found or not executable: {blender_path}",
        )
    try:
        proc = subprocess.run([blender_path, "--version"], capture_output=True, text=True, timeout=5)
        version_line = proc.stdout.splitlines()[0] if proc.stdout else "unknown"
        return {"status": "ready", "blender_version": version_line}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Error executing Blender binary: {e}",
        )


@app.post("/compile", response_model=CompileResponse, status_code=status.HTTP_200_OK)
async def compile_spec(request: CompileRequest):
    # 1. Validate spec schema
    try:
        validated_spec = validate_scenespec(request.spec)
    except Exception as e:
        return CompileResponse(
            success=False,
            errors=[f"SceneSpec validation error: {str(e)}"],
        )

    # 2. Compile to GLB in a safe scratch dir
    temp_dir = tempfile.mkdtemp(prefix="geometry_worker_")
    out_glb = Path(temp_dir) / (request.output_filename or "model.glb")

    try:
        result = compile_scenespec_to_glb(
            spec_data=validated_spec,
            output_glb_path=str(out_glb),
            timeout_seconds=180,
        )

        if not result.success:
            return CompileResponse(
                success=False,
                errors=[result.error_message or "Blender compilation failed"],
                stats=result.stats,
            )

        return CompileResponse(
            success=True,
            output_glb_path=result.output_glb_path,
            triangle_count=result.validation_report.triangle_count,
            vertex_count=result.validation_report.vertex_count,
            errors=result.validation_report.errors,
            stats=result.stats,
        )
    except Exception as e:
        return CompileResponse(
            success=False,
            errors=[f"Compilation exception: {str(e)}"],
        )


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("infra.scripts.blender_worker:app", host="0.0.0.0", port=port, reload=False)
