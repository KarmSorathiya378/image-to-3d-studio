from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..models import (
    User,
    Project,
    UploadedAsset,
    GeneratedAsset,
    GenerationJob,
    UserCredential,
    ModelConfiguration,
    ModelVersion,
)

async def verify_project_ownership(
    project_id: UUID,
    user: User,
    db: AsyncSession,
) -> Project:
    query = select(Project).where(Project.id == project_id, Project.user_id == user.id)
    result = await db.execute(query)
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "PROJECT_NOT_FOUND", "message": "Project not found or access denied"},
        )
    return project

async def verify_uploaded_asset_ownership(
    asset_id: UUID,
    user: User,
    db: AsyncSession,
) -> UploadedAsset:
    query = select(UploadedAsset).where(UploadedAsset.id == asset_id, UploadedAsset.user_id == user.id)
    result = await db.execute(query)
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ASSET_NOT_FOUND", "message": "Uploaded asset not found or access denied"},
        )
    return asset

async def verify_generated_asset_ownership(
    asset_id: UUID,
    user: User,
    db: AsyncSession,
) -> GeneratedAsset:
    query = select(GeneratedAsset).where(GeneratedAsset.id == asset_id, GeneratedAsset.user_id == user.id)
    result = await db.execute(query)
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ASSET_NOT_FOUND", "message": "Generated asset not found or access denied"},
        )
    return asset

async def verify_job_ownership(
    job_id: UUID,
    user: User,
    db: AsyncSession,
) -> GenerationJob:
    query = select(GenerationJob).where(GenerationJob.id == job_id, GenerationJob.user_id == user.id)
    result = await db.execute(query)
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "JOB_NOT_FOUND", "message": "Generation job not found or access denied"},
        )
    return job

async def verify_credential_ownership(
    credential_id: UUID,
    user: User,
    db: AsyncSession,
) -> UserCredential:
    query = select(UserCredential).where(UserCredential.id == credential_id, UserCredential.user_id == user.id)
    result = await db.execute(query)
    credential = result.scalar_one_or_none()
    if not credential:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "CREDENTIAL_NOT_FOUND", "message": "Credential not found or access denied"},
        )
    return credential

async def verify_model_config_ownership(
    config_id: UUID,
    user: User,
    db: AsyncSession,
) -> ModelConfiguration:
    query = select(ModelConfiguration).where(ModelConfiguration.id == config_id, ModelConfiguration.user_id == user.id)
    result = await db.execute(query)
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "MODEL_CONFIG_NOT_FOUND", "message": "Model configuration not found or access denied"},
        )
    return config
