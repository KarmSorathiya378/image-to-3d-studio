from .auth import router as auth_router
from .projects import router as projects_router
from .assets import router as assets_router
from .providers import router as providers_router
from .generations import router as generations_router
from .models import router as models_router
from .audit import router as audit_router
from .health import router as health_router

__all__ = [
    "auth_router",
    "projects_router",
    "assets_router",
    "providers_router",
    "generations_router",
    "models_router",
    "audit_router",
    "health_router",
]
