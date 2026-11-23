from uuid import UUID
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models import User, UploadedAsset, GeneratedAsset, ExportRecord
from ..schemas.assets import UploadedAssetCreate, UploadedAssetResponse, GeneratedAssetResponse
from ..schemas.audit import ExportRecordCreate, ExportRecordResponse
from ..security.auth import get_current_user
from ..security.ownership import (
    verify_project_ownership,
    verify_uploaded_asset_ownership,
    verify_generated_asset_ownership,
)
from ..services.audit import record_audit_event

router = APIRouter(tags=["Assets"])

@router.post("/projects/{project_id}/images", response_model=UploadedAssetResponse, status_code=status.HTTP_201_CREATED)
async def upload_project_image(
    project_id: UUID,
    req: UploadedAssetCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify user owns the project
    await verify_project_ownership(project_id, current_user, db)

    asset = UploadedAsset(
        user_id=current_user.id,
        project_id=project_id,
        file_name=req.file_name,
        file_type=req.file_type,
        file_size_bytes=req.file_size_bytes,
        storage_key=req.storage_key,
        checksum_sha256=req.checksum_sha256,
        width=req.width,
        height=req.height,
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)

    await record_audit_event(
        db,
        action="ASSET_UPLOAD",
        resource_type="UploadedAsset",
        resource_id=str(asset.id),
        user_id=current_user.id,
        request=request,
    )
    return UploadedAssetResponse.model_validate(asset)


@router.get("/projects/{project_id}/images", response_model=list[UploadedAssetResponse])
async def list_project_images(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_project_ownership(project_id, current_user, db)
    query = (
        select(UploadedAsset)
        .where(UploadedAsset.project_id == project_id, UploadedAsset.user_id == current_user.id)
        .order_by(UploadedAsset.created_at.desc())
    )
    res = await db.execute(query)
    assets = res.scalars().all()
    return [UploadedAssetResponse.model_validate(a) for a in assets]


@router.get("/assets/{asset_id}", response_model=UploadedAssetResponse)
async def get_uploaded_asset(
    asset_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    asset = await verify_uploaded_asset_ownership(asset_id, current_user, db)
    return UploadedAssetResponse.model_validate(asset)


@router.post("/assets/{asset_id}/export", response_model=ExportRecordResponse, status_code=status.HTTP_201_CREATED)
async def export_generated_asset(
    asset_id: UUID,
    req: ExportRecordCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    generated_asset = await verify_generated_asset_ownership(asset_id, current_user, db)

    export_rec = ExportRecord(
        user_id=current_user.id,
        asset_id=generated_asset.id,
        export_format=req.export_format,
        ip_address=request.client.host if request.client else None,
        download_count=1,
    )
    db.add(export_rec)
    await db.commit()
    await db.refresh(export_rec)

    await record_audit_event(
        db,
        action="ASSET_EXPORT",
        resource_type="ExportRecord",
        resource_id=str(export_rec.id),
        user_id=current_user.id,
        request=request,
    )
    return ExportRecordResponse.model_validate(export_rec)
