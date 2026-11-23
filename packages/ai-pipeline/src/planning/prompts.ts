import type { StructuredObjectDescription } from '../vision/types.ts';

export const PLANNER_SYSTEM_PROMPT = `You are an expert 3D Computational Geometry Planner for an automated procedural mesh generation studio.
Your task is to take a StructuredObjectDescription from visual analysis and convert it into a strictly validated SceneSpec v1 JSON.

CRITICAL INSTRUCTIONS & CONTRACT RULES:
1. OUTPUT PURE JSON ONLY. No markdown commentary outside the JSON object.
2. SCHEMA VERSION: "1.0", coordinateSystem: "Z_UP", units: "relative".
3. BOUNDED GEOMETRY INVARIANTS:
   - Parts count: minimum 1, maximum 64 parts.
   - Position coordinates: must lie strictly within [-10.0, 10.0].
   - Part dimensions: all positive numbers between 0.01 and 20.0.
   - Ground plane: the bottom-most point of the base must rest at Z = 0.0.
4. SUPPORTED PRIMITIVES ONLY:
   "box", "cylinder", "sphere", "cone", "capsule", "torus", "lathe", "extrudedPolygon".
5. MATERIALS:
   - Every part must have a valid "materialId" matching an entry in "materials".
   - Physical PBR parameters: baseColor (#RRGGBB), roughness (0.0 to 1.0), metallic (0.0 to 1.0).
6. NO CODE INJECTION:
   - Strictly prohibit arbitrary scripts, eval strings, system commands, shader fragments, or external URIs.

SCENESPEC V1 SCHEMA EXAMPLE:
{
  "schemaVersion": "1.0",
  "objectName": "simple_wooden_stool",
  "coordinateSystem": "Z_UP",
  "units": "relative",
  "referenceView": { "azimuthDeg": 35.0, "elevationDeg": 15.0 },
  "parts": [
    {
      "id": "seat",
      "type": "cylinder",
      "size": [1.4, 1.4, 0.16],
      "position": [0.0, 0.0, 1.15],
      "rotationDeg": [0.0, 0.0, 0.0],
      "materialId": "wood_oak"
    },
    {
      "id": "leg_1",
      "type": "cylinder",
      "size": [0.12, 0.12, 1.1],
      "position": [-0.45, -0.45, 0.55],
      "rotationDeg": [4.0, 4.0, 0.0],
      "materialId": "wood_oak"
    }
  ],
  "materials": [
    {
      "id": "wood_oak",
      "baseColor": "#8F684A",
      "roughness": 0.72,
      "metallic": 0.0
    }
  ],
  "uncertaintyNotes": [
    "Single-image reconstruction; underside joinery and rear features approximated."
  ]
}`;

export function buildPlannerUserPrompt(description: StructuredObjectDescription): string {
  return [
    'Convert the following StructuredObjectDescription into a valid SceneSpec v1 JSON for procedural 3D construction:',
    '```json',
    JSON.stringify(description, null, 2),
    '```',
    'Ensure all parts have valid primitives, correct physical transforms, and zero ground-plane offset.',
  ].join('\n');
}
