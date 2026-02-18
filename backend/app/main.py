"""NVR Portal — FastAPI application entry point."""

import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler

from app.config import get_settings
from app.database import SessionLocal, engine, Base
from app.core import hash_password
from app.models import *  # noqa: F401,F403
from app.models.user import User, UserRole
from app.models.tenant import Tenant, Site
from app.models.camera import Camera
from app.services.frigate_sync import sync_events_from_frigate

log = structlog.get_logger()
settings = get_settings()

scheduler = BackgroundScheduler()


def _scheduled_sync():
    """Background job: sync events from Frigate."""
    db = SessionLocal()
    try:
        count = sync_events_from_frigate(db)
        log.info("scheduled_sync", new_events=count)
    except Exception as e:
        log.error("scheduled_sync_error", error=str(e))
    finally:
        db.close()


def _seed_data():
    """Create default tenant, site, admin user, and cameras if DB is empty."""
    db = SessionLocal()
    try:
        if db.query(User).count() > 0:
            log.info("seed_skip", reason="users already exist")
            return

        # Tenant
        tenant = Tenant(id=uuid.uuid4(), name="Default Tenant")
        db.add(tenant)

        # Site
        site = Site(id=uuid.uuid4(), tenant_id=tenant.id, name="Sitio Principal", timezone="America/Mexico_City")
        db.add(site)

        # SuperAdmin user
        admin = User(
            id=uuid.uuid4(),
            tenant_id=tenant.id,
            email=settings.seed_admin_email,
            password_hash=hash_password(settings.seed_admin_password),
            role=UserRole.SUPERADMIN.value,
            is_active=True,
        )
        db.add(admin)

        # Default cameras (matching Frigate config)
        cam1 = Camera(
            id=uuid.uuid4(),
            site_id=site.id,
            name="Cámara Entrada",
            frigate_name="cam_entrada",
            rtsp_url_redacted="rtsp://***@192.168.100.10/stream1",
        )
        cam2 = Camera(
            id=uuid.uuid4(),
            site_id=site.id,
            name="Cámara Patio",
            frigate_name="cam_patio",
            rtsp_url_redacted="rtsp://***@192.168.100.11/stream1",
        )
        db.add_all([cam1, cam2])

        db.commit()
        log.info("seed_complete", admin_email=settings.seed_admin_email)

    except Exception as e:
        db.rollback()
        log.error("seed_error", error=str(e))
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    log.info("app_starting")

    # Run migrations (in prod, prefer explicit alembic upgrade)
    Base.metadata.create_all(bind=engine)

    # Seed default data
    _seed_data()

    # Start scheduler for Frigate polling
    scheduler.add_job(
        _scheduled_sync,
        "interval",
        seconds=settings.frigate_poll_interval_seconds,
        id="frigate_sync",
        replace_existing=True,
    )
    scheduler.start()
    log.info("scheduler_started", interval_s=settings.frigate_poll_interval_seconds)

    yield

    # Shutdown
    scheduler.shutdown(wait=False)
    log.info("app_stopped")


app = FastAPI(
    title="NVR Portal API",
    version="1.0.0",
    description="On-prem video surveillance portal with Frigate NVR integration",
    lifespan=lifespan,
)

# CORS (restrictive — adjust for your network)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.api.cameras import router as cameras_router
from app.api.events import router as events_router
from app.api.evidence import router as evidence_router
from app.api.audit import router as audit_router
from app.api.backups import router as backups_router

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(cameras_router)
app.include_router(events_router)
app.include_router(evidence_router)
app.include_router(audit_router)
app.include_router(backups_router)


@app.get("/api/health")
def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}
