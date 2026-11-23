/**
 * Resolves a GLB source (URL, Blob, or ArrayBuffer) into an actual binary Blob.
 */
export async function downloadGlbBlob(
  src: string | Blob | ArrayBuffer,
  filename = 'model.glb'
): Promise<Blob> {
  if (typeof Blob !== 'undefined' && src instanceof Blob) {
    return src;
  }

  if (src instanceof ArrayBuffer) {
    return new Blob([src], { type: 'model/gltf-binary' });
  }

  if (typeof src === 'string') {
    // Handle data URIs or network/blob URLs
    const response = await fetch(src);
    if (!response.ok) {
      throw new Error(`Failed to download GLB model: ${response.status} ${response.statusText}`);
    }
    const blob = await response.blob();
    return new Blob([blob], { type: 'model/gltf-binary' });
  }

  throw new Error(`Unsupported source type for GLB download: ${typeof src}`);
}

/**
 * Triggers a browser file download for a given Blob.
 */
export function triggerBlobDownload(blob: Blob, filename = 'model.glb'): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    // Non-browser environment (Node / test runner)
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.glb') ? filename : `${filename}.glb`;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();

  // Cleanup after trigger
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
}
