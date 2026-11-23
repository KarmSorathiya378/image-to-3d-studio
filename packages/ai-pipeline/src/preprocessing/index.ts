import { sniffImageMime } from './mime-detector.ts';
import { decodeImageDimensions } from './image-decoder.ts';
import { parseExifOrientation } from './exif-parser.ts';
import { validateImageSize } from './size-validator.ts';
import { sanitizeUpload } from './security-sanitizer.ts';
import { computeResizePlan, bufferToDataUrl } from './resizer.ts';
import type { ImagePreprocessOptions, PreprocessedImage, ImageMetadata } from './types.ts';

export * from './types.ts';
export * from './mime-detector.ts';
export * from './image-decoder.ts';
export * from './exif-parser.ts';
export * from './size-validator.ts';
export * from './security-sanitizer.ts';
export * from './resizer.ts';

/**
 * Full image preprocessing pipeline:
 * 1. Sniffs signature and detects MIME
 * 2. Decodes dimensions safely without external binaries
 * 3. Extracts and normalizes EXIF orientation
 * 4. Validates size and checks against decompression bombs
 * 5. Sanitizes against polyglots and directory traversal
 * 6. Calculates aspect-ratio-preserving target dimensions
 * 7. Prepares base64 data URL for VLM payload
 */
export function preprocessImage(
  buffer: Buffer,
  originalFilename?: string,
  options?: ImagePreprocessOptions
): PreprocessedImage {
  // 1. Signature & MIME sniffing
  const { format, mimeType } = sniffImageMime(buffer);

  // 2. Decode dimensions
  const { width, height, channels, hasAlpha } = decodeImageDimensions(buffer, format);

  // 3. EXIF orientation
  const exifInfo = parseExifOrientation(buffer);

  // 4. Validate constraints & limits
  validateImageSize(buffer.length, width, height, options);

  // 5. Security & upload sanitation
  const { sanitizedFilename, sha256 } = sanitizeUpload(buffer, originalFilename, format);

  // 6. Resizing plan
  const resizePlan = computeResizePlan(width, height, options?.targetLongestEdge);

  const metadata: ImageMetadata = {
    format,
    mimeType,
    width,
    height,
    aspectRatio: Number((width / height).toFixed(4)),
    byteSize: buffer.length,
    sha256,
    exifOrientation: exifInfo.orientation,
    channels,
    hasAlpha,
  };

  return {
    buffer,
    metadata,
    targetDimensions: {
      width: resizePlan.targetWidth,
      height: resizePlan.targetHeight,
      scaleFactor: resizePlan.scaleFactor,
    },
    normalizedOrientation: {
      rotationDegrees: exifInfo.rotationDegrees,
      flipHorizontal: exifInfo.flipHorizontal,
    },
    base64DataUrl: bufferToDataUrl(buffer, mimeType),
    sanitizedFilename,
  };
}
