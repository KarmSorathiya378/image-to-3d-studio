-- Migration: 0000_initial_schema.sql
-- Description: AI Image-to-3D Studio Initial Database Schema
-- Entities: User, Session, Project, UploadedAsset, AIProvider, UserCredential,
--           ModelConfiguration, GenerationJob, GenerationAttempt, SceneSpecification,
--           GeneratedAsset, ModelVersion, ExportRecord, AuditEvent

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Custom Enums
DO $$ BEGIN
  CREATE TYPE credential_status AS ENUM ('untested', 'verified', 'invalid', 'temporarily_unavailable');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE model_stage AS ENUM ('VISION', 'PLANNER', 'SPECIALIST');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE generation_mode AS ENUM ('PROCEDURAL', 'SPECIALIST');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE generation_status AS ENUM (
    'CREATED',
    'QUEUED',
    'IMAGE_ANALYSIS',
    'SCENE_PLANNING',
    'BUILDING_GEOMETRY',
    'VALIDATING_ASSET',
    'SUCCEEDED',
    'FAILED',
    'CANCELED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE attempt_status AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE asset_format AS ENUM ('GLB', 'BLEND', 'PNG_THUMBNAIL', 'OBJ', 'STL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE validation_state AS ENUM ('PENDING', 'VALID', 'INVALID');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 1. Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  hashed_password TEXT NOT NULL,
  full_name VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 2. Sessions
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  ip_address VARCHAR(45),
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- 3. Projects
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_name ON projects(user_id, name);

-- 4. Uploaded Assets (Input Images)
CREATE TABLE IF NOT EXISTS uploaded_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(100) NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  storage_key TEXT NOT NULL,
  checksum_sha256 VARCHAR(64) NOT NULL,
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_uploaded_assets_user_id ON uploaded_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_assets_project_id ON uploaded_assets(project_id);

-- 5. AI Providers Catalog
CREATE TABLE IF NOT EXISTS ai_providers (
  id VARCHAR(100) PRIMARY KEY,
  display_name VARCHAR(150) NOT NULL,
  base_url VARCHAR(500),
  is_active BOOLEAN NOT NULL DEFAULT true,
  capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed default providers if not existing
INSERT INTO ai_providers (id, display_name, base_url, is_active, capabilities)
VALUES
  ('groq', 'Groq', 'https://api.groq.com/openai/v1', true, '{"vision": true, "text": true, "structured_output": true, "code_generation": true}'::jsonb),
  ('openai', 'OpenAI', 'https://api.openai.com/v1', true, '{"vision": true, "text": true, "structured_output": true, "code_generation": true}'::jsonb),
  ('inception', 'Inception Mercury', 'https://api.inception.ai/v1', true, '{"vision": false, "text": true, "structured_output": true, "code_generation": true}'::jsonb),
  ('google', 'Google Gemini', 'https://generativelanguage.googleapis.com', true, '{"vision": true, "text": true, "structured_output": true, "code_generation": true}'::jsonb),
  ('anthropic', 'Anthropic Claude', 'https://api.anthropic.com/v1', true, '{"vision": true, "text": true, "structured_output": true, "code_generation": true}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 6. User Credentials (Encrypted BYOK Keys - Plaintext never stored)
CREATE TABLE IF NOT EXISTS user_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id VARCHAR(100) NOT NULL REFERENCES ai_providers(id) ON DELETE RESTRICT,
  nickname VARCHAR(100) NOT NULL,
  key_mask VARCHAR(30) NOT NULL,
  encrypted_secret TEXT NOT NULL,
  secret_nonce TEXT NOT NULL,
  key_version INTEGER NOT NULL DEFAULT 1,
  status credential_status NOT NULL DEFAULT 'untested',
  last_validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_credentials_user_id ON user_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_user_credentials_provider_id ON user_credentials(provider_id);
CREATE INDEX IF NOT EXISTS idx_user_credentials_user_provider ON user_credentials(user_id, provider_id);

-- 7. Model Configurations (User selection per stage)
CREATE TABLE IF NOT EXISTS model_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stage model_stage NOT NULL,
  provider_id VARCHAR(100) NOT NULL REFERENCES ai_providers(id) ON DELETE RESTRICT,
  model_id VARCHAR(150) NOT NULL,
  credential_id UUID REFERENCES user_credentials(id) ON DELETE SET NULL,
  parameters JSONB DEFAULT '{}'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uniq_model_configurations_user_stage_model UNIQUE (user_id, stage, model_id)
);

CREATE INDEX IF NOT EXISTS idx_model_configurations_user_id ON model_configurations(user_id);
CREATE INDEX IF NOT EXISTS idx_model_configurations_user_stage ON model_configurations(user_id, stage);

-- 8. Generation Jobs
CREATE TABLE IF NOT EXISTS generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_asset_id UUID NOT NULL REFERENCES uploaded_assets(id) ON DELETE RESTRICT,
  mode generation_mode NOT NULL DEFAULT 'PROCEDURAL',
  status generation_status NOT NULL DEFAULT 'CREATED',
  idempotency_key VARCHAR(255) NOT NULL,
  instructions TEXT,
  error_code VARCHAR(100),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ,
  CONSTRAINT uniq_generation_jobs_user_idempotency UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_generation_jobs_user_id ON generation_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_project_id ON generation_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_status ON generation_jobs(status);

-- 9. Generation Attempts
CREATE TABLE IF NOT EXISTS generation_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES generation_jobs(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  stage VARCHAR(50) NOT NULL,
  status attempt_status NOT NULL DEFAULT 'PENDING',
  started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMPTZ,
  sanitized_summary TEXT,
  error_details JSONB,
  CONSTRAINT uniq_generation_attempts_job_attempt UNIQUE (job_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS idx_generation_attempts_job_id ON generation_attempts(job_id);

-- 10. Scene Specifications
CREATE TABLE IF NOT EXISTS scene_specifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES generation_jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  schema_version VARCHAR(20) NOT NULL DEFAULT '1.0',
  object_name VARCHAR(150) NOT NULL,
  spec_json JSONB NOT NULL,
  planner_model_id VARCHAR(150) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_scene_specifications_job_id ON scene_specifications(job_id);
CREATE INDEX IF NOT EXISTS idx_scene_specifications_user_id ON scene_specifications(user_id);

-- 11. Generated Assets (GLB, BLEND, PNG, etc.)
CREATE TABLE IF NOT EXISTS generated_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES generation_jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_format asset_format NOT NULL,
  storage_key TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  checksum_sha256 TEXT NOT NULL,
  triangle_count INTEGER,
  vertex_count INTEGER,
  validation_state validation_state NOT NULL DEFAULT 'PENDING',
  validation_report JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_generated_assets_job_id ON generated_assets(job_id);
CREATE INDEX IF NOT EXISTS idx_generated_assets_user_id ON generated_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_assets_project_id ON generated_assets(project_id);
CREATE INDEX IF NOT EXISTS idx_generated_assets_file_format ON generated_assets(file_format);

-- 12. Model Versions
CREATE TABLE IF NOT EXISTS model_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  generation_job_id UUID REFERENCES generation_jobs(id) ON DELETE SET NULL,
  scene_specification_id UUID REFERENCES scene_specifications(id) ON DELETE SET NULL,
  primary_asset_id UUID REFERENCES generated_assets(id) ON DELETE SET NULL,
  thumbnail_asset_id UUID REFERENCES generated_assets(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uniq_model_versions_project_version UNIQUE (project_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_model_versions_project_id ON model_versions(project_id);
CREATE INDEX IF NOT EXISTS idx_model_versions_user_id ON model_versions(user_id);

-- 13. Export Records
CREATE TABLE IF NOT EXISTS export_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES generated_assets(id) ON DELETE CASCADE,
  export_format VARCHAR(50) NOT NULL,
  ip_address VARCHAR(45),
  download_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_export_records_user_id ON export_records(user_id);
CREATE INDEX IF NOT EXISTS idx_export_records_asset_id ON export_records(asset_id);

-- 14. Audit Events
CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id VARCHAR(100),
  ip_address VARCHAR(45),
  user_agent TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_events_user_id ON audit_events(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_action ON audit_events(action);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events(created_at);
