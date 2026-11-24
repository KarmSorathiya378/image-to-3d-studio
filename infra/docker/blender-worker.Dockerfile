# syntax=docker/dockerfile:1

FROM python:3.12-slim AS base

WORKDIR /app

# Install Blender and system utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    blender \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies for geometry service
COPY services/geometry-engine/pyproject.toml /app/services/geometry-engine/
COPY packages/contracts/pyproject.toml /app/packages/contracts/
RUN pip install --no-cache-dir fastapi uvicorn pydantic>=2.7.0 httpx

# Copy source trees
COPY packages/contracts /app/packages/contracts
COPY services/geometry-engine /app/services/geometry-engine
COPY infra/scripts /app/infra/scripts

RUN pip install --no-cache-dir -e /app/packages/contracts -e /app/services/geometry-engine

ENV BLENDER_BIN="/usr/bin/blender"
ENV PYTHONPATH="/app/services/geometry-engine/src:/app/packages/contracts/src:/app"
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["python", "-m", "infra.scripts.blender_worker"]
