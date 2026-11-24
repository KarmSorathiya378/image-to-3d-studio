# Infrastructure & Deployment Scaffold (Phase 13)

This directory contains the production-ready Docker Compose deployment scaffold for the **AI Image-to-3D Studio**.

---

## 1. Architecture & Service Topology

The environment is composed of 7 core services running in an isolated Docker bridge network (`image3d_network`):

```
                                 [ Browser Client ]
                                    |          |
                           :3000    |          |   :8000
                                    v          v
                             +-------------+  +-------------+
                             |   web       |  |     api     |
                             |  (Next.js)  |  |  (FastAPI)  |
                             +-------------+  +------+------+
                                                     |
                    +--------------------------------+--------------------+
                    |                                |                    |
                    v                                v                    v
             +--------------+                 +--------------+     +--------------+
             |   postgres   |                 |    redis     |     |    minio     |
             | (PostgreSQL) |                 | (BullMQ/Q)   |     | (S3 Storage) |
             +-------+------+                 +------+-------+     +------+-------+
                     ^                               ^                    ^
                     |                               |                    |
                     +---------------+---------------+                    |
                                     |                                    |
                              +------+-------+                            |
                              |    worker    |                            |
                              | (Background) |                            |
                              +------+-------+                            |
                                     |                                    |
                                     v :8001                              |
                              +--------------+                            |
                              |blender-worker|----------------------------+
                              | (Blender LTS)|
                              +--------------+
```

### Services Summary

| Service | Container Name | Host Port | Internal Port | Description |
| :--- | :--- | :--- | :--- | :--- |
| **`web`** | `image3d-web` | `3000` | `3000` | Next.js 16 (React 19, Three.js) UI |
| **`api`** | `image3d-api` | `8000` | `8000` | FastAPI backend (auth, projects, generations, assets) |
| **`worker`** | `image3d-worker` | - | - | Background job orchestrator (polls queue/db, manages pipeline) |
| **`blender-worker`** | `image3d-blender-worker` | `8001` | `8000` | Deterministic Blender LTS compiler & GLB exporter |
| **`postgres`** | `image3d-postgres` | `5432` | `5432` | PostgreSQL 16 database |
| **`redis`** | `image3d-redis` | `6379` | `6379` | Redis 7 cache and job broker |
| **`minio`** | `image3d-minio` | `9000`, `9001` | `9000`, `9001` | S3-compatible private object storage & Web Console |
| **`minio-init`** | `image3d-minio-init` | - | - | One-shot bucket provisioner (`private-model-assets`) |

---

## 2. Quickstart & Local Setup

### Prerequisites
- Docker Engine 24.0+
- Docker Compose v2.20+ (or Docker Desktop)
- Minimum 4 GB RAM recommended for Blender mesh compilation

### Step 1: Initialize Environment File
From the repository root, copy the environment template:
```bash
cp infra/.env.example infra/.env
```
*(On Windows PowerShell: `Copy-Item infra/.env.example infra/.env`)*

### Step 2: Build and Launch Containers
You can build and start all services using the provided environment template:
```bash
docker compose -f infra/docker-compose.yml --env-file infra/.env.example up --build -d
```
Or if running directly from within the `infra/` folder:
```bash
cd infra
docker compose --env-file .env.example up --build -d
```

### Step 3: Verify Container Status
Check that all services are healthy and running:
```bash
docker compose -f infra/docker-compose.yml ps
```

---

## 3. Database Migration Step

Once the `postgres` container is healthy, apply the database schema migration:

### Option A: Via the API container (Recommended)
```bash
docker compose -f infra/docker-compose.yml exec api python /app/packages/db/apply_migrations.py
```

### Option B: Directly via PostgreSQL psql client
```bash
docker compose -f infra/docker-compose.yml exec -i postgres psql -U postgres -d image_to_3d < packages/db/migrations/0000_initial_schema.sql
```

Both options apply the canonical DDL from `packages/db/migrations/0000_initial_schema.sql`, creating the 14 core entities:
`users`, `sessions`, `projects`, `uploaded_assets`, `ai_providers`, `user_credentials`, `model_configurations`, `generation_jobs`, `generation_attempts`, `scene_specifications`, `generated_assets`, `model_versions`, `export_records`, and `audit_events`.

---

## 4. Health-Check Endpoints

All services provide real, active health-check endpoints for automated monitoring and container orchestration:

| Component | Target URL | Expected Status | Response Preview |
| :--- | :--- | :--- | :--- |
| **Web Frontend** | `http://localhost:3000/` | `200 OK` | HTML document / Next.js app |
| **API Liveness** | `http://localhost:8000/healthz` | `200 OK` | `{"status": "ok", "service": "image-to-3d-api"}` |
| **API Readiness** | `http://localhost:8000/readyz` | `200 OK` | `{"status": "ready", "database": "connected"}` |
| **API Docs (Swagger)** | `http://localhost:8000/docs` | `200 OK` | OpenAPI interactive documentation |
| **Blender Worker Liveness** | `http://localhost:8001/healthz` | `200 OK` | `{"status": "ok", "service": "blender-geometry-worker", "blender_available": true}` |
| **Blender Worker Readiness** | `http://localhost:8001/readyz` | `200 OK` | `{"status": "ready", "blender_version": "Blender 3.4.1 ..."}` |
| **MinIO Storage Health** | `http://localhost:9000/minio/health/live` | `200 OK` | Server live indicator |
| **MinIO Web Console** | `http://localhost:9001/` | `200 OK` | MinIO browser login (`minioadmin` / `minioadmin`) |

---

## 5. Service Operations & Useful Commands

### Viewing Logs
Stream logs from all services:
```bash
docker compose -f infra/docker-compose.yml logs -f
```
Or stream logs from a specific service (e.g., API or Blender worker):
```bash
docker compose -f infra/docker-compose.yml logs -f api
docker compose -f infra/docker-compose.yml logs -f blender-worker
```

### Stopping Services
Stop running containers while preserving persistent volumes:
```bash
docker compose -f infra/docker-compose.yml down
```

### Teardown with Volumes (Full Reset)
> [!CAUTION]
> This command will delete database records, cached Redis data, and uploaded assets in MinIO!
```bash
docker compose -f infra/docker-compose.yml down -v
```

---

## 6. Production Hardening Guide

When deploying this stack to production environments (AWS ECS/EKS, GCP Cloud Run/GKE, DigitalOcean, or bare-metal Kubernetes), adhere to the following best practices:

### A. Secure Secrets Management
- **Never commit `.env` or API keys to git.**
- Generate cryptographically strong random secrets for `AUTH_SECRET` and `CREDENTIAL_ENCRYPTION_MASTER_KEY`:
  ```bash
  openssl rand -base64 32
  ```
- Store secrets using a managed secret store such as **AWS Secrets Manager**, **GCP Secret Manager**, or **HashiCorp Vault**.
- User BYOK credentials (OpenAI, Anthropic, Inception, Meshy, Tripo) must remain encrypted at rest with `CREDENTIAL_ENCRYPTION_MASTER_KEY`.

### B. HTTPS & Reverse Proxy
- Place an SSL/TLS termination layer (e.g., **Traefik**, **NGINX**, **Caddy**, or an **AWS Application Load Balancer**) in front of `web` and `api`.
- Set strict HTTP headers: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.
- Restrict direct public exposure of internal services (`postgres`, `redis`, `blender-worker`, `minio`).

### C. Persistent Volumes & Backup Strategy
- **PostgreSQL:** Automate daily logical backups using `pg_dump` or WAL-G / Barman for point-in-time recovery:
  ```bash
  docker compose -f infra/docker-compose.yml exec -T postgres pg_dump -U postgres image_to_3d | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
  ```
- **S3 Storage:** In production, transition from local MinIO to **AWS S3** with cross-region replication, versioning, and lifecycle expiration policies for intermediate assets.
- **Redis:** Configure append-only persistence (`appendonly yes`) if job queues must survive hard Redis restarts.

### D. Sandboxed Worker Limits & Security
- **Resource Constraints:** Blender mesh compilation can be CPU/memory intensive. Set CPU and memory limits in Compose or Kubernetes:
  ```yaml
  deploy:
    resources:
      limits:
        cpus: '2.0'
        memory: 4096M
      reservations:
        cpus: '0.5'
        memory: 1024M
  ```
- **Execution Isolation:** The geometry engine exclusively processes declarative, schema-validated `SceneSpec` parameters. Raw, arbitrary model-generated Python/shell scripts must never be executed.
- **Unprivileged Users:** The Next.js image runs as non-root user `nextjs` (UID 1001). Worker processes should be run under unprivileged system users with read-only root filesystems and dedicated temporary scratch directories.
