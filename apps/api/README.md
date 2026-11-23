# Image-to-3D Studio - Backend API (`apps/api`)

FastAPI (Python 3.11+, Pydantic v2) backend service for AI Image-to-3D Studio.

## Features

- **Authentication & Sessions**: Email/password registration with bcrypt hashing, high-entropy cryptographic session tokens (stored hashed via SHA-256), session expiration, and explicit revocation.
- **Strict Authorization & Ownership**: Every primary resource (`Project`, `UploadedAsset`, `UserCredential`, `GenerationJob`, `ModelVersion`, `ExportRecord`) is user-scoped and verified with ownership checks preventing cross-user data leakage.
- **BYOK Credential Vault Interface**: Envelope encryption interface with AES-256-GCM. Plaintext credentials are never persisted to the database or returned in API responses; masked fingerprints (e.g. `gsk••••y`) only.
- **Job Orchestration & Idempotency**: Asynchronous generation jobs with database-enforced idempotency (`(user_id, idempotency_key)`), execution attempt tracking, stage transitions, and safe retry semantics.
- **Audit Logging**: Immutable audit logging for sensitive user actions (registrations, logins, project edits, credential creation, and exports).

## Run & Test

```bash
# Run tests
python -m pytest apps/api/tests -v

# Run local development server
uvicorn apps.api.src.main:app --reload --port 8000
```
