# @image-to-3d/ai-pipeline

> VLM visual analysis, image preprocessing, and geometry planning pipeline for **AI Image-to-3D Studio**.

---

## 🌟 Overview

The `ai-pipeline` package is responsible for the intelligence layer of the Image-to-3D Studio platform. Because general-purpose Vision-Language Models (VLMs) and LLMs do not directly emit valid 3D binary geometry (such as `.glb` meshes), this package bridges the gap by decomposing the process into three strictly controlled, observable stages:

1. **Image Preprocessing:** Validates, sanitizes, and normalizes uploaded raster images (JPG, PNG, WebP) with signature sniffing, safe header decoding, EXIF orientation correction, dimension bomb defense, and directory traversal sanitization.
2. **Vision-Language Analysis:** Constructs prompts and validates responses that turn a 2D photograph into a `StructuredObjectDescription` detailing components, relative proportions, suggested primitives, physical PBR materials, symmetry, and camera angles—while strictly forbidding models from overclaiming exact real-world metric dimensions.
3. **Geometry Planning:** Converts the semantic analysis into a strictly validated `SceneSpec` v1 payload (conforming to `packages/contracts` and PRD specifications), aligning the base to the ground plane ($Z=0$), centering $(X, Y)$, and enforcing bounded geometry invariants.
4. **Repair & Retry Engine:** Deterministically strips markdown code fences, removes trailing commas, repairs truncated JSON responses, clamps coordinates to $[-10.0, 10.0]$, auto-synthesizes missing materials, and executes exponential backoff with jitter on transient provider errors (429, timeouts, 5xx).

---

## 📁 Architecture & Directory Layout

```text
packages/ai-pipeline/
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── index.ts                      # Top-level public exports
│   ├── pipeline.ts                   # Unified end-to-end pipeline runner
│   │
│   ├── errors/                       # Strongly typed error hierarchy
│   │   ├── index.ts
│   │   └── pipeline-errors.ts        # ImageValidationError, MalformedModelOutputError, etc.
│   │
│   ├── preprocessing/                # Image decoding, validation & sanitization
│   │   ├── index.ts
│   │   ├── mime-detector.ts          # Magic byte sniffing (JPG, PNG, WebP)
│   │   ├── image-decoder.ts          # Safe binary header parsing (SOF, IHDR, VP8)
│   │   ├── exif-parser.ts            # JPEG APP1 / TIFF EXIF orientation extraction
│   │   ├── size-validator.ts         # Max 10MB, 32-4096px, decompression bomb limits
│   │   ├── security-sanitizer.ts     # Polyglot detection, directory traversal defense
│   │   ├── resizer.ts                # Aspect-ratio-preserving resize calculation
│   │   └── types.ts                  # Preprocessing types
│   │
│   ├── vision/                       # Vision-Language Model analysis
│   │   ├── index.ts
│   │   ├── schemas.ts                # StructuredObjectDescription validation
│   │   ├── prompts.ts                # VLM system prompt & instruction builders
│   │   ├── mock-analyzer.ts          # Deterministic offline mock VLM analyzer
│   │   ├── analyzer.ts               # Vision analyzer coordinator
│   │   └── types.ts                  # Vision types & interfaces
│   │
│   ├── planning/                     # Geometry planning & SceneSpec generation
│   │   ├── index.ts
│   │   ├── scenespec-schema.ts       # SceneSpec v1 schema & invariant validator
│   │   ├── contract-loader.ts        # Dynamic loader for @image-to-3d/contracts
│   │   ├── primitive-rules.ts        # Semantic role to primitive mapping
│   │   ├── prompts.ts                # Planner LLM prompt builders
│   │   ├── mock-planner.ts           # Deterministic mock planner fixtures
│   │   ├── planner.ts                # Geometry planner coordinator (grounding & centering)
│   │   └── types.ts                  # SceneSpec types
│   │
│   └── repair/                       # Fault tolerance, JSON repair & retry logic
│       ├── index.ts
│       ├── json-repair.ts            # Markdown stripping, quote/comma fix, truncation recovery
│       ├── response-repairer.ts      # Domain repair: clamping, material linking, defaults
│       ├── retry-policy.ts           # Exponential backoff, jitter, retry classifier
│       ├── reprompt-builder.ts       # Targeted reprompt builder for failed outputs
│       └── types.ts                  # Repair types
│
└── tests/                            # Automated test suite
    ├── fixtures/
    │   └── sample-buffers.ts         # Synthetic PNG, JPEG, WebP, and corrupt buffers
    ├── preprocessing.test.ts         # MIME, dimensions, decompression bombs, traversal
    ├── vision-analysis.test.ts       # Schema invariants, color normalization, prompts
    ├── geometry-planner.test.ts      # SceneSpec v1 validation, grounding, centering
    ├── repair-retry.test.ts          # JSON repair heuristics, retry loop, error classification
    └── pipeline-e2e.test.ts          # Mock image to valid SceneSpec end-to-end integration
```

---

## 🔒 Security & Invariants

1. **MIME Sniffing:** Checks real magic bytes (`0xFF 0xD8 0xFF` for JPEG, `89 50 4E 47` for PNG, `RIFF...WEBP` for WebP). Disallows HTML, SVGs, and executables.
2. **Decompression Bomb Protection:** Caps maximum pixel area at 16,777,216 pixels and upload size at 10 MB.
3. **Polyglot & Traversal Defense:** Scans upload headers for script/HTML injection tokens and strips path traversal sequences (`../`, null bytes).
4. **No Arbitrary Code Execution:** `SceneSpec` strictly restricts primitives to: `box`, `cylinder`, `sphere`, `cone`, `capsule`, `torus`, `lathe`, `extrudedPolygon`. No executable Python strings, shader code, or shell commands are accepted.
5. **Bounded Geometry:** Coordinates bounded within $[-10.0, 10.0]$, max 64 parts, sizes strictly positive and $\le 20.0$.
6. **Physical Materials:** Roughness and metallic clamped to $[0.0, 1.0]$, hex colors normalized to uppercase 6-digit RGB `#RRGGBB`.
7. **No Plaintext Secrets:** This package contains zero hardcoded API keys or provider tokens.

---

## 🚀 Usage Example

```typescript
import {
  preprocessImage,
  executeAiPipeline,
  planGeometryFromDescription,
  validateSceneSpec,
} from '@image-to-3d/ai-pipeline';

// 1. End-to-End Pipeline
const rawBuffer = Buffer.from(...); // Uploaded image bytes
const result = await executeAiPipeline(rawBuffer, {
  mockMode: true, // Uses deterministic procedural mock for testing
  mockCategory: 'stool',
  originalFilename: 'stool.png',
  userInstructions: 'Keep the stool seat rounded and thick',
});

console.log('Preprocessed:', result.preprocessedImage.metadata);
console.log('Object Category:', result.objectDescription.category);
console.log('SceneSpec Parts:', result.sceneSpec.parts.length);
console.log('Ground plane bottom Z:', result.sceneSpec.parts[0].position[2]);
```

---

## 🧪 Testing

Run the full automated test suite using Node 24 native TypeScript test runner:

```bash
npm test
```
