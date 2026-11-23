import { describe, it } from 'node:test';
import assert from 'node:assert';
import { executeAiPipeline } from '../src/pipeline.ts';
import { VALID_PNG_1X1, VALID_JPEG_64X64, SPOOFED_HTML_BUFFER } from './fixtures/sample-buffers.ts';
import { ImageValidationError } from '../src/errors/pipeline-errors.ts';

describe('End-to-End AI Pipeline - Acceptance Checks', () => {
  it('processes mock image into a valid SceneSpec v1', async () => {
    const result = await executeAiPipeline(VALID_PNG_1X1, {
      mockMode: true,
      mockCategory: 'stool',
      originalFilename: 'stool.png',
    });

    assert.strictEqual(result.success, true);

    // Preprocessing verification
    assert.strictEqual(result.preprocessedImage.metadata.format, 'png');
    assert.strictEqual(result.preprocessedImage.metadata.width, 64);
    assert.strictEqual(result.preprocessedImage.metadata.height, 64);
    assert.ok(result.preprocessedImage.base64DataUrl.startsWith('data:image/png;base64,'));

    // Vision Analysis verification
    assert.strictEqual(result.objectDescription.category, 'stool');
    assert.ok(result.objectDescription.confidence >= 0.9);
    assert.ok(result.objectDescription.components.length > 0);
    assert.ok(result.objectDescription.uncertaintyFlags.notes.length > 0);

    // Geometry Planning & SceneSpec verification
    const scene = result.sceneSpec;
    assert.strictEqual(scene.schemaVersion, '1.0');
    assert.strictEqual(scene.coordinateSystem, 'Z_UP');
    assert.strictEqual(scene.units, 'relative');
    assert.ok(scene.parts.length >= 3);
    assert.ok(scene.materials.length >= 1);

    // Ground plane verification: bottom surface must be near Z=0
    const minZ = Math.min(...scene.parts.map((p) => p.position[2] - p.size[2] / 2));
    assert.ok(Math.abs(minZ) < 0.05, `Ground plane bottom should be near Z=0, got ${minZ}`);

    // Material reference integrity: all part.materialId must resolve to scene.materials
    const matIds = new Set(scene.materials.map((m) => m.id));
    for (const part of scene.parts) {
      assert.ok(matIds.has(part.materialId), `Part ${part.id} references undefined materialId ${part.materialId}`);
      assert.ok(part.size[0] > 0 && part.size[1] > 0 && part.size[2] > 0);
    }
  });

  it('rejects invalid image input in end-to-end pipeline', async () => {
    await assert.rejects(
      async () => {
        await executeAiPipeline(SPOOFED_HTML_BUFFER, {
          mockMode: true,
          originalFilename: 'hacked.png',
        });
      },
      (err: unknown) => {
        return err instanceof ImageValidationError;
      }
    );
  });

  it('repairs malformed VLM output in live caller mode', async () => {
    // Simulate VLM returning markdown fenced JSON with trailing commas and unquoted keys
    const malformedVlmCaller = async () => {
      return `\`\`\`json
{
  category: "box",
  confidence: 0.9,
  summary: "A storage box with lid",
  cameraView: { estimatedAzimuthDeg: 45, estimatedElevationDeg: 20, distanceEstimate: "medium", viewAngleDescription: "Front" },
  proportions: { widthRatio: 1, depthRatio: 1, heightRatio: 0.8 },
  components: [
    { name: "body", suggestedPrimitive: "box", relativePosition: [0, 0, 0.4], relativeSize: [1.2, 1, 0.8], primaryColorHex: "#997755", materialType: "wood", materialId: "mat_1", },
  ],
  materials: [
    { id: "mat_1", baseColorHex: "#997755", roughness: 0.8, metallic: 0.0, },
  ],
  uncertaintyFlags: { notes: ["Single perspective view"] },
}
\`\`\``;
    };

    const result = await executeAiPipeline(VALID_JPEG_64X64, {
      mockMode: false,
      vlmCaller: malformedVlmCaller,
      originalFilename: 'box.jpg',
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.objectDescription.category, 'box');
    assert.strictEqual(result.sceneSpec.schemaVersion, '1.0');
    assert.ok(result.repairLogs.length > 0);
  });
});
