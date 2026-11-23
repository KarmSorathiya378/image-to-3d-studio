/**
 * Calculates constrained target dimensions maintaining exact aspect ratio,
 * and formats base64 payload strings for VLM transmission.
 */

export interface ResizePlan {
  targetWidth: number;
  targetHeight: number;
  scaleFactor: number;
  needsResize: boolean;
}

export function computeResizePlan(
  width: number,
  height: number,
  targetLongestEdge = 1536
): ResizePlan {
  const longestEdge = Math.max(width, height);

  if (longestEdge <= targetLongestEdge) {
    return {
      targetWidth: width,
      targetHeight: height,
      scaleFactor: 1.0,
      needsResize: false,
    };
  }

  const scaleFactor = targetLongestEdge / longestEdge;
  const targetWidth = Math.max(1, Math.round(width * scaleFactor));
  const targetHeight = Math.max(1, Math.round(height * scaleFactor));

  return {
    targetWidth,
    targetHeight,
    scaleFactor,
    needsResize: true,
  };
}

/**
 * Builds data URL format standard for VLM vision API requests.
 */
export function bufferToDataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}
