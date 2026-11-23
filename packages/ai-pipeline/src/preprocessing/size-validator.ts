import { ImageValidationError } from '../errors/pipeline-errors.ts';
import type { ImagePreprocessOptions } from './types.ts';

export const DEFAULT_PREPROCESS_OPTIONS: Required<ImagePreprocessOptions> = {
  maxByteSize: 10 * 1024 * 1024, // 10 MB per PRD
  minWidth: 32,
  minHeight: 32,
  maxWidth: 4096,
  maxHeight: 4096,
  maxPixelCount: 16_777_216, // 4096 x 4096
  targetLongestEdge: 1536,
  allowedFormats: ['jpeg', 'png', 'webp'],
};

/**
 * Validates image dimensions, file size, and pixel limits to protect against dimension/zip bombs.
 */
export function validateImageSize(
  byteLength: number,
  width: number,
  height: number,
  options: ImagePreprocessOptions = {}
): void {
  const opts = { ...DEFAULT_PREPROCESS_OPTIONS, ...options };

  if (byteLength > opts.maxByteSize) {
    throw new ImageValidationError(
      'IMAGE_TOO_LARGE',
      `Image size (${(byteLength / 1024 / 1024).toFixed(2)} MB) exceeds maximum allowed limit of ${(opts.maxByteSize / 1024 / 1024).toFixed(0)} MB.`
    );
  }

  if (width < opts.minWidth || height < opts.minHeight) {
    throw new ImageValidationError(
      'IMAGE_DIMENSIONS_OUT_OF_BOUNDS',
      `Image resolution (${width}x${height}) is too small. Minimum supported resolution is ${opts.minWidth}x${opts.minHeight}.`
    );
  }

  if (width > opts.maxWidth || height > opts.maxHeight) {
    throw new ImageValidationError(
      'IMAGE_DIMENSIONS_OUT_OF_BOUNDS',
      `Image resolution (${width}x${height}) exceeds maximum supported resolution of ${opts.maxWidth}x${opts.maxHeight}.`
    );
  }

  const pixelCount = width * height;
  if (pixelCount > opts.maxPixelCount) {
    throw new ImageValidationError(
      'DIMENSION_BOMB_DETECTED',
      `Decompression bomb rejected: pixel count (${pixelCount.toLocaleString()}) exceeds safety limit of ${opts.maxPixelCount.toLocaleString()}.`
    );
  }

  // Extreme aspect ratios (e.g. 100:1) are typical of exploit payloads or corrupt files
  const aspectRatio = width / height;
  if (aspectRatio > 20 || aspectRatio < 0.05) {
    throw new ImageValidationError(
      'IMAGE_DIMENSIONS_OUT_OF_BOUNDS',
      `Extreme aspect ratio (${aspectRatio.toFixed(2)}) is outside plausible physical object bounds.`
    );
  }
}
