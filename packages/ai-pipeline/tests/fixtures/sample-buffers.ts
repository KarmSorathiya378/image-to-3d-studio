/**
 * Synthetic, valid minimal image binary buffers for hermetic automated testing without external asset dependencies.
 */

/**
 * Minimal valid 1x1 transparent PNG buffer.
 * Header: 89 50 4E 47 0D 0A 1A 0A
 * IHDR: length 13, type 'IHDR', width 1, height 1, bit depth 8, color type 6 (RGBA), comp 0, filter 0, interlace 0, CRC
 * IDAT: empty scanline
 * IEND: standard PNG EOF
 */
export const VALID_PNG_1X1 = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG Signature
  0x00, 0x00, 0x00, 0x0d, // IHDR chunk length (13 bytes)
  0x49, 0x48, 0x44, 0x52, // 'IHDR'
  0x00, 0x00, 0x00, 0x40, // width: 64 px
  0x00, 0x00, 0x00, 0x40, // height: 64 px
  0x08, // bit depth: 8
  0x06, // color type: 6 (RGBA)
  0x00, // compression: 0
  0x00, // filter: 0
  0x00, // interlace: 0
  0xe0, 0x86, 0x57, 0x41, // CRC
  0x00, 0x00, 0x00, 0x0a, // IDAT length (10 bytes)
  0x49, 0x44, 0x41, 0x54, // 'IDAT'
  0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, // zlib stream
  0x0d, 0x0a, 0x2d, 0xb4, // CRC
  0x00, 0x00, 0x00, 0x00, // IEND length (0)
  0x49, 0x45, 0x4e, 0x44, // 'IEND'
  0xae, 0x42, 0x60, 0x82, // CRC
]);

/**
 * Minimal valid JPEG buffer (with SOI, APP0, SOF0 64x64, SOS, EOI).
 */
export const VALID_JPEG_64X64 = Buffer.from([
  0xff, 0xd8, // SOI
  0xff, 0xe0, 0x00, 0x10, // APP0 length 16
  0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
  0xff, 0xc0, 0x00, 0x11, // SOF0 length 17
  0x08, // 8-bit precision
  0x00, 0x40, // height: 64
  0x00, 0x40, // width: 64
  0x03, // 3 components (YCbCr)
  0x01, 0x11, 0x00, // component 1
  0x02, 0x11, 0x01, // component 2
  0x03, 0x11, 0x01, // component 3
  0xff, 0xda, 0x00, 0x08, // SOS length 8
  0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
  0xbf, 0x00, // scan data
  0xff, 0xd9, // EOI
]);

/**
 * Valid WebP VP8 buffer (RIFF...WEBPVP8 ...).
 */
export function createValidWebpBuffer(width = 64, height = 64): Buffer {
  const buf = Buffer.alloc(38);
  buf.write('RIFF', 0, 4, 'ascii');
  buf.writeUInt32LE(30, 4); // file length - 8
  buf.write('WEBP', 8, 4, 'ascii');
  buf.write('VP8 ', 12, 4, 'ascii');
  buf.writeUInt32LE(18, 16); // chunk size
  // VP8 frame header
  buf[20] = 0x10; // keyframe
  buf[21] = 0x00;
  buf[22] = 0x00;
  // Keyframe start code: 0x9D 0x01 0x2A
  buf[23] = 0x9d;
  buf[24] = 0x01;
  buf[25] = 0x2a;
  // Dimensions
  buf.writeUInt16LE(width & 0x3fff, 26);
  buf.writeUInt16LE(height & 0x3fff, 28);
  return buf;
}

/**
 * Spoofed MIME file: starts with text/HTML but named .png.
 */
export const SPOOFED_HTML_BUFFER = Buffer.from('<!DOCTYPE html><html><body>Not an image</body></html>');

/**
 * Malicious polyglot image: valid JPEG header followed by embedded script.
 */
export const POLYGLOT_SCRIPT_BUFFER = Buffer.concat([
  VALID_JPEG_64X64,
  Buffer.from('<script>alert("xss")</script>'),
]);

/**
 * Corrupted header: has valid 8-byte PNG signature + length + corrupt chunk type (not IHDR).
 */
export const CORRUPT_PNG_BUFFER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG Signature
  0x00, 0x00, 0x00, 0x0d, // chunk length
  0x58, 0x58, 0x58, 0x58, // 'XXXX' (invalid chunk type, expected IHDR)
  0x00, 0x00, 0x00, 0x01,
  0x00, 0x00, 0x00, 0x01,
]);
