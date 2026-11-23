import pytest
from httpx import AsyncClient

async def create_user_and_token(client: AsyncClient, email: str) -> dict[str, str]:
    res = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password123!"},
    )
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

@pytest.mark.asyncio
async def test_project_ownership_isolation(client: AsyncClient):
    headers_a = await create_user_and_token(client, "user_a@example.com")
    headers_b = await create_user_and_token(client, "user_b@example.com")

    # User A creates a project
    proj_a_res = await client.post(
        "/api/v1/projects",
        json={"name": "User A Private Chair", "description": "Wooden chair project"},
        headers=headers_a,
    )
    assert proj_a_res.status_code == 201
    project_a_id = proj_a_res.json()["id"]

    # User A can get their project
    get_res = await client.get(f"/api/v1/projects/{project_a_id}", headers=headers_a)
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "User A Private Chair"

    # User B CANNOT get User A's project -> 404
    cross_get = await client.get(f"/api/v1/projects/{project_a_id}", headers=headers_b)
    assert cross_get.status_code == 404
    assert cross_get.json()["detail"]["code"] == "PROJECT_NOT_FOUND"

    # User B CANNOT update User A's project -> 404
    cross_update = await client.patch(
        f"/api/v1/projects/{project_a_id}",
        json={"name": "Hacked name"},
        headers=headers_b,
    )
    assert cross_update.status_code == 404

    # User B CANNOT delete User A's project -> 404
    cross_delete = await client.delete(f"/api/v1/projects/{project_a_id}", headers=headers_b)
    assert cross_delete.status_code == 404

    # Project still exists and is untouched
    verified_res = await client.get(f"/api/v1/projects/{project_a_id}", headers=headers_a)
    assert verified_res.status_code == 200
    assert verified_res.json()["name"] == "User A Private Chair"

@pytest.mark.asyncio
async def test_asset_and_generation_ownership(client: AsyncClient):
    headers_a = await create_user_and_token(client, "alice_gen@example.com")
    headers_b = await create_user_and_token(client, "bob_gen@example.com")

    # User A creates project and uploads an asset
    proj_res = await client.post(
        "/api/v1/projects",
        json={"name": "Stool Project"},
        headers=headers_a,
    )
    proj_id = proj_res.json()["id"]

    asset_res = await client.post(
        f"/api/v1/projects/{proj_id}/images",
        json={
            "file_name": "stool.png",
            "file_type": "image/png",
            "file_size_bytes": 1024,
            "storage_key": "raw/stool.png",
            "checksum_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            "width": 800,
            "height": 600,
        },
        headers=headers_a,
    )
    assert asset_res.status_code == 201
    asset_id = asset_res.json()["id"]

    # User B cannot access User A's asset
    cross_asset = await client.get(f"/api/v1/assets/{asset_id}", headers=headers_b)
    assert cross_asset.status_code == 404

    # User A creates generation job
    gen_res = await client.post(
        f"/api/v1/projects/{proj_id}/generations",
        json={
            "source_asset_id": asset_id,
            "idempotency_key": "idem-key-12345",
            "mode": "PROCEDURAL",
            "instructions": "Simple wooden stool with 4 legs",
        },
        headers=headers_a,
    )
    assert gen_res.status_code == 201
    job_id = gen_res.json()["id"]

    # User B cannot read User A's generation job
    cross_job = await client.get(f"/api/v1/generations/{job_id}", headers=headers_b)
    assert cross_job.status_code == 404

    # User B cannot retry User A's generation job
    cross_retry = await client.post(f"/api/v1/generations/{job_id}/retry", headers=headers_b)
    assert cross_retry.status_code == 404
