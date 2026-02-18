"""Evidence export & download endpoints."""

import uuid
import hashlib
import json
import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import httpx

from app.database import get_db
from app.config import get_settings
from app.core.deps import CurrentUser, audit
from app.models.user import UserRole
from app.models.event import Event
from app.models.evidence import EvidenceExport
from app.models.camera import Camera
from app.schemas.evidence import EvidenceExportRequest, EvidenceOut, EvidenceManifest

router = APIRouter(prefix="/api/evidence", tags=["evidence"])
settings = get_settings()


def _require_admin(user):
    if user.role not in (UserRole.SUPERADMIN.value, UserRole.ADMIN.value):
        raise HTTPException(status_code=403, detail="Admin required")


@router.post("/export", response_model=EvidenceOut, status_code=201)
async def export_evidence(
    body: EvidenceExportRequest,
    user: CurrentUser,
    request: Request,
    db: Session = Depends(get_db),
):
    _require_admin(user)

    ev = db.query(Event).filter(Event.id == body.event_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")

    # Download clip from Frigate
    url = f"{settings.frigate_base_url}/api/events/{ev.frigate_event_id}/clip.mp4"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, timeout=120)
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Cannot download clip from Frigate")

    clip_data = resp.content

    # Compute SHA-256
    sha256 = hashlib.sha256(clip_data).hexdigest()

    # Save to evidence vault
    evidence_id = uuid.uuid4()
    day_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    export_dir = os.path.join(settings.evidence_dir, "exports", day_str)
    os.makedirs(export_dir, exist_ok=True)

    clip_path = os.path.join(export_dir, f"export_{evidence_id}.mp4")
    hash_path = os.path.join(export_dir, f"export_{evidence_id}.sha256")

    with open(clip_path, "wb") as f:
        f.write(clip_data)
    with open(hash_path, "w") as f:
        f.write(sha256)

    # Get camera info for manifest
    camera = db.query(Camera).filter(Camera.id == ev.camera_id).first()

    # Create manifest
    manifest = {
        "evidence_id": str(evidence_id),
        "event_id": str(ev.id),
        "frigate_event_id": ev.frigate_event_id,
        "sha256": sha256,
        "size_bytes": len(clip_data),
        "content_type": "video/mp4",
        "requested_by_email": user.email,
        "requested_at": datetime.now(timezone.utc).isoformat(),
        "reason": body.reason,
        "camera_name": camera.name if camera else None,
        "event_label": ev.label,
        "event_start_time": ev.start_time.isoformat() if ev.start_time else None,
    }
    manifest_path = os.path.join(export_dir, f"manifest_{evidence_id}.json")
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)

    # Record in DB
    export_record = EvidenceExport(
        id=evidence_id,
        event_id=ev.id,
        requested_by=user.id,
        object_store_uri=clip_path,
        sha256=sha256,
        size_bytes=len(clip_data),
        content_type="video/mp4",
        reason=body.reason,
    )
    db.add(export_record)
    db.commit()
    db.refresh(export_record)

    audit(
        db,
        action="evidence_export",
        user=user,
        request=request,
        resource_type="evidence",
        resource_id=str(evidence_id),
        meta={"event_id": str(ev.id), "sha256": sha256},
    )

    return export_record


@router.get("/{evidence_id}/download")
def download_evidence(
    evidence_id: uuid.UUID,
    user: CurrentUser,
    request: Request,
    db: Session = Depends(get_db),
):
    _require_admin(user)
    export = db.query(EvidenceExport).filter(EvidenceExport.id == evidence_id).first()
    if not export:
        raise HTTPException(status_code=404, detail="Evidence not found")

    if not os.path.exists(export.object_store_uri):
        raise HTTPException(status_code=404, detail="Evidence file missing from vault")

    # Increment download count
    export.download_count += 1
    export.last_download_at = datetime.now(timezone.utc)
    db.commit()

    audit(
        db,
        action="evidence_download",
        user=user,
        request=request,
        resource_type="evidence",
        resource_id=str(evidence_id),
    )

    return FileResponse(
        export.object_store_uri,
        media_type=export.content_type,
        filename=f"evidence_{evidence_id}.mp4",
    )


@router.get("/{evidence_id}/manifest", response_model=EvidenceManifest)
def get_manifest(
    evidence_id: uuid.UUID,
    user: CurrentUser,
    db: Session = Depends(get_db),
):
    _require_admin(user)
    export = db.query(EvidenceExport).filter(EvidenceExport.id == evidence_id).first()
    if not export:
        raise HTTPException(status_code=404, detail="Evidence not found")

    ev = db.query(Event).filter(Event.id == export.event_id).first()
    camera = db.query(Camera).filter(Camera.id == ev.camera_id).first() if ev else None
    user_actor = db.query(User).filter(User.id == export.requested_by).first()

    from app.models.user import User

    return EvidenceManifest(
        evidence_id=export.id,
        event_id=export.event_id,
        frigate_event_id=ev.frigate_event_id if ev else "",
        sha256=export.sha256,
        size_bytes=export.size_bytes,
        content_type=export.content_type,
        requested_by_email=user_actor.email if user_actor else "unknown",
        requested_at=export.requested_at,
        reason=export.reason,
        camera_name=camera.name if camera else None,
        event_label=ev.label if ev else None,
        event_start_time=ev.start_time if ev else None,
    )


@router.get("", response_model=list[EvidenceOut])
def list_evidence(user: CurrentUser, db: Session = Depends(get_db)):
    _require_admin(user)
    return db.query(EvidenceExport).order_by(EvidenceExport.requested_at.desc()).limit(100).all()
