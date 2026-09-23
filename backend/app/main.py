import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.database import Base, engine
from app.routers import (
    assets,
    bookings,
    contracts,
    dashboard,
    feedback,
    finance,
    managers,
    properties,
    public,
    tenants,
    units,
)
from app.routers import auth as auth_router

# Import models so metadata is registered
import app.models  # noqa: F401

settings = get_settings()

app = FastAPI(title="Rental PMS API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

uploads_dir = Path(__file__).resolve().parent.parent / "uploads"
uploads_dir.mkdir(parents=True, exist_ok=True)
(uploads_dir / "expenses").mkdir(parents=True, exist_ok=True)
(uploads_dir / "feedback").mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

app.include_router(auth_router.router, prefix="/api")
app.include_router(public.router, prefix="/api")
app.include_router(properties.router, prefix="/api")
app.include_router(units.router, prefix="/api")
app.include_router(tenants.router, prefix="/api")
app.include_router(managers.router, prefix="/api")
app.include_router(assets.router, prefix="/api")
app.include_router(bookings.router, prefix="/api")
app.include_router(contracts.router, prefix="/api")
app.include_router(finance.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(feedback.router, prefix="/api")


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)


@app.get("/api/")
def root():
    return {"name": "Rental PMS API", "status": "ok"}


@app.get("/api/health")
def health():
    return {"ok": True}


WEB_DIST = Path(__file__).resolve().parent.parent.parent / "web" / "dist"


def _web_file(full_path: str) -> Path | None:
    if not full_path:
        return None
    candidate = (WEB_DIST / full_path).resolve()
    try:
        candidate.relative_to(WEB_DIST.resolve())
    except ValueError:
        return None
    if candidate.is_file():
        return candidate
    return None


if os.environ.get("SERVE_WEB") == "1" and WEB_DIST.is_dir():

    @app.get("/{full_path:path}")
    def spa(full_path: str):
        found = _web_file(full_path)
        if found is not None:
            return FileResponse(found)
        index = WEB_DIST / "index.html"
        if not index.is_file():
            raise HTTPException(status_code=404)
        return FileResponse(index)
