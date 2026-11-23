import { ImageValidationError } from '../errors/pipeline-errors.ts';
import type { SupportedImageFormat } from './types.ts';

export interface DecodedDimensions {
  width: number;
  height: number;
  channels: number;
  hasAlpha: boolean;
}

/**
 * Safely decodes image dimensions and channels from binary headers without running external decoders.
 */
export function decodeImageDimensions(buffer: Buffer, format: SupportedImageFormat): DecodedDimensions {
  switch (format) {
    case 'png':
      return decodePng(buffer);
    case 'jpeg':
      return decodeJpeg(buffer);
    case 'webp':
      return decodeWebp(buffer);
  }
}

function decodePng(buffer: Buffer): DecodedDimensions {
  // PNG IHDR chunk is located at offset 8 (length: 4, type: 4, data: 13, crc: 4)
  if (buffer.length < 24) {
    throw new ImageValidationError('CORRUPT_IMAGE_HEADER', 'Corrupt PNG: file truncated before IHDR header');
  }

  const chunkType = buffer.toString('ascii', 12, 16);
  if (chunkType !== 'IHDR') {
    throw new ImageValidationError('CORRUPT_IMAGE_HEADER', `Invalid PNG: expected IHDR chunk, got ${chunkType}`);
  }

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const colorType = buffer.readUInt8(25);

  if (width <= 0 || height <= 0) {
    throw new ImageValidationError('CORRUPT_IMAGE_HEADER', `Invalid PNG dimensions: ${width}x${height}`);
  }

  // PNG color types: 0=grayscale, 2=RGB, 3=indexed, 4=grayscale+alpha, 6=RGBA
  const hasAlpha = colorType === 4 || colorType === 6;
  const channels = colorType === 0 ? 1 : colorType === 2 ? 3 : colorType === 4 ? 2 : colorType === 6 ? 4 : 3;

  return { width, height, channels, hasAlpha };
}

function decodeJpeg(buffer: Buffer): DecodedDimensions {
  let offset = 2; // skip 0xFF 0xD8
  const length = buffer.length;

  while (offset < length) {
    if (buffer[offset] !== 0xff) {
      offset++;
      continue;
    }

    const marker = buffer[offset + 1];

    // Standalone markers without length: SOI(D8), EOI(D9), TEM(01), RST0..7(D0..D7)
    if (marker === 0xd9 || marker === 0xda) {
      // End of Image or Start of Scan without finding SOF
      break;
    }

    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      offset += 2;
      continue;
    }

    if (offset + 4 > length) {
      break;
    }

    const segmentLength = buffer.readUInt16BE(offset + 2);

    // SOF markers: C0 (Baseline), C1 (Extended), C2 (Progressive), C3 (Lossless),
    // C5, C6, C7, C9, CA, CB, CD, CE, CF
    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isSof && marker !== 0xc4 && marker !== 0xcc) {
      if (offset + 2 + segmentLength > length || segmentLength < 7) {
        throw new ImageValidationError('CORRUPT_IMAGE_HEADER', 'Corrupt JPEG: truncated SOF frame');
      }

      const precision = buffer.readUInt8(offset + 4);
      const height = buffer.readUInt16BE(offset + 5);
      const width = buffer.readUInt16BE(offset + 7);
      const components = buffer.readUInt8(offset + 9);

      if (width <= 0 || height <= 0) {
        throw new ImageValidationError('CORRUPT_IMAGE_HEADER', `Invalid JPEG dimensions: ${width}x${height}`);
      }

      return {
        width,
        height,
        channels: components,
        hasAlpha: false,
      };
    }

    offset += 2 + segmentLength;
  }

  throw new ImageValidationError('CORRUPT_IMAGE_HEADER', 'Corrupt JPEG: no valid SOF frame found');
}

function decodeWebp(buffer: Buffer): DecodedDimensions {
  if (buffer.length < 30) {
    throw new ImageValidationError('CORRUPT_IMAGE_HEADER', 'Corrupt WebP: buffer too small');
  }

  const chunkType = buffer.toString('ascii', 12, 16);

  if (chunkType === 'VP8 ') {
    // Lossy VP8 format
    if (buffer.length < 30) {
      throw new ImageValidationError('CORRUPT_IMAGE_HEADER', 'Corrupt VP8 WebP header');
    }
    // Keyframe signature check (starts at offset 23 with 0x9D 0x01 0x2A)
    const keyframeSig =
      buffer[23] === 0x9d && buffer[24] === 0x01 && buffer[25] === 0x2a;
    if (!keyframeSig) {
      throw new ImageValidationError('CORRUPT_IMAGE_HEADER', 'Corrupt VP8 WebP keyframe signature');
    }

    const width = buffer.readUInt16LE(26) & 0x3fff;
    const height = buffer.readUInt16LE(28) & 0x3fff;
    return { width, height, channels: 3, hasAlpha: false };
  } else if (chunkType === 'VP8L') {
    // Lossless VP8L format
    if (buffer.length < 25) {
      throw new ImageValidationError('CORRUPT_IMAGE_HEADER', 'Corrupt VP8L WebP header');
    }
    if (buffer[20] !== 0x2f) {
      throw new ImageValidationError('CORRUPT_IMAGE_HEADER', 'Invalid VP8L signature byte');
    }

    const b0 = buffer[21];
    const b1 = buffer[22];
    const b2 = buffer[23];
    const b3 = buffer[24];

    const width = 1 + (((b1 & 0x3f) << 8) | b0);
    const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
    const hasAlpha = ((b3 & 0x10) >> 4) === 1;

    return { width, height, channels: hasAlpha ? 4 : 3, hasAlpha };
  } else if (chunkType === 'VP8X') {
    // Extended WebP format
    if (buffer.length < 30) {
      throw new ImageValidationError('CORRUPT_IMAGE_HEADER', 'Corrupt VP8X WebP header');
    }
    const flags = buffer[20];
    const hasAlpha = (flags & 0x10) !== 0;

    const width = 1 + buffer.readUIntLE(24, 3);
    const height = 1 + buffer.readUIntLE(27, 3);

    return { width, height, channels: hasAlpha ? 4 : 3, hasAlpha };
  }

  throw new ImageValidationError('CORRUPT_IMAGE_HEADER', `Unsupported WebP subtype: ${chunkType}`);
}
