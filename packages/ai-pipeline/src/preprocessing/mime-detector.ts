import { ImageValidationError } from '../errors/pipeline-errors.ts';
import type { SupportedImageFormat } from './types.ts';

export interface SniffedMime {
  format: SupportedImageFormat;
  mimeType: string;
}

/**
 * Sniffs buffer magic bytes to verify genuine file signature.
 * Prevents MIME spoofing (e.g. executable disguised as .png).
 */
export function sniffImageMime(buffer: Buffer): SniffedMime {
  if (!buffer || buffer.length < 12) {
    throw new ImageValidationError(
      'INVALID_IMAGE_MIME',
      'Image file is empty or too small to contain a valid signature'
    );
  }

  // JPEG / JFIF / EXIF signature: starts with 0xFF 0xD8 0xFF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { format: 'jpeg', mimeType: 'image/jpeg' };
  }

  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { format: 'png', mimeType: 'image/png' };
  }

  // WebP signature: RIFF ... WEBP (bytes 0..3 = 'RIFF', bytes 8..11 = 'WEBP')
  const riffHeader = buffer.toString('ascii', 0, 4);
  const webpHeader = buffer.toString('ascii', 8, 12);
  if (riffHeader === 'RIFF' && webpHeader === 'WEBP') {
    return { format: 'webp', mimeType: 'image/webp' };
  }

  // Check for disallowed/dangerous formats
  const asciiHeader = buffer.toString('ascii', 0, Math.min(buffer.length, 64)).toLowerCase();
  if (asciiHeader.includes('<svg') || asciiHeader.includes('<?xml')) {
    throw new ImageValidationError(
      'INVALID_IMAGE_MIME',
      'SVG files are not supported. Upload a raster photograph (JPG, PNG, WebP).'
    );
  }
  if (asciiHeader.startsWith('gif87a') || asciiHeader.startsWith('gif89a')) {
    throw new ImageValidationError(
      'INVALID_IMAGE_MIME',
      'GIF images are not supported. Upload a static single-frame photo (JPG, PNG, WebP).'
    );
  }
  if (buffer[0] === 0x4d && buffer[1] === 0x5a) {
    throw new ImageValidationError(
      'SECURITY_RISK_DETECTED',
      'Executable binary disguised as image rejected.'
    );
  }

  throw new ImageValidationError(
    'INVALID_IMAGE_MIME',
    'Unsupported image format. Allowed formats are JPG, PNG, and WebP.'
  );
}
