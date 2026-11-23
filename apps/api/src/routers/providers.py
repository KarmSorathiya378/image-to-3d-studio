from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models import User, AIProvider, UserCredential, ModelConfiguration
from ..schemas.providers import (
    AIProviderResponse,
    UserCredentialCreate,
    UserCredentialResponse,
    ModelConfigurationCreate,
    ModelConfigurationResponse,
)
from ..security.auth import get_current_user
from ..security.encryption import encrypt_credential_secret, mask_credential
from ..security.ownership import verify_credential_ownership
from ..services.audit import record_audit_event

router = APIRouter(prefix="/providers", tags=["Providers & BYOK"])

@router.get("/catalog", response_model=list[AIProviderResponse])
async def get_provider_catalog(
    db: AsyncSession = Depends(get_db),
):
    query = select(AIProvider).where(AIProvider.is_active == True)
    res = await db.execute(query)
    providers = res.scalars().all()
    return [AIProviderResponse.model_validate(p) for p in providers]


@router.post("/credentials", response_model=UserCredentialResponse, status_code=status.HTTP_201_CREATED)
async def create_user_credential(
    req: UserCredentialCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify provider exists
    prov_res = await db.execute(select(AIProvider).where(AIProvider.id == req.provider_id))
    provider = prov_res.scalar_one_or_none()
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "PROVIDER_NOT_FOUND", "message": f"Provider '{req.provider_id}' not found"},
        )

    # Securely encrypt secret with AES-256-GCM; compute mask
    encrypted_secret, secret_nonce = encrypt_credential_secret(req.secret)
    key_mask = mask_credential(req.secret)

    credential = UserCredential(
        user_id=current_user.id,
        provider_id=req.provider_id,
        nickname=req.nickname,
        key_mask=key_mask,
        encrypted_secret=encrypted_secret,
        secret_nonce=secret_nonce,
        key_version=1,
        status="untested",
    )
    db.add(credential)
    await db.commit()
    await db.refresh(credential)

    await record_audit_event(
        db,
        action="CREDENTIAL_CREATE",
        resource_type="UserCredential",
        resource_id=str(credential.id),
        user_id=current_user.id,
        request=request,
    )
    return UserCredentialResponse.model_validate(credential)


@router.get("/credentials", response_model=list[UserCredentialResponse])
async def list_user_credentials(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Strictly scoped to current user, secrets NEVER returned
    query = (
        select(UserCredential)
        .where(UserCredential.user_id == current_user.id, UserCredential.revoked_at.is_(None))
        .order_by(UserCredential.created_at.desc())
    )
    res = await db.execute(query)
    credentials = res.scalars().all()
    return [UserCredentialResponse.model_validate(c) for c in credentials]


@router.delete("/credentials/{credential_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_credential(
    credential_id: UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    credential = await verify_credential_ownership(credential_id, current_user, db)
    await db.delete(credential)
    await db.commit()

    await record_audit_event(
        db,
        action="CREDENTIAL_DELETE",
        resource_type="UserCredential",
        resource_id=str(credential_id),
        user_id=current_user.id,
        request=request,
    )
    return None


@router.get("/preferences", response_model=list[ModelConfigurationResponse])
async def list_model_preferences(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(ModelConfiguration).where(ModelConfiguration.user_id == current_user.id)
    res = await db.execute(query)
    configs = res.scalars().all()
    return [ModelConfigurationResponse.model_validate(c) for c in configs]


@router.post("/preferences", response_model=ModelConfigurationResponse, status_code=status.HTTP_201_CREATED)
async def set_model_preference(
    req: ModelConfigurationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Check if config for (user_id, stage, model_id) already exists
    query = select(ModelConfiguration).where(
        ModelConfiguration.user_id == current_user.id,
        ModelConfiguration.stage == req.stage,
        ModelConfiguration.model_id == req.model_id,
    )
    res = await db.execute(query)
    config = res.scalar_one_or_none()

    if config:
        config.provider_id = req.provider_id
        config.credential_id = req.credential_id
        config.parameters = req.parameters
        config.is_default = req.is_default
    else:
        config = ModelConfiguration(
            user_id=current_user.id,
            stage=req.stage,
            provider_id=req.provider_id,
            model_id=req.model_id,
            credential_id=req.credential_id,
            parameters=req.parameters,
            is_default=req.is_default,
        )
        db.add(config)

    await db.commit()
    await db.refresh(config)
    return ModelConfigurationResponse.model_validate(config)
