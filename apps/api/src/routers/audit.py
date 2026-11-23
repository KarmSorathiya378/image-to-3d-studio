from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models import User, AuditEvent
from ..schemas.audit import AuditEventResponse
from ..security.auth import get_current_user

router = APIRouter(prefix="/audit", tags=["Audit"])

@router.get("/events", response_model=list[AuditEventResponse])
async def list_audit_events(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(AuditEvent)
        .where(AuditEvent.user_id == current_user.id)
        .order_by(AuditEvent.created_at.desc())
        .limit(100)
    )
    res = await db.execute(query)
    events = res.scalars().all()
    return [AuditEventResponse.model_validate(e) for e in events]
