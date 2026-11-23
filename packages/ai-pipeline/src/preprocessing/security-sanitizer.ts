import { createHash } from 'node:crypto';
import { basename, extname } from 'node:path';
import { ImageValidationError } from '../errors/pipeline-errors.ts';
import type { SupportedImageFormat } from './types.ts';

/**
 * Validates against polyglot files, path traversal, and malicious scripts inside image payloads.
 */
export function sanitizeUpload(
  buffer: Buffer,
  originalFilename?: string,
  format: SupportedImageFormat = 'jpeg'
): { sanitizedFilename: string; sha256: string } {
  const sha256 = createHash('sha256').update(buffer).digest('hex');

  // Check for malicious polyglot content (e.g. embedded PHP/HTML/script payload in binary)
  const headerSlice = buffer.subarray(0, Math.min(buffer.length, 8192));
  const rawAscii = headerSlice.toString('latin1').toLowerCase();

  const dangerousTokens = [
    '<?php',
    '<script',
    'javascript:',
    'eval(',
    '<html',
    '<!doctype html',
  ];

  for (const token of dangerousTokens) {
    if (rawAscii.includes(token)) {
      throw new ImageValidationError(
        'SECURITY_RISK_DETECTED',
        `Potentially malicious payload token detected in image payload: "${token}". Upload rejected.`
      );
    }
  }

  // Generate safe filename using SHA256 hash and verified format extension
  const ext = format === 'jpeg' ? '.jpg' : format === 'png' ? '.png' : '.webp';
  let safeBase = sha256.substring(0, 16);

  if (originalFilename) {
    const cleanName = basename(originalFilename)
      .replace(/[^a-zA-Z0-9_\-\.]/g, '_')
      .replace(/\.\.+/g, '.');
    const existingExt = extname(cleanName);
    const stem = cleanName.substring(0, cleanName.length - existingExt.length).substring(0, 32);
    if (stem.length > 0) {
      safeBase = `${stem}_${sha256.substring(0, 8)}`;
    }
  }

  return {
    sanitizedFilename: `${safeBase}${ext}`,
    sha256,
  };
}
