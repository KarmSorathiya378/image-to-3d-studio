# @image-to-3d/db

Database schema, relations, and migrations for the **AI Image-to-3D Studio**.

## Entities (14 Total)

1. **User** (`users`): System users with secure hashed password storage, email uniqueness, verification, and audit metadata.
2. **Session** (`sessions`): Secure user session tokens with hashed tokens, IP/User-Agent tracking, and revocation timestamp.
3. **Project** (`projects`): User-scoped 3D generation projects with ownership constraints.
4. **UploadedAsset** (`uploaded_assets`): Source reference images (PNG/JPEG), SHA-256 integrity checksums, and private storage keys.
5. **AIProvider** (`ai_providers`): Supported capability-tagged providers (`groq`, `openai`, `inception`, `google`, `anthropic`).
6. **UserCredential** (`user_credentials`): BYOK encrypted API credentials (AES-256-GCM ciphertext, nonces, key version, masked keys, never plaintext).
7. **ModelConfiguration** (`model_configurations`): Per-stage (VISION, PLANNER, SPECIALIST) user model preferences and credential bindings.
8. **GenerationJob** (`generation_jobs`): Asynchronous generation state machine (`CREATED` -> `QUEUED` -> `IMAGE_ANALYSIS` -> `SCENE_PLANNING` -> `BUILDING_GEOMETRY` -> `VALIDATING_ASSET` -> `SUCCEEDED` / `FAILED`), idempotency keys, error details.
9. **GenerationAttempt** (`generation_attempts`): Stage execution attempts, timestamps, and sanitized summaries.
10. **SceneSpecification** (`scene_specifications`): Validated `SceneSpec` v1 JSON representations.
11. **GeneratedAsset** (`generated_assets`): Validated 3D meshes (GLB), `.blend`, thumbnails, and triangle/vertex counts.
12. **ModelVersion** (`model_versions`): Versioned model releases per project.
13. **ExportRecord** (`export_records`): Audit logs of user asset downloads/exports.
14. **AuditEvent** (`audit_events`): Immutable compliance and activity logs (never containing secrets).

## Running Migrations

### Using Node / TypeScript
```bash
pnpm --filter @image-to-3d/db run migrate
# or
npx ts-node packages/db/src/migrate.ts
```

### Using Python
```bash
python packages/db/apply_migrations.py $DATABASE_URL
```

### Direct PostgreSQL SQL
```bash
psql $DATABASE_URL -f packages/db/migrations/0000_initial_schema.sql
```
