# syntax=docker/dockerfile:1

FROM python:3.12-slim AS base

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY apps/api/requirements.txt /app/apps/api/requirements.txt
RUN pip install --no-cache-dir -r /app/apps/api/requirements.txt redis psycopg[binary] boto3 minio

# Copy code
COPY packages /app/packages
COPY apps/api /app/apps/api
COPY infra/scripts /app/infra/scripts

# Install internal contracts package
RUN pip install --no-cache-dir -e /app/packages/contracts

ENV PYTHONPATH="/app/apps/api:/app/packages/contracts/src:/app/packages/db:/app"
ENV PYTHONUNBUFFERED=1

CMD ["python", "-m", "infra.scripts.worker"]
