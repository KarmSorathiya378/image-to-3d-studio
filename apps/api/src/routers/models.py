from uuid import UUID
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models import User, ModelVersion
from ..schemas.models import ModelVersionCreate, ModelVersionResponse
from ..security.auth import get_current_user
from ..security.ownership import verify_project_ownership
from ..services.audit import record_audit_event

router = APIRouter(tags=["Model Versions"])

@router.get("/projects/{project_id}/versions", response_model=list[ModelVersionResponse])
async def list_model_versions(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_project_ownership(project_id, current_user, db)
    query = (
        select(ModelVersion)
        .where(ModelVersion.project_id == project_id, ModelVersion.user_id == current_user.id)
        .order_by(ModelVersion.version_number.desc())
    )
    res = await db.execute(query)
    versions = res.scalars().all()
    return [ModelVersionResponse.model_validate(v) for v in versions]


@router.post("/projects/{project_id}/versions", response_model=ModelVersionResponse, status_code=status.HTTP_201_CREATED)
async def create_model_version(
    project_id: UUID,
    req: ModelVersionCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_project_ownership(project_id, current_user, db)

    version = ModelVersion(
        project_id=project_id,
        user_id=current_user.id,
        version_number=req.version_number,
        generation_job_id=req.generation_job_id,
        scene_specification_id=req.scene_specification_id,
        primary_asset_id=req.primary_asset_id,
        thumbnail_asset_id=req.thumbnail_asset_id,
        notes=req.notes,
    )
    db.add(version)
    await db.commit()
    await db.refresh(version)

    await record_audit_event(
        db,
        action="MODEL_VERSION_CREATE",
        resource_type="ModelVersion",
        resource_id=str(version.id),
        user_id=current_user.id,
        request=request,
        details={"version_number": req.version_number},
    )

    return ModelVersionResponse.model_validate(version)
