from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from ..database import get_db

router = APIRouter(tags=["System Health"])

@router.get("/healthz", status_code=status.HTTP_200_OK)
async def healthz():
    return {"status": "ok", "service": "image-to-3d-api"}

@router.get("/readyz", status_code=status.HTTP_200_OK)
async def readyz(db: AsyncSession = Depends(get_db)):
    try:
        await db.execute(text("SELECT 1"))
        return {"status": "ready", "database": "connected"}
    except Exception as e:
        return {"status": "degraded", "database": "disconnected", "error": str(e)}
