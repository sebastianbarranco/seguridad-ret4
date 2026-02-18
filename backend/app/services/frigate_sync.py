"""Frigate event sync service — polls /api/events and upserts into Postgres."""

import structlog
import httpx
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.event import Event
from app.models.camera import Camera

log = structlog.get_logger()
settings = get_settings()


def sync_events_from_frigate(db: Session, limit: int = 200) -> int:
    """
    Poll Frigate /api/events and upsert events into Postgres.
    Returns the count of new/updated events.
    """
    url = f"{settings.frigate_base_url}/api/events"
    params = {"limit": limit, "has_clip": 1}

    try:
        with httpx.Client(timeout=30) as client:
            resp = client.get(url, params=params)
            resp.raise_for_status()
    except httpx.HTTPError as e:
        log.error("frigate_sync_error", error=str(e))
        return 0

    events_data = resp.json()
    if not isinstance(events_data, list):
        log.warning("frigate_sync_unexpected_response", data=type(events_data).__name__)
        return 0

    # Build a camera lookup: frigate_name -> camera record
    cameras = {c.frigate_name: c for c in db.query(Camera).filter(Camera.enabled == True).all()}

    count = 0
    for item in events_data:
        frigate_id = item.get("id", "")
        camera_name = item.get("camera", "")

        # Skip if camera not registered in our DB
        cam = cameras.get(camera_name)
        if not cam:
            continue

        # Check if already exists
        existing = db.query(Event).filter(Event.frigate_event_id == frigate_id).first()

        start_ts = item.get("start_time")
        end_ts = item.get("end_time")
        start_dt = datetime.fromtimestamp(start_ts, tz=timezone.utc) if start_ts else None
        end_dt = datetime.fromtimestamp(end_ts, tz=timezone.utc) if end_ts else None

        if existing:
            # Update existing
            existing.label = item.get("label", existing.label)
            existing.sub_label = item.get("sub_label")
            existing.end_time = end_dt
            existing.has_clip = item.get("has_clip", False)
            existing.has_snapshot = item.get("has_snapshot", False)
            existing.score = item.get("score")
            existing.top_score = item.get("top_score")
            existing.zones = item.get("zones", [])
            existing.thumbnail = item.get("thumbnail")
            existing.raw = item
        else:
            # Insert new
            event = Event(
                site_id=cam.site_id,
                camera_id=cam.id,
                frigate_event_id=frigate_id,
                label=item.get("label", "unknown"),
                sub_label=item.get("sub_label"),
                start_time=start_dt or datetime.now(timezone.utc),
                end_time=end_dt,
                has_clip=item.get("has_clip", False),
                has_snapshot=item.get("has_snapshot", False),
                score=item.get("score"),
                top_score=item.get("top_score"),
                zones=item.get("zones", []),
                thumbnail=item.get("thumbnail"),
                raw=item,
            )
            db.add(event)
            count += 1

    db.commit()
    log.info("frigate_sync_complete", new_events=count, total_fetched=len(events_data))
    return count
