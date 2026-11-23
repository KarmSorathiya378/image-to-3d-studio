import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  preprocessImage,
  sniffImageMime,
  decodeImageDimensions,
  validateImageSize,
  sanitizeUpload,
} from '../src/preprocessing/index.ts';
import { ImageValidationError } from '../src/errors/pipeline-errors.ts';
import {
  VALID_PNG_1X1,
  VALID_JPEG_64X64,
  createValidWebpBuffer,
  SPOOFED_HTML_BUFFER,
  POLYGLOT_SCRIPT_BUFFER,
  CORRUPT_PNG_BUFFER,
} from './fixtures/sample-buffers.ts';

describe('Image Preprocessing - Acceptance Checks', () => {
  it('accepts and normalizes valid PNG image', () => {
    const result = preprocessImage(VALID_PNG_1X1, 'photo.png');
    assert.strictEqual(result.metadata.format, 'png');
    assert.strictEqual(result.metadata.mimeType, 'image/png');
    assert.strictEqual(result.metadata.width, 64);
    assert.strictEqual(result.metadata.height, 64);
    assert.strictEqual(result.metadata.hasAlpha, true);
    assert.ok(result.base64DataUrl.startsWith('data:image/png;base64,'));
    assert.ok(result.sanitizedFilename.endsWith('.png'));
  });

  it('accepts and normalizes valid JPEG image', () => {
    const result = preprocessImage(VALID_JPEG_64X64, 'desk_chair.jpg');
    assert.strictEqual(result.metadata.format, 'jpeg');
    assert.strictEqual(result.metadata.mimeType, 'image/jpeg');
    assert.strictEqual(result.metadata.width, 64);
    assert.strictEqual(result.metadata.height, 64);
    assert.ok(result.base64DataUrl.startsWith('data:image/jpeg;base64,'));
    assert.ok(result.sanitizedFilename.endsWith('.jpg'));
  });

  it('accepts and normalizes valid WebP image', () => {
    const webpBuf = createValidWebpBuffer(128, 96);
    const result = preprocessImage(webpBuf, 'lamp.webp');
    assert.strictEqual(result.metadata.format, 'webp');
    assert.strictEqual(result.metadata.mimeType, 'image/webp');
    assert.strictEqual(result.metadata.width, 128);
    assert.strictEqual(result.metadata.height, 96);
  });

  it('rejects spoofed HTML/MIME file', () => {
    assert.throws(
      () => preprocessImage(SPOOFED_HTML_BUFFER, 'fake.png'),
      (err: unknown) => {
        return err instanceof ImageValidationError && err.code === 'INVALID_IMAGE_MIME';
      }
    );
  });

  it('rejects corrupt truncated image header', () => {
    assert.throws(
      () => preprocessImage(CORRUPT_PNG_BUFFER, 'corrupted.png'),
      (err: unknown) => {
        return err instanceof ImageValidationError && err.code === 'CORRUPT_IMAGE_HEADER';
      }
    );
  });

  it('rejects polyglot files with embedded script tags', () => {
    assert.throws(
      () => preprocessImage(POLYGLOT_SCRIPT_BUFFER, 'exploit.jpg'),
      (err: unknown) => {
        return err instanceof ImageValidationError && err.code === 'SECURITY_RISK_DETECTED';
      }
    );
  });

  it('rejects images exceeding max byte size limit (10 MB)', () => {
    assert.throws(
      () => validateImageSize(11 * 1024 * 1024, 1000, 1000, { maxByteSize: 10 * 1024 * 1024 }),
      (err: unknown) => {
        return err instanceof ImageValidationError && err.code === 'IMAGE_TOO_LARGE';
      }
    );
  });

  it('rejects decompression / dimension bombs', () => {
    assert.throws(
      () => validateImageSize(100000, 4000, 4000, { maxPixelCount: 10_000_000, maxWidth: 4096, maxHeight: 4096 }),
      (err: unknown) => {
        return err instanceof ImageValidationError && err.code === 'DIMENSION_BOMB_DETECTED';
      }
    );
  });

  it('rejects extreme aspect ratios indicative of exploit payloads', () => {
    assert.throws(
      () => validateImageSize(10000, 2000, 50),
      (err: unknown) => {
        return err instanceof ImageValidationError && err.code === 'IMAGE_DIMENSIONS_OUT_OF_BOUNDS';
      }
    );
  });

  it('sanitizes directory traversal in filenames', () => {
    const { sanitizedFilename } = sanitizeUpload(VALID_PNG_1X1, '../../etc/passwd.png', 'png');
    assert.ok(!sanitizedFilename.includes('..'));
    assert.ok(!sanitizedFilename.includes('/'));
    assert.ok(!sanitizedFilename.includes('\\'));
    assert.ok(sanitizedFilename.endsWith('.png'));
  });
});
