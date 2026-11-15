from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from .api.v1.auth import router as auth_router
from .api.v1.routes import router
from .config import get_settings

app = FastAPI(
    title="Journey Into the Soil API",
    version="0.1.0",
    description="Decision support for crop rotation. Advisory estimates only; supports, never replaces, local expertise.",
)
app.add_middleware(
    CORSMiddleware, allow_origins=get_settings().cors_origins, allow_methods=["GET", "POST"], allow_headers=["*"]
)
app.include_router(router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1/auth")


@app.get("/", include_in_schema=False)
def root() -> RedirectResponse:
    return RedirectResponse("/docs")
