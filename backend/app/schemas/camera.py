"""Camera schemas."""

import uuid
from datetime import datetime
from pydantic import BaseModel


class CameraCreate(BaseModel):
    name: str
    frigate_name: str
    rtsp_url_redacted: str = ""
    site_id: uuid.UUID


class CameraUpdate(BaseModel):
    name: str | None = None
    rtsp_url_redacted: str | None = None
    enabled: bool | None = None


class CameraOut(BaseModel):
    id: uuid.UUID
    site_id: uuid.UUID
    name: str
    frigate_name: str
    rtsp_url_redacted: str
    enabled: bool
    created_at: datetime

    model_config = {"from_attributes": True}
