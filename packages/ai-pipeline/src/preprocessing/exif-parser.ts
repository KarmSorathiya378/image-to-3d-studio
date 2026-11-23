/**
 * Safe EXIF parser to extract orientation metadata without native C++ libraries.
 * Handles EXIF tags in JPEG files to normalize orientation correctly.
 */

export interface ExifOrientationInfo {
  orientation: number; // 1 to 8
  rotationDegrees: number; // 0, 90, 180, 270
  flipHorizontal: boolean;
}

export function parseExifOrientation(buffer: Buffer): ExifOrientationInfo {
  const defaultInfo: ExifOrientationInfo = {
    orientation: 1,
    rotationDegrees: 0,
    flipHorizontal: false,
  };

  // Only JPEGs store EXIF in APP1 markers
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return defaultInfo;
  }

  let offset = 2;
  const length = buffer.length;

  while (offset < length - 4) {
    if (buffer[offset] !== 0xff) {
      offset++;
      continue;
    }

    const marker = buffer[offset + 1];

    // APP1 marker (EXIF) = 0xFF 0xE1
    if (marker === 0xe1) {
      const segLength = buffer.readUInt16BE(offset + 2);
      if (offset + 2 + segLength > length) break;

      const exifHeader = buffer.toString('ascii', offset + 4, offset + 8);
      if (exifHeader === 'Exif') {
        const tiffOffset = offset + 10;
        return extractTiffOrientation(buffer, tiffOffset, offset + 2 + segLength);
      }
    }

    // Stop at Start of Scan (0xDA)
    if (marker === 0xda) break;

    const segLen = buffer.readUInt16BE(offset + 2);
    offset += 2 + segLen;
  }

  return defaultInfo;
}

function extractTiffOrientation(buffer: Buffer, tiffOffset: number, maxOffset: number): ExifOrientationInfo {
  const defaultInfo: ExifOrientationInfo = {
    orientation: 1,
    rotationDegrees: 0,
    flipHorizontal: false,
  };

  if (tiffOffset + 8 > maxOffset) return defaultInfo;

  // Byte order: "II" (0x4949) = Little Endian, "MM" (0x4D4D) = Big Endian
  const byteOrderSig = buffer.readUInt16BE(tiffOffset);
  const isLittleEndian = byteOrderSig === 0x4949;
  const isBigEndian = byteOrderSig === 0x4d4d;

  if (!isLittleEndian && !isBigEndian) return defaultInfo;

  const read16 = (o: number) =>
    isLittleEndian ? buffer.readUInt16LE(o) : buffer.readUInt16BE(o);
  const read32 = (o: number) =>
    isLittleEndian ? buffer.readUInt32LE(o) : buffer.readUInt32BE(o);

  const fortyTwo = read16(tiffOffset + 2);
  if (fortyTwo !== 42) return defaultInfo;

  const firstIfdOffset = read32(tiffOffset + 4);
  const ifd0 = tiffOffset + firstIfdOffset;

  if (ifd0 + 2 > maxOffset) return defaultInfo;
  const numEntries = read16(ifd0);

  for (let i = 0; i < numEntries; i++) {
    const entryOffset = ifd0 + 2 + i * 12;
    if (entryOffset + 12 > maxOffset) break;

    const tag = read16(entryOffset);
    // Tag 0x0112 is Orientation
    if (tag === 0x0112) {
      const type = read16(entryOffset + 2);
      const count = read32(entryOffset + 4);
      if (type === 3 && count === 1) { // Type 3 is SHORT
        const orientation = read16(entryOffset + 8);
        return orientationToTransform(orientation);
      }
    }
  }

  return defaultInfo;
}

function orientationToTransform(orientation: number): ExifOrientationInfo {
  // Standard EXIF orientation mapping:
  // 1 = Top-Left (0 deg)
  // 2 = Top-Right (flip horizontal)
  // 3 = Bottom-Right (rotate 180)
  // 4 = Bottom-Left (flip vertical)
  // 5 = Left-Top (transpose)
  // 6 = Right-Top (rotate 90 CW)
  // 7 = Right-Bottom (transverse)
  // 8 = Left-Bottom (rotate 270 CW)
  switch (orientation) {
    case 1:
      return { orientation: 1, rotationDegrees: 0, flipHorizontal: false };
    case 2:
      return { orientation: 2, rotationDegrees: 0, flipHorizontal: true };
    case 3:
      return { orientation: 3, rotationDegrees: 180, flipHorizontal: false };
    case 4:
      return { orientation: 4, rotationDegrees: 180, flipHorizontal: true };
    case 5:
      return { orientation: 5, rotationDegrees: 270, flipHorizontal: true };
    case 6:
      return { orientation: 6, rotationDegrees: 90, flipHorizontal: false };
    case 7:
      return { orientation: 7, rotationDegrees: 90, flipHorizontal: true };
    case 8:
      return { orientation: 8, rotationDegrees: 270, flipHorizontal: false };
    default:
      return { orientation: 1, rotationDegrees: 0, flipHorizontal: false };
  }
}
