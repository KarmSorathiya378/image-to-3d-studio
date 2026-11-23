from uuid import UUID
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models import User, Project
from ..schemas.projects import ProjectCreate, ProjectUpdate, ProjectResponse
from ..security.auth import get_current_user
from ..security.ownership import verify_project_ownership
from ..services.audit import record_audit_event

router = APIRouter(prefix="/projects", tags=["Projects"])

@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    req: ProjectCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = Project(
        user_id=current_user.id,
        name=req.name,
        description=req.description,
        status="active",
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)

    await record_audit_event(
        db,
        action="PROJECT_CREATE",
        resource_type="Project",
        resource_id=str(project.id),
        user_id=current_user.id,
        request=request,
    )
    return ProjectResponse.model_validate(project)


@router.get("", response_model=list[ProjectResponse])
async def list_projects(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Strictly scoped to current user
    query = select(Project).where(Project.user_id == current_user.id).order_by(Project.created_at.desc())
    res = await db.execute(query)
    projects = res.scalars().all()
    return [ProjectResponse.model_validate(p) for p in projects]


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await verify_project_ownership(project_id, current_user, db)
    return ProjectResponse.model_validate(project)


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID,
    req: ProjectUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await verify_project_ownership(project_id, current_user, db)
    if req.name is not None:
        project.name = req.name
    if req.description is not None:
        project.description = req.description
    if req.status is not None:
        project.status = req.status

    await db.commit()
    await db.refresh(project)

    await record_audit_event(
        db,
        action="PROJECT_UPDATE",
        resource_type="Project",
        resource_id=str(project.id),
        user_id=current_user.id,
        request=request,
    )
    return ProjectResponse.model_validate(project)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await verify_project_ownership(project_id, current_user, db)
    await db.delete(project)
    await db.commit()

    await record_audit_event(
        db,
        action="PROJECT_DELETE",
        resource_type="Project",
        resource_id=str(project_id),
        user_id=current_user.id,
        request=request,
    )
    return None
