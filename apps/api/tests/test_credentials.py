import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from apps.api.src.models import UserCredential

@pytest.mark.asyncio
async def test_create_and_list_credentials_without_plaintext_leakage(
    client: AsyncClient,
    test_db: AsyncSession,
):
    # Register user
    res = await client.post(
        "/api/v1/auth/register",
        json={"email": "byok_user@example.com", "password": "Password123!"},
    )
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Add BYOK credential
    secret_key = "gsk_1234567890abcdefsecretkey"
    cred_payload = {
        "provider_id": "groq",
        "nickname": "My Production Groq Key",
        "secret": secret_key,
    }
    create_res = await client.post(
        "/api/v1/providers/credentials",
        json=cred_payload,
        headers=headers,
    )
    assert create_res.status_code == 201
    cred_data = create_res.json()

    # Verify response NEVER leaks plaintext secret
    assert "secret" not in cred_data
    assert cred_data["key_mask"] == "gsk••••tkey"
    assert cred_data["nickname"] == "My Production Groq Key"
    assert cred_data["status"] == "untested"

    # Verify database row contains ciphertext and nonce, NOT plaintext
    db_res = await test_db.execute(select(UserCredential).where(UserCredential.id == cred_data["id"]))
    row = db_res.scalar_one()
    assert row.encrypted_secret != secret_key
    assert row.secret_nonce is not None
    assert len(row.encrypted_secret) > 20

    # List credentials
    list_res = await client.get("/api/v1/providers/credentials", headers=headers)
    assert list_res.status_code == 200
    creds = list_res.json()
    assert len(creds) == 1
    assert "secret" not in creds[0]
    assert creds[0]["key_mask"] == "gsk••••tkey"

    # Delete credential
    del_res = await client.delete(f"/api/v1/providers/credentials/{cred_data['id']}", headers=headers)
    assert del_res.status_code == 204

    # Ensure deleted
    list_after = await client.get("/api/v1/providers/credentials", headers=headers)
    assert len(list_after.json()) == 0
