import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_generation_idempotency_and_retry(client: AsyncClient):
    # Setup user, project, asset
    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": "gen_tester@example.com", "password": "Password123!"},
    )
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    proj = await client.post("/api/v1/projects", json={"name": "Gen Project"}, headers=headers)
    proj_id = proj.json()["id"]

    asset = await client.post(
        f"/api/v1/projects/{proj_id}/images",
        json={
            "file_name": "lamp.jpg",
            "file_type": "image/jpeg",
            "file_size_bytes": 2048,
            "storage_key": "raw/lamp.jpg",
            "checksum_sha256": "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
            "width": 640,
            "height": 480,
        },
        headers=headers,
    )
    asset_id = asset.json()["id"]

    idempotency_key = "unique-client-req-999"
    gen_body = {
        "source_asset_id": asset_id,
        "idempotency_key": idempotency_key,
        "mode": "PROCEDURAL",
        "instructions": "A small desk lamp with conical shade",
    }

    # First request
    res1 = await client.post(f"/api/v1/projects/{proj_id}/generations", json=gen_body, headers=headers)
    assert res1.status_code == 201
    job1 = res1.json()
    assert job1["status"] == "CREATED"
    assert len(job1["attempts"]) == 1
    assert job1["attempts"][0]["attempt_number"] == 1

    # Second identical request (idempotent replay)
    res2 = await client.post(f"/api/v1/projects/{proj_id}/generations", json=gen_body, headers=headers)
    assert res2.status_code == 201 or res2.status_code == 200
    job2 = res2.json()
    assert job2["id"] == job1["id"]
    assert job2["idempotency_key"] == idempotency_key

    # Retry generation
    retry_res = await client.post(f"/api/v1/generations/{job1['id']}/retry", headers=headers)
    assert retry_res.status_code == 200
    retried_job = retry_res.json()
    assert retried_job["status"] == "QUEUED"
    assert len(retried_job["attempts"]) == 2
    assert retried_job["attempts"][1]["attempt_number"] == 2
