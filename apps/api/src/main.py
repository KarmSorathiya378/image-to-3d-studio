import uuid
import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from .config import settings
from .routers import (
    auth_router,
    projects_router,
    assets_router,
    providers_router,
    generations_router,
    models_router,
    audit_router,
    health_router,
)

def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # CORS Middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Request ID and timing middleware
    @app.middleware("http")
    async def add_request_id_and_timing(request: Request, call_next):
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        start_time = time.perf_counter()
        
        response = await call_next(request)
        
        process_time = time.perf_counter() - start_time
        response.headers["x-request-id"] = request_id
        response.headers["x-process-time-ms"] = f"{process_time * 1000:.2f}"
        return response

    # Global Exception Handler for uniform error responses
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        # Prevent leaking raw stack traces or internal secrets to clients
        return JSONResponse(
            status_code=500,
            content={
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred. Please contact support.",
                "requestId": request.headers.get("x-request-id"),
            },
        )

    # Health endpoints
    app.include_router(health_router)

    # API v1 routes
    prefix = settings.api_prefix
    app.include_router(auth_router, prefix=prefix)
    app.include_router(projects_router, prefix=prefix)
    app.include_router(assets_router, prefix=prefix)
    app.include_router(providers_router, prefix=prefix)
    app.include_router(generations_router, prefix=prefix)
    app.include_router(models_router, prefix=prefix)
    app.include_router(audit_router, prefix=prefix)

    return app

app = create_app()
