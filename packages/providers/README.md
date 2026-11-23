# @image-to-3d/providers

Universal Bring-Your-Own-Key (BYOK) Provider Layer and Capability Registry for **AI Image-to-3D Studio**.

---

## 🌟 Overview

The `@image-to-3d/providers` package is the core abstraction between AI foundation models and the 3D generation pipeline. It guarantees that:

1. **Models are strictly gated by capability:** Models are categorized according to their verified capabilities (vision, text, structured output, code generation, 3D specialist). Non-VLMs (e.g. `o1`, `gpt-3.5-turbo`, `llama-3.3-70b-versatile`) are **strictly rejected** for the vision analysis stage before incurring network calls or API charges.
2. **BYOK secrets are securely isolated:** User API keys are envelope-encrypted at rest using **AES-256-GCM** with Additional Authenticated Data (AAD) binding account and provider IDs. Keys are never logged, never returned in plaintext, and only held in memory during authorized inference execution.
3. **SSRF protection is enforced:** Custom base endpoints are validated against private IP ranges (RFC 1918), loopback addresses, AWS/GCP/Azure cloud metadata endpoints (`169.254.169.254`), and insecure protocols.
4. **Structured SceneSpec v1 alignment:** Provider responses are normalized into deterministic `ImageAnalysisResult` and `SceneSpecV1` geometric specifications with bounded coordinates (`[-10.0, 10.0]`) and verified primitives (`box`, `cylinder`, `sphere`, `cone`, `capsule`, `torus`, `lathe`, `extrudedPolygon`).

---

## 📦 Architecture & Supported Providers

| Provider | Adapter | Primary Capabilities | Non-billable Credential Validation |
|---|---|---|---|
| **OpenAI** | `OpenAIAdapter` | VLM (`gpt-4o`, `gpt-4o-mini`), Planner (`o1`, `o3-mini`, `gpt-4o`) | `GET /v1/models` |
| **Groq** | `GroqAdapter` | VLM (`llama-3.2-11b/90b-vision`), Planner (`llama-3.3-70b-versatile`) | `GET /openai/v1/models` |
| **Inception Labs** | `InceptionAdapter` | VLM (`mercury-vlm`), Planner (`mercury-coder`, `mercury-reasoner`) | `GET /v1/models` |
| **Google Gemini** | `GeminiAdapter` | Multimodal VLM & Planner (`gemini-1.5-pro/flash`, `gemini-2.0-flash`) | `GET /v1beta/models?key=...` |
| **Anthropic** | `AnthropicAdapter` | VLM & Planner (`claude-3-7-sonnet`, `claude-3-5-sonnet/haiku`) | `GET /v1/models` |
| **Tripo 3D** *(Specialist)* | `TripoAdapter` | Generative Image-to-3D (`tripo-v2.0`) *(gated by flag)* | `GET /v2/openapi/user/balance` |
| **Meshy** *(Specialist)* | `MeshyAdapter` | Generative Image-to-3D & Textures (`meshy-v4`) *(gated by flag)* | `GET /v1/user/info` |

---

## 🔒 Security & Credential Isolation

- **Envelope Encryption:** Each stored credential uses AES-256-GCM with a fresh 96-bit cryptographically secure IV (`crypto.randomBytes(12)`).
- **Cross-Account & Cross-Provider Tamper Protection:** The Additional Authenticated Data (AAD) is bound to `${accountId}:${providerId}`. Decrypting under a different account or swapped provider ID fails authenticated tag validation.
- **Masking:** Safe summaries present keys as `••••${key.slice(-4)}` (or `••••••••`). Plaintext keys are never echoed to clients.
- **SSRF Prevention:** Custom endpoints must be HTTPS and cannot resolve to `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `169.254.169.254`, `::1`, or `.internal` domains.

---

## 🧪 Running Tests

Tests run directly using Node.js native test runner:

```bash
cd packages/providers
node --experimental-strip-types --test tests/**/*.test.ts
```
