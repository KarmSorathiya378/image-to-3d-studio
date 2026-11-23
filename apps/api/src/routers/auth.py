from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models import User, Session
from ..schemas.auth import RegisterRequest, LoginRequest, AuthResponse, UserResponse
from ..security.password import hash_password, verify_password
from ..security.session import generate_session_token, hash_session_token, calculate_expiration
from ..security.auth import get_current_user
from ..services.audit import record_audit_event

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(
    req: RegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    # Check if email is already registered
    existing_res = await db.execute(select(User).where(User.email == req.email))
    if existing_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "EMAIL_ALREADY_EXISTS", "message": "An account with this email already exists"},
        )

    # Hash password with bcrypt
    hashed_pwd = hash_password(req.password)
    user = User(
        email=req.email,
        hashed_password=hashed_pwd,
        full_name=req.full_name,
        is_active=True,
        is_verified=False,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Generate session token and hash for storage
    raw_token = generate_session_token()
    token_hash = hash_session_token(raw_token)
    expires_at = calculate_expiration()

    session_record = Session(
        user_id=user.id,
        token_hash=token_hash,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        expires_at=expires_at,
    )
    db.add(session_record)
    await db.commit()

    # Record audit event
    await record_audit_event(
        db,
        action="AUTH_REGISTER",
        resource_type="User",
        resource_id=str(user.id),
        user_id=user.id,
        request=request,
    )

    return AuthResponse(
        access_token=raw_token,
        token_type="bearer",
        expires_at=expires_at,
        user=UserResponse.model_validate(user),
    )


@router.post("/login", response_model=AuthResponse)
async def login(
    req: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    query = select(User).where(User.email == req.email)
    res = await db.execute(query)
    user = res.scalar_one_or_none()

    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_CREDENTIALS", "message": "Invalid email or password"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "USER_INACTIVE", "message": "Account is inactive"},
        )

    # Create new session
    raw_token = generate_session_token()
    token_hash = hash_session_token(raw_token)
    expires_at = calculate_expiration()

    session_record = Session(
        user_id=user.id,
        token_hash=token_hash,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        expires_at=expires_at,
    )
    db.add(session_record)
    await db.commit()

    await record_audit_event(
        db,
        action="AUTH_LOGIN",
        resource_type="User",
        resource_id=str(user.id),
        user_id=user.id,
        request=request,
    )

    return AuthResponse(
        access_token=raw_token,
        token_type="bearer",
        expires_at=expires_at,
        user=UserResponse.model_validate(user),
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    auth_header = request.headers.get("authorization")
    if auth_header and auth_header.startswith("Bearer "):
        raw_token = auth_header.split(" ")[1]
        token_hash = hash_session_token(raw_token)
        query = select(Session).where(Session.token_hash == token_hash)
        res = await db.execute(query)
        session_record = res.scalar_one_or_none()
        if session_record:
            from datetime import datetime, timezone
            session_record.revoked_at = datetime.now(timezone.utc)
            await db.commit()

    await record_audit_event(
        db,
        action="AUTH_LOGOUT",
        resource_type="Session",
        user_id=current_user.id,
        request=request,
    )
    return None


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)
