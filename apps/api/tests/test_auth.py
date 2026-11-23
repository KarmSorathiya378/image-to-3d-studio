import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from apps.api.src.models import User

@pytest.mark.asyncio
async def test_register_hashes_password(client: AsyncClient, test_db: AsyncSession):
    payload = {
        "email": "alice@example.com",
        "password": "SuperSecretPassword123!",
        "full_name": "Alice Smith",
    }
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == "alice@example.com"
    assert data["user"]["full_name"] == "Alice Smith"

    # Verify password in database is hashed with bcrypt and not plaintext
    query = select(User).where(User.email == "alice@example.com")
    res = await test_db.execute(query)
    user = res.scalar_one()
    assert user.hashed_password != payload["password"]
    assert user.hashed_password.startswith("$2b$") or user.hashed_password.startswith("$2a$")

@pytest.mark.asyncio
async def test_register_duplicate_email_fails(client: AsyncClient):
    payload = {
        "email": "duplicate@example.com",
        "password": "Password123!",
        "full_name": "Dup User",
    }
    res1 = await client.post("/api/v1/auth/register", json=payload)
    assert res1.status_code == 201

    res2 = await client.post("/api/v1/auth/register", json=payload)
    assert res2.status_code == 409
    assert res2.json()["detail"]["code"] == "EMAIL_ALREADY_EXISTS"

@pytest.mark.asyncio
async def test_login_success_and_failure(client: AsyncClient):
    # Register
    reg_payload = {"email": "bob@example.com", "password": "CorrectPassword123!"}
    await client.post("/api/v1/auth/register", json=reg_payload)

    # Valid Login
    login_res = await client.post("/api/v1/auth/login", json=reg_payload)
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    assert len(token) > 20

    # Invalid Password Login
    bad_login = await client.post(
        "/api/v1/auth/login",
        json={"email": "bob@example.com", "password": "WrongPassword!"},
    )
    assert bad_login.status_code == 401
    assert bad_login.json()["detail"]["code"] == "INVALID_CREDENTIALS"

@pytest.mark.asyncio
async def test_auth_me_and_logout(client: AsyncClient):
    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": "charlie@example.com", "password": "Password123!"},
    )
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # /auth/me
    me_res = await client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["email"] == "charlie@example.com"

    # Logout
    logout_res = await client.post("/api/v1/auth/logout", headers=headers)
    assert logout_res.status_code == 204

    # Access /auth/me after logout should be 401
    me_after = await client.get("/api/v1/auth/me", headers=headers)
    assert me_after.status_code == 401
