from typing import Any
from uuid import UUID
from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession
from ..models import AuditEvent

async def record_audit_event(
    db: AsyncSession,
    action: str,
    resource_type: str,
    resource_id: str | None = None,
    user_id: UUID | None = None,
    request: Request | None = None,
    details: dict[str, Any] | None = None,
) -> AuditEvent:
    ip_address = None
    user_agent = None

    if request:
        ip_address = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")

    event = AuditEvent(
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        ip_address=ip_address,
        user_agent=user_agent,
        details=details or {},
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return event
