/**
 * Generates a valid glTF 2.0 Binary (.glb) container in pure TypeScript.
 * Useful for automated tests, offline fixtures, and acceptance verification.
 */
export function createBoxGlbBuffer(): ArrayBuffer {
  // A standard unit cube [-0.5 to 0.5] with 24 vertices (6 faces * 4 vertices for proper normals)
  // 12 triangles (36 indices)
  const positions: number[] = [
    // Front face
    -0.5, -0.5,  0.5,   0.5, -0.5,  0.5,   0.5,  0.5,  0.5,  -0.5,  0.5,  0.5,
    // Back face
    -0.5, -0.5, -0.5,  -0.5,  0.5, -0.5,   0.5,  0.5, -0.5,   0.5, -0.5, -0.5,
    // Top face
    -0.5,  0.5, -0.5,  -0.5,  0.5,  0.5,   0.5,  0.5,  0.5,   0.5,  0.5, -0.5,
    // Bottom face
    -0.5, -0.5, -0.5,   0.5, -0.5, -0.5,   0.5, -0.5,  0.5,  -0.5, -0.5,  0.5,
    // Right face
     0.5, -0.5, -0.5,   0.5,  0.5, -0.5,   0.5,  0.5,  0.5,   0.5, -0.5,  0.5,
    // Left face
    -0.5, -0.5, -0.5,  -0.5, -0.5,  0.5,  -0.5,  0.5,  0.5,  -0.5,  0.5, -0.5,
  ];

  const normals: number[] = [
    // Front
    0, 0, 1,  0, 0, 1,  0, 0, 1,  0, 0, 1,
    // Back
    0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
    // Top
    0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0,
    // Bottom
    0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
    // Right
    1, 0, 0,  1, 0, 0,  1, 0, 0,  1, 0, 0,
    // Left
    -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
  ];

  const indices: number[] = [
    0, 1, 2,   0, 2, 3,       // Front
    4, 5, 6,   4, 6, 7,       // Back
    8, 9, 10,  8, 10, 11,     // Top
    12, 13, 14, 12, 14, 15,   // Bottom
    16, 17, 18, 16, 18, 19,   // Right
    20, 21, 22, 20, 22, 23,   // Left
  ];

  const posBuffer = new Float32Array(positions);
  const normBuffer = new Float32Array(normals);
  const indBuffer = new Uint16Array(indices);

  const posByteLength = posBuffer.byteLength;   // 24 * 3 * 4 = 288
  const normByteLength = normBuffer.byteLength; // 24 * 3 * 4 = 288
  const indByteLength = indBuffer.byteLength;   // 36 * 2 = 72

  // Total binary payload
  const totalBinLength = posByteLength + normByteLength + indByteLength; // 648 (multiple of 4)
  const binBuffer = new Uint8Array(totalBinLength);

  binBuffer.set(new Uint8Array(posBuffer.buffer), 0);
  binBuffer.set(new Uint8Array(normBuffer.buffer), posByteLength);
  binBuffer.set(new Uint8Array(indBuffer.buffer), posByteLength + normByteLength);

  const gltf = {
    asset: {
      version: '2.0',
      generator: 'Image-to-3D Studio Procedural Fixture',
    },
    scene: 0,
    scenes: [{ name: 'DefaultScene', nodes: [0] }],
    nodes: [{ name: 'BoxMeshNode', mesh: 0 }],
    meshes: [
      {
        name: 'BoxMesh',
        primitives: [
          {
            attributes: {
              POSITION: 0,
              NORMAL: 1,
            },
            indices: 2,
            material: 0,
          },
        ],
      },
    ],
    materials: [
      {
        name: 'DefaultMaterial',
        pbrMetallicRoughness: {
          baseColorFactor: [0.3, 0.6, 0.9, 1.0],
          metallicFactor: 0.1,
          roughnessFactor: 0.8,
        },
      },
    ],
    accessors: [
      {
        bufferView: 0,
        byteOffset: 0,
        componentType: 5126, // FLOAT
        count: 24,
        type: 'VEC3',
        max: [0.5, 0.5, 0.5],
        min: [-0.5, -0.5, -0.5],
      },
      {
        bufferView: 1,
        byteOffset: 0,
        componentType: 5126, // FLOAT
        count: 24,
        type: 'VEC3',
        max: [1, 1, 1],
        min: [-1, -1, -1],
      },
      {
        bufferView: 2,
        byteOffset: 0,
        componentType: 5123, // UNSIGNED_SHORT
        count: 36,
        type: 'SCALAR',
        max: [23],
        min: [0],
      },
    ],
    bufferViews: [
      {
        buffer: 0,
        byteOffset: 0,
        byteLength: posByteLength,
        target: 34962, // ARRAY_BUFFER
      },
      {
        buffer: 0,
        byteOffset: posByteLength,
        byteLength: normByteLength,
        target: 34962, // ARRAY_BUFFER
      },
      {
        buffer: 0,
        byteOffset: posByteLength + normByteLength,
        byteLength: indByteLength,
        target: 34963, // ELEMENT_ARRAY_BUFFER
      },
    ],
    buffers: [
      {
        byteLength: totalBinLength,
      },
    ],
  };

  const jsonString = JSON.stringify(gltf);
  const jsonEncoder = new TextEncoder();
  const rawJsonBytes = jsonEncoder.encode(jsonString);

  // JSON chunk must be padded with spaces (0x20) to a 4-byte boundary
  const jsonPadding = (4 - (rawJsonBytes.length % 4)) % 4;
  const jsonChunkLength = rawJsonBytes.length + jsonPadding;
  const jsonChunkBytes = new Uint8Array(jsonChunkLength);
  jsonChunkBytes.set(rawJsonBytes, 0);
  for (let i = 0; i < jsonPadding; i++) {
    jsonChunkBytes[rawJsonBytes.length + i] = 0x20;
  }

  // BIN chunk padding (0x00)
  const binPadding = (4 - (binBuffer.length % 4)) % 4;
  const binChunkLength = binBuffer.length + binPadding;
  const paddedBinBytes = new Uint8Array(binChunkLength);
  paddedBinBytes.set(binBuffer, 0);

  // Total GLB file length = 12 (header) + 8 (JSON chunk header) + jsonChunkLength + 8 (BIN chunk header) + binChunkLength
  const totalGlbLength = 12 + 8 + jsonChunkLength + 8 + binChunkLength;

  const glbBuffer = new ArrayBuffer(totalGlbLength);
  const dataView = new DataView(glbBuffer);
  const uint8View = new Uint8Array(glbBuffer);

  // Header
  // Magic: 'glTF' = 0x46546C67
  dataView.setUint32(0, 0x46546C67, true);
  // Version: 2
  dataView.setUint32(4, 2, true);
  // Total length
  dataView.setUint32(8, totalGlbLength, true);

  // Chunk 0: JSON
  let offset = 12;
  dataView.setUint32(offset, jsonChunkLength, true);
  dataView.setUint32(offset + 4, 0x4E4F534A, true); // 'JSON'
  offset += 8;
  uint8View.set(jsonChunkBytes, offset);
  offset += jsonChunkLength;

  // Chunk 1: BIN
  dataView.setUint32(offset, binChunkLength, true);
  dataView.setUint32(offset + 4, 0x004E4942, true); // 'BIN\0'
  offset += 8;
  uint8View.set(paddedBinBytes, offset);

  return glbBuffer;
}

/**
 * Returns a valid box GLB as a Blob.
 */
export function createBoxGlbBlob(): Blob {
  const buffer = createBoxGlbBuffer();
  return new Blob([buffer], { type: 'model/gltf-binary' });
}
