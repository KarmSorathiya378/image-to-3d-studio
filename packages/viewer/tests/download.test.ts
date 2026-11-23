import { describe, it } from 'node:test';
import assert from 'node:assert';
import { downloadGlbBlob } from '../dist/utils/download.js';
import { createBoxGlbBuffer } from '../dist/utils/gltf-fixture.js';

describe('GLB Download Helper', () => {
  it('converts an ArrayBuffer to a valid GLB Blob', async () => {
    const glbBuffer = createBoxGlbBuffer();
    const blob = await downloadGlbBlob(glbBuffer, 'test.glb');

    assert.ok(blob instanceof Blob);
    assert.strictEqual(blob.type, 'model/gltf-binary');
    assert.strictEqual(blob.size, glbBuffer.byteLength);

    // Verify GLB magic header 'glTF' (0x67, 0x6C, 0x54, 0x46)
    const arrayBuf = await blob.arrayBuffer();
    const dataView = new DataView(arrayBuf);
    const magic = dataView.getUint32(0, true);
    assert.strictEqual(magic, 0x46546C67, 'Magic must be 0x46546C67 (glTF)');
  });

  it('passes through an existing Blob unchanged', async () => {
    const originalBlob = new Blob([new Uint8Array([1, 2, 3, 4])], {
      type: 'model/gltf-binary',
    });
    const result = await downloadGlbBlob(originalBlob);

    assert.strictEqual(result, originalBlob);
    assert.strictEqual(result.size, 4);
  });

  it('fetches a data URI or blob URL and returns a real GLB Blob', async () => {
    const glbBuffer = createBoxGlbBuffer();
    const base64 = Buffer.from(glbBuffer).toString('base64');
    const dataUri = `data:model/gltf-binary;base64,${base64}`;

    const blob = await downloadGlbBlob(dataUri, 'downloaded.glb');

    assert.ok(blob instanceof Blob);
    assert.strictEqual(blob.type, 'model/gltf-binary');
    assert.strictEqual(blob.size, glbBuffer.byteLength);
  });

  it('rejects unsupported input sources with clear error', async () => {
    await assert.rejects(
      async () => {
        // @ts-expect-error Testing invalid input type
        await downloadGlbBlob(12345);
      },
      /Unsupported source type/
    );
  });
});
