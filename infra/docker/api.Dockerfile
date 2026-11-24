# syntax=docker/dockerfile:1

FROM python:3.12-slim AS base

WORKDIR /app

# Install system dependencies for compilation, health check and PostgreSQL connectivity
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY apps/api/requirements.txt /app/apps/api/requirements.txt
RUN pip install --no-cache-dir -r /app/apps/api/requirements.txt psycopg[binary]

# Copy code
COPY packages/contracts /app/packages/contracts
COPY packages/db /app/packages/db
COPY apps/api /app/apps/api

# Install internal packages in editable mode
RUN pip install --no-cache-dir -e /app/packages/contracts

ENV PYTHONPATH="/app/apps/api:/app/packages/contracts/src:/app/packages/db"
ENV PYTHONUNBUFFERED=1
ENV ENVIRONMENT=production

WORKDIR /app/apps/api

EXPOSE 8000

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
