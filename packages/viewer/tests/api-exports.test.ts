import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as ViewerModule from '../dist/index.js';

describe('Viewer Public API Exports', () => {
  it('exports ModelViewer component as default and named export', () => {
    assert.ok(ViewerModule.ModelViewer, 'ModelViewer must be exported');
    assert.strictEqual(
      ViewerModule.ModelViewer,
      ViewerModule.default,
      'default export must equal ModelViewer'
    );
  });

  it('exports hook and calculation utilities', () => {
    assert.strictEqual(typeof ViewerModule.useModelLoader, 'function');
    assert.strictEqual(typeof ViewerModule.calculateModelBounds, 'function');
    assert.strictEqual(typeof ViewerModule.calculateModelStats, 'function');
    assert.strictEqual(typeof ViewerModule.disposeThreeObject, 'function');
    assert.strictEqual(typeof ViewerModule.disposeRenderer, 'function');
    assert.strictEqual(typeof ViewerModule.downloadGlbBlob, 'function');
    assert.strictEqual(typeof ViewerModule.triggerBlobDownload, 'function');
    assert.strictEqual(typeof ViewerModule.createBoxGlbBuffer, 'function');
  });
});
