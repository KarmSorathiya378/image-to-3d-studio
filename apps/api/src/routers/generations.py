from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from ..database import get_db
from ..models import (
    User,
    GenerationJob,
    GenerationAttempt,
    SceneSpecification,
    GeneratedAsset,
)
from ..schemas.generations import (
    GenerationJobCreate,
    GenerationJobResponse,
    SceneSpecificationCreate,
    SceneSpecificationResponse,
)
from ..schemas.assets import GeneratedAssetResponse
from ..security.auth import get_current_user
from ..security.ownership import (
    verify_project_ownership,
    verify_uploaded_asset_ownership,
    verify_job_ownership,
)
from ..services.audit import record_audit_event

router = APIRouter(tags=["Generations"])

@router.post("/projects/{project_id}/generations", response_model=GenerationJobResponse, status_code=status.HTTP_201_CREATED)
async def create_generation_job(
    project_id: UUID,
    req: GenerationJobCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # 1. Verify project ownership
    await verify_project_ownership(project_id, current_user, db)

    # 2. Verify source asset ownership
    await verify_uploaded_asset_ownership(req.source_asset_id, current_user, db)

    # 3. Check idempotency key for this user
    existing_query = select(GenerationJob).where(
        GenerationJob.user_id == current_user.id,
        GenerationJob.idempotency_key == req.idempotency_key,
    ).options(
        selectinload(GenerationJob.attempts),
        selectinload(GenerationJob.scene_specifications),
    )
    res = await db.execute(existing_query)
    existing_job = res.scalar_one_or_none()
    if existing_job:
        # Idempotent response: return existing job
        return GenerationJobResponse.model_validate(existing_job)

    # 4. Create new GenerationJob
    job = GenerationJob(
        project_id=project_id,
        user_id=current_user.id,
        source_asset_id=req.source_asset_id,
        mode=req.mode,
        status="CREATED",
        idempotency_key=req.idempotency_key,
        instructions=req.instructions,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    # 5. Create initial GenerationAttempt
    attempt = GenerationAttempt(
        job_id=job.id,
        attempt_number=1,
        stage="CREATED",
        status="PENDING",
        sanitized_summary="Job created and queued for processing.",
    )
    db.add(attempt)
    await db.commit()

    # Reload with relations
    reloaded_query = select(GenerationJob).where(GenerationJob.id == job.id).options(
        selectinload(GenerationJob.attempts),
        selectinload(GenerationJob.scene_specifications),
    )
    reloaded = (await db.execute(reloaded_query)).scalar_one()

    await record_audit_event(
        db,
        action="GENERATION_CREATE",
        resource_type="GenerationJob",
        resource_id=str(job.id),
        user_id=current_user.id,
        request=request,
        details={"mode": req.mode, "idempotency_key": req.idempotency_key},
    )

    return GenerationJobResponse.model_validate(reloaded)


@router.get("/generations/{generation_id}", response_model=GenerationJobResponse)
async def get_generation_status(
    generation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_job_ownership(generation_id, current_user, db)
    query = select(GenerationJob).where(GenerationJob.id == generation_id).options(
        selectinload(GenerationJob.attempts),
        selectinload(GenerationJob.scene_specifications),
    )
    res = await db.execute(query)
    job = res.scalar_one()
    return GenerationJobResponse.model_validate(job)


@router.post("/generations/{generation_id}/retry", response_model=GenerationJobResponse)
async def retry_generation(
    generation_id: UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    job = await verify_job_ownership(generation_id, current_user, db)

    # Count existing attempts
    attempts_query = select(GenerationAttempt).where(GenerationAttempt.job_id == job.id)
    attempts_res = await db.execute(attempts_query)
    existing_attempts = attempts_res.scalars().all()
    next_attempt_number = len(existing_attempts) + 1

    # Reset job status
    job.status = "QUEUED"
    job.error_code = None
    job.error_message = None

    new_attempt = GenerationAttempt(
        job_id=job.id,
        attempt_number=next_attempt_number,
        stage="QUEUED",
        status="PENDING",
        sanitized_summary="Retry scheduled by user.",
    )
    db.add(new_attempt)
    await db.commit()

    reloaded_query = select(GenerationJob).where(GenerationJob.id == job.id).options(
        selectinload(GenerationJob.attempts),
        selectinload(GenerationJob.scene_specifications),
    )
    reloaded = (await db.execute(reloaded_query)).scalar_one()

    await record_audit_event(
        db,
        action="GENERATION_RETRY",
        resource_type="GenerationJob",
        resource_id=str(job.id),
        user_id=current_user.id,
        request=request,
        details={"attempt": next_attempt_number},
    )

    return GenerationJobResponse.model_validate(reloaded)


@router.get("/generations/{generation_id}/assets", response_model=list[GeneratedAssetResponse])
async def list_generation_assets(
    generation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_job_ownership(generation_id, current_user, db)
    query = select(GeneratedAsset).where(GeneratedAsset.job_id == generation_id)
    res = await db.execute(query)
    assets = res.scalars().all()
    return [GeneratedAssetResponse.model_validate(a) for a in assets]


@router.post("/generations/{generation_id}/scene", response_model=SceneSpecificationResponse, status_code=status.HTTP_201_CREATED)
async def save_generation_scene(
    generation_id: UUID,
    req: SceneSpecificationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    job = await verify_job_ownership(generation_id, current_user, db)

    scene = SceneSpecification(
        job_id=job.id,
        user_id=current_user.id,
        schema_version=req.schema_version,
        object_name=req.object_name,
        spec_json=req.spec_json,
        planner_model_id=req.planner_model_id,
    )
    db.add(scene)
    await db.commit()
    await db.refresh(scene)
    return SceneSpecificationResponse.model_validate(scene)
