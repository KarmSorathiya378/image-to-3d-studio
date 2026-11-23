from datetime import datetime, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models import User, Session
from .session import hash_session_token

security_bearer = HTTPBearer(auto_error=False)

async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "Missing authentication credentials"},
            headers={"WWW-Authenticate": "Bearer"},
        )

    raw_token = credentials.credentials
    token_hash = hash_session_token(raw_token)

    query = select(Session).where(
        Session.token_hash == token_hash,
        Session.revoked_at.is_(None),
    )
    result = await db.execute(query)
    session_record = result.scalar_one_or_none()

    if not session_record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "Invalid or revoked session token"},
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check expiration
    now = datetime.now(timezone.utc)
    # Ensure session_record.expires_at is timezone-aware
    expires_at = session_record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at <= now:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "SESSION_EXPIRED", "message": "Session has expired"},
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Fetch User
    user_id = session_record.user_id
    user_query = select(User).where(User.id == user_id)
    user_res = await db.execute(user_query)
    user = user_res.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "USER_INACTIVE", "message": "User account is inactive or deleted"},
        )

    return user

async def require_verified_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "USER_UNVERIFIED", "message": "Email verification required"},
        )
    return current_user
