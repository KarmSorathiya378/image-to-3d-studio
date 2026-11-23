export type SupportedImageFormat = 'jpeg' | 'png' | 'webp';

export interface ImageMetadata {
  format: SupportedImageFormat;
  mimeType: string;
  width: number;
  height: number;
  aspectRatio: number;
  byteSize: number;
  sha256: string;
  exifOrientation: number; // 1-8 standard EXIF values
  channels?: number;
  hasAlpha?: boolean;
}

export interface ImagePreprocessOptions {
  /** Maximum allowed size in bytes (default 10 MB = 10,485,760 bytes) */
  maxByteSize?: number;
  /** Minimum width in pixels (default 32) */
  minWidth?: number;
  /** Minimum height in pixels (default 32) */
  minHeight?: number;
  /** Maximum width in pixels (default 4096) */
  maxWidth?: number;
  /** Maximum height in pixels (default 4096) */
  maxHeight?: number;
  /** Maximum pixel count (width * height) to prevent decompression bombs (default 16,777,216) */
  maxPixelCount?: number;
  /** Target max edge length for optimal VLM token economy (default 1536) */
  targetLongestEdge?: number;
  /** Allowed formats (default: ['jpeg', 'png', 'webp']) */
  allowedFormats?: SupportedImageFormat[];
}

export interface PreprocessedImage {
  buffer: Buffer;
  metadata: ImageMetadata;
  targetDimensions: {
    width: number;
    height: number;
    scaleFactor: number;
  };
  normalizedOrientation: {
    rotationDegrees: number; // 0, 90, 180, 270
    flipHorizontal: boolean;
  };
  base64DataUrl: string;
  sanitizedFilename: string;
}
