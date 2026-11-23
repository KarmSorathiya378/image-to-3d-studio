"""Script to export SceneSpec JSON Schema."""

import json
from pathlib import Path
from image_to_3d_contracts.scenespec import SceneSpec


def generate_json_schema(output_path: Path | None = None) -> str:
    schema = SceneSpec.model_json_schema()
    schema["$schema"] = "https://json-schema.org/draft/2020-12/schema"
    schema["title"] = "SceneSpec"
    schema["description"] = "Canonical SceneSpec v1 schema for AI Image-to-3D Studio"
    
    schema_str = json.dumps(schema, indent=2)
    if output_path:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(schema_str, encoding="utf-8")
    return schema_str


if __name__ == "__main__":
    schema_file = Path(__file__).resolve().parent.parent.parent / "schemas" / "scenespec.v1.json"
    generate_json_schema(schema_file)
    print(f"Exported SceneSpec JSON Schema to {schema_file}")
