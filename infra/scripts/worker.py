"""
Background Job Orchestrator Worker for AI Image-to-3D Studio.
Continuously polls Redis/PostgreSQL for generation jobs and manages execution.
"""

from __future__ import annotations

import asyncio
import os
import signal
import sys
import time
import httpx
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, text


DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/image_to_3d",
)
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
GEOMETRY_WORKER_URL = os.getenv("GEOMETRY_WORKER_URL", "http://localhost:8001")
POLL_INTERVAL_SECONDS = float(os.getenv("WORKER_POLL_INTERVAL_SECONDS", "3.0"))

running = True


def handle_shutdown(sig, frame):
    global running
    print(f"\n[Worker] Received signal {sig}, terminating gracefully...")
    running = False


async def check_dependencies():
    """Verify database and geometry worker connectivity on startup."""
    print(f"[Worker] Checking PostgreSQL at {DATABASE_URL.split('@')[-1] if '@' in DATABASE_URL else 'configured URL'}...")
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    try:
        async with async_session() as session:
            res = await session.execute(text("SELECT 1"))
            print("[Worker] PostgreSQL connection verified.")
    except Exception as e:
        print(f"[Worker] Warning: PostgreSQL not reachable yet: {e}")
    finally:
        await engine.dispose()

    # Check Geometry Worker
    print(f"[Worker] Checking Geometry Worker at {GEOMETRY_WORKER_URL}...")
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{GEOMETRY_WORKER_URL}/healthz")
            if resp.status_code == 200:
                print(f"[Worker] Geometry Worker is healthy: {resp.json()}")
            else:
                print(f"[Worker] Geometry Worker returned status {resp.status_code}")
    except Exception as e:
        print(f"[Worker] Geometry Worker not reachable yet (will retry during jobs): {e}")


async def poll_jobs_loop():
    """Main background loop polling for generation work."""
    global running
    print(f"[Worker] Starting background worker loop (interval: {POLL_INTERVAL_SECONDS}s)...")
    last_heartbeat = time.time()

    while running:
        current_time = time.time()
        if current_time - last_heartbeat >= 30:
            print(f"[Worker Heartbeat] Worker active at {time.strftime('%Y-%m-%d %H:%M:%S')}")
            last_heartbeat = current_time

        try:
            # Connect and query for queued jobs if DB is accessible
            engine = create_async_engine(DATABASE_URL, echo=False)
            async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
            async with async_session() as session:
                result = await session.execute(
                    text("SELECT id, status, mode FROM generation_jobs WHERE status = 'QUEUED' LIMIT 5")
                )
                jobs = result.fetchall()
                if jobs:
                    print(f"[Worker] Claimed {len(jobs)} queued job(s): {[str(j[0]) for j in jobs]}")
                    for job in jobs:
                        job_id, status, mode = job
                        print(f"[Worker] Processing job {job_id} (mode={mode})...")
                        # Mark IN_PROGRESS
                        await session.execute(
                            text("UPDATE generation_jobs SET status = 'IN_PROGRESS' WHERE id = :job_id"),
                            {"job_id": job_id},
                        )
                        await session.commit()
            await engine.dispose()
        except Exception as e:
            # DB might be initializing or table not yet created
            pass

        await asyncio.sleep(POLL_INTERVAL_SECONDS)


async def main():
    signal.signal(signal.SIGINT, handle_shutdown)
    signal.signal(signal.SIGTERM, handle_shutdown)

    print("[Worker] Initializing AI Image-to-3D Studio Worker service...")
    await check_dependencies()
    await poll_jobs_loop()
    print("[Worker] Shutdown complete.")


if __name__ == "__main__":
    asyncio.run(main())
