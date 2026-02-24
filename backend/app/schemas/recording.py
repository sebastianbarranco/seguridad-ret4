"""Schemas for the recordings feature."""

import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


class RecordingOut(BaseModel):
    id: uuid.UUID
    camera_id: uuid.UUID
    recording_date: date
    hour: int = 0
    filename: str
    duration_seconds: Optional[float] = None
    size_bytes: Optional[int] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class RecordingUpload(BaseModel):
    camera_id: uuid.UUID
    recording_date: date
    hour: int = 0
    duration_seconds: Optional[float] = None
