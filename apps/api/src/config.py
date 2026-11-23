import os
from pydantic import BaseModel, Field

class Settings(BaseModel):
    app_name: str = "Image-to-3D Studio API"
    app_version: str = "1.0.0"
    environment: str = Field(default="development")
    api_prefix: str = "/api/v1"
    
    # Database
    database_url: str = Field(
        default_factory=lambda: os.getenv(
            "DATABASE_URL",
            "postgresql+asyncpg://postgres:postgres@localhost:5432/image_to_3d"
        )
    )
    
    # Security
    auth_secret: str = Field(
        default_factory=lambda: os.getenv("AUTH_SECRET", "dev-insecure-secret-key-change-in-prod-32bytes!")
    )
    session_expire_hours: int = 72
    cors_origins: list[str] = ["*"]
    
    # Master key for credential vault (Faye's scope encrypts; exposed interface)
    master_key: str = Field(
        default_factory=lambda: os.getenv("CREDENTIAL_ENCRYPTION_MASTER_KEY", "dev-master-encryption-key-for-credentials-32b")
    )

settings = Settings()
