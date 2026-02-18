"""Event schemas."""

import uuid
from datetime import datetime
from pydantic import BaseModel


class EventOut(BaseModel):
    id: uuid.UUID
    site_id: uuid.UUID
    camera_id: uuid.UUID
    frigate_event_id: str
    label: str
    sub_label: str | None = None
    start_time: datetime
    end_time: datetime | None = None
    has_clip: bool
    has_snapshot: bool
    score: float | None = None
    top_score: float | None = None
    zones: dict | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class EventListParams(BaseModel):
    camera_id: uuid.UUID | None = None
    label: str | None = None
    has_clip: bool | None = None
    has_snapshot: bool | None = None
    from_dt: datetime | None = None
    to_dt: datetime | None = None
    limit: int = 50
    offset: int = 0
