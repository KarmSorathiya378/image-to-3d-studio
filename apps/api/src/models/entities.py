import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Text,
    Boolean,
    DateTime,
    ForeignKey,
    BigInteger,
    Integer,
    UniqueConstraint,
    Index,
)
from sqlalchemy.orm import relationship
from ..database import Base
from .types import GUID, JSONBCompat

def now_utc():
    return datetime.now(timezone.utc)

def gen_uuid():
    return uuid.uuid4()

class User(Base):
    __tablename__ = "users"

    id = Column(GUID, primary_key=True, default=gen_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(Text, nullable=False)
    full_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    # Relationships
    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")
    projects = relationship("Project", back_populates="user", cascade="all, delete-orphan")
    uploaded_assets = relationship("UploadedAsset", back_populates="user", cascade="all, delete-orphan")
    credentials = relationship("UserCredential", back_populates="user", cascade="all, delete-orphan")
    model_configurations = relationship("ModelConfiguration", back_populates="user", cascade="all, delete-orphan")
    generation_jobs = relationship("GenerationJob", back_populates="user", cascade="all, delete-orphan")
    scene_specifications = relationship("SceneSpecification", back_populates="user", cascade="all, delete-orphan")
    generated_assets = relationship("GeneratedAsset", back_populates="user", cascade="all, delete-orphan")
    model_versions = relationship("ModelVersion", back_populates="user", cascade="all, delete-orphan")
    export_records = relationship("ExportRecord", back_populates="user", cascade="all, delete-orphan")
    audit_events = relationship("AuditEvent", back_populates="user")


class Session(Base):
    __tablename__ = "sessions"

    id = Column(GUID, primary_key=True, default=gen_uuid)
    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String(255), unique=True, nullable=False, index=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="sessions")


class Project(Base):
    __tablename__ = "projects"

    id = Column(GUID, primary_key=True, default=gen_uuid)
    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(50), default="active", nullable=False)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    __table_args__ = (
        Index("idx_projects_user_name", "user_id", "name"),
    )

    user = relationship("User", back_populates="projects")
    uploaded_assets = relationship("UploadedAsset", back_populates="project", cascade="all, delete-orphan")
    generation_jobs = relationship("GenerationJob", back_populates="project", cascade="all, delete-orphan")
    generated_assets = relationship("GeneratedAsset", back_populates="project", cascade="all, delete-orphan")
    model_versions = relationship("ModelVersion", back_populates="project", cascade="all, delete-orphan")


class UploadedAsset(Base):
    __tablename__ = "uploaded_assets"

    id = Column(GUID, primary_key=True, default=gen_uuid)
    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id = Column(GUID, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    file_name = Column(String(255), nullable=False)
    file_type = Column(String(100), nullable=False)
    file_size_bytes = Column(BigInteger, nullable=False)
    storage_key = Column(Text, nullable=False)
    checksum_sha256 = Column(String(64), nullable=False)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)

    user = relationship("User", back_populates="uploaded_assets")
    project = relationship("Project", back_populates="uploaded_assets")
    generation_jobs = relationship("GenerationJob", back_populates="source_asset")


class AIProvider(Base):
    __tablename__ = "ai_providers"

    id = Column(String(100), primary_key=True)
    display_name = Column(String(150), nullable=False)
    base_url = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    capabilities = Column(JSONBCompat, default=dict, nullable=False)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    credentials = relationship("UserCredential", back_populates="provider")
    model_configurations = relationship("ModelConfiguration", back_populates="provider")


class UserCredential(Base):
    __tablename__ = "user_credentials"

    id = Column(GUID, primary_key=True, default=gen_uuid)
    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    provider_id = Column(String(100), ForeignKey("ai_providers.id", ondelete="RESTRICT"), nullable=False, index=True)
    nickname = Column(String(100), nullable=False)
    key_mask = Column(String(30), nullable=False)
    encrypted_secret = Column(Text, nullable=False)
    secret_nonce = Column(Text, nullable=False)
    key_version = Column(Integer, default=1, nullable=False)
    status = Column(String(50), default="untested", nullable=False)
    last_validated_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("idx_user_credentials_user_provider", "user_id", "provider_id"),
    )

    user = relationship("User", back_populates="credentials")
    provider = relationship("AIProvider", back_populates="credentials")
    model_configurations = relationship("ModelConfiguration", back_populates="credential")


class ModelConfiguration(Base):
    __tablename__ = "model_configurations"

    id = Column(GUID, primary_key=True, default=gen_uuid)
    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    stage = Column(String(50), nullable=False)  # VISION, PLANNER, SPECIALIST
    provider_id = Column(String(100), ForeignKey("ai_providers.id", ondelete="RESTRICT"), nullable=False)
    model_id = Column(String(150), nullable=False)
    credential_id = Column(GUID, ForeignKey("user_credentials.id", ondelete="SET NULL"), nullable=True)
    parameters = Column(JSONBCompat, default=dict, nullable=True)
    is_default = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "stage", "model_id", name="uniq_model_configurations_user_stage_model"),
        Index("idx_model_configurations_user_stage", "user_id", "stage"),
    )

    user = relationship("User", back_populates="model_configurations")
    provider = relationship("AIProvider", back_populates="model_configurations")
    credential = relationship("UserCredential", back_populates="model_configurations")


class GenerationJob(Base):
    __tablename__ = "generation_jobs"

    id = Column(GUID, primary_key=True, default=gen_uuid)
    project_id = Column(GUID, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    source_asset_id = Column(GUID, ForeignKey("uploaded_assets.id", ondelete="RESTRICT"), nullable=False)
    mode = Column(String(50), default="PROCEDURAL", nullable=False)
    status = Column(String(50), default="CREATED", nullable=False, index=True)
    idempotency_key = Column(String(255), nullable=False)
    instructions = Column(Text, nullable=True)
    error_code = Column(String(100), nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("user_id", "idempotency_key", name="uniq_generation_jobs_user_idempotency"),
    )

    user = relationship("User", back_populates="generation_jobs")
    project = relationship("Project", back_populates="generation_jobs")
    source_asset = relationship("UploadedAsset", back_populates="generation_jobs")
    attempts = relationship("GenerationAttempt", back_populates="job", cascade="all, delete-orphan")
    scene_specifications = relationship("SceneSpecification", back_populates="job", cascade="all, delete-orphan")
    generated_assets = relationship("GeneratedAsset", back_populates="job", cascade="all, delete-orphan")
    model_versions = relationship("ModelVersion", back_populates="generation_job")


class GenerationAttempt(Base):
    __tablename__ = "generation_attempts"

    id = Column(GUID, primary_key=True, default=gen_uuid)
    job_id = Column(GUID, ForeignKey("generation_jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    attempt_number = Column(Integer, nullable=False)
    stage = Column(String(50), nullable=False)
    status = Column(String(50), default="PENDING", nullable=False)
    started_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    sanitized_summary = Column(Text, nullable=True)
    error_details = Column(JSONBCompat, nullable=True)

    __table_args__ = (
        UniqueConstraint("job_id", "attempt_number", name="uniq_generation_attempts_job_attempt"),
    )

    job = relationship("GenerationJob", back_populates="attempts")


class SceneSpecification(Base):
    __tablename__ = "scene_specifications"

    id = Column(GUID, primary_key=True, default=gen_uuid)
    job_id = Column(GUID, ForeignKey("generation_jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    schema_version = Column(String(20), default="1.0", nullable=False)
    object_name = Column(String(150), nullable=False)
    spec_json = Column(JSONBCompat, nullable=False)
    planner_model_id = Column(String(150), nullable=False)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)

    job = relationship("GenerationJob", back_populates="scene_specifications")
    user = relationship("User", back_populates="scene_specifications")
    model_versions = relationship("ModelVersion", back_populates="scene_specification")


class GeneratedAsset(Base):
    __tablename__ = "generated_assets"

    id = Column(GUID, primary_key=True, default=gen_uuid)
    job_id = Column(GUID, ForeignKey("generation_jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id = Column(GUID, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    file_format = Column(String(50), nullable=False, index=True)  # GLB, BLEND, PNG_THUMBNAIL, OBJ, STL
    storage_key = Column(Text, nullable=False)
    file_size_bytes = Column(BigInteger, nullable=False)
    checksum_sha256 = Column(String(64), nullable=False)
    triangle_count = Column(Integer, nullable=True)
    vertex_count = Column(Integer, nullable=True)
    validation_state = Column(String(50), default="PENDING", nullable=False)
    validation_report = Column(JSONBCompat, nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)

    job = relationship("GenerationJob", back_populates="generated_assets")
    user = relationship("User", back_populates="generated_assets")
    project = relationship("Project", back_populates="generated_assets")
    export_records = relationship("ExportRecord", back_populates="asset", cascade="all, delete-orphan")


class ModelVersion(Base):
    __tablename__ = "model_versions"

    id = Column(GUID, primary_key=True, default=gen_uuid)
    project_id = Column(GUID, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    version_number = Column(Integer, nullable=False)
    generation_job_id = Column(GUID, ForeignKey("generation_jobs.id", ondelete="SET NULL"), nullable=True)
    scene_specification_id = Column(GUID, ForeignKey("scene_specifications.id", ondelete="SET NULL"), nullable=True)
    primary_asset_id = Column(GUID, ForeignKey("generated_assets.id", ondelete="SET NULL"), nullable=True)
    thumbnail_asset_id = Column(GUID, ForeignKey("generated_assets.id", ondelete="SET NULL"), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)

    __table_args__ = (
        UniqueConstraint("project_id", "version_number", name="uniq_model_versions_project_version"),
    )

    project = relationship("Project", back_populates="model_versions")
    user = relationship("User", back_populates="model_versions")
    generation_job = relationship("GenerationJob", back_populates="model_versions")
    scene_specification = relationship("SceneSpecification", back_populates="model_versions")
    primary_asset = relationship("GeneratedAsset", foreign_keys=[primary_asset_id])
    thumbnail_asset = relationship("GeneratedAsset", foreign_keys=[thumbnail_asset_id])


class ExportRecord(Base):
    __tablename__ = "export_records"

    id = Column(GUID, primary_key=True, default=gen_uuid)
    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    asset_id = Column(GUID, ForeignKey("generated_assets.id", ondelete="CASCADE"), nullable=False, index=True)
    export_format = Column(String(50), nullable=False)
    ip_address = Column(String(45), nullable=True)
    download_count = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)

    user = relationship("User", back_populates="export_records")
    asset = relationship("GeneratedAsset", back_populates="export_records")


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(GUID, primary_key=True, default=gen_uuid)
    user_id = Column(GUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String(100), nullable=False, index=True)
    resource_type = Column(String(100), nullable=False)
    resource_id = Column(String(100), nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    details = Column(JSONBCompat, nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False, index=True)

    user = relationship("User", back_populates="audit_events")
