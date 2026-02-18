"""Event endpoints — list, detail, sync trigger, media proxy."""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import httpx

from app.database import get_db
from app.config import get_settings
from app.core.deps import CurrentUser, audit
from app.models.event import Event
from app.schemas.event import EventOut
from app.services.frigate_sync import sync_events_from_frigate

router = APIRouter(prefix="/api/events", tags=["events"])
settings = get_settings()


@router.get("", response_model=list[EventOut])
def list_events(
    user: CurrentUser,
    db: Session = Depends(get_db),
    camera_id: uuid.UUID | None = None,
    label: str | None = None,
    has_clip: bool | None = None,
    has_snapshot: bool | None = None,
    from_dt: datetime | None = None,
    to_dt: datetime | None = None,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    q = db.query(Event)
    if camera_id:
        q = q.filter(Event.camera_id == camera_id)
    if label:
        q = q.filter(Event.label == label)
    if has_clip is not None:
        q = q.filter(Event.has_clip == has_clip)
    if has_snapshot is not None:
        q = q.filter(Event.has_snapshot == has_snapshot)
    if from_dt:
        q = q.filter(Event.start_time >= from_dt)
    if to_dt:
        q = q.filter(Event.start_time <= to_dt)
    q = q.order_by(Event.start_time.desc())
    return q.offset(offset).limit(limit).all()


@router.get("/{event_id}", response_model=EventOut)
def get_event(event_id: uuid.UUID, user: CurrentUser, db: Session = Depends(get_db)):
    ev = db.query(Event).filter(Event.id == event_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
    return ev


@router.post("/sync")
def trigger_sync(user: CurrentUser, request: Request, db: Session = Depends(get_db)):
    """Manually trigger a sync from Frigate API."""
    count = sync_events_from_frigate(db)
    audit(db, action="events_sync", user=user, request=request, meta={"synced": count})
    return {"synced": count}


@router.get("/{event_id}/snapshot")
async def proxy_snapshot(event_id: uuid.UUID, user: CurrentUser, db: Session = Depends(get_db)):
    """Proxy snapshot from Frigate so frontend never talks to Frigate directly."""
    ev = db.query(Event).filter(Event.id == event_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")

    url = f"{settings.frigate_base_url}/api/events/{ev.frigate_event_id}/snapshot.jpg"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, timeout=15)
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Frigate snapshot unavailable")
    return StreamingResponse(
        iter([resp.content]),
        media_type=resp.headers.get("content-type", "image/jpeg"),
    )


@router.get("/{event_id}/clip")
async def proxy_clip(event_id: uuid.UUID, user: CurrentUser, db: Session = Depends(get_db)):
    """Proxy clip mp4 from Frigate."""
    ev = db.query(Event).filter(Event.id == event_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")

    url = f"{settings.frigate_base_url}/api/events/{ev.frigate_event_id}/clip.mp4"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, timeout=60)
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Frigate clip unavailable")
    return StreamingResponse(
        iter([resp.content]),
        media_type="video/mp4",
        headers={"Content-Disposition": f'inline; filename="{ev.frigate_event_id}.mp4"'},
    )
