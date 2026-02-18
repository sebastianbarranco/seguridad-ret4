"""Evidence schemas."""

import uuid
from datetime import datetime
from pydantic import BaseModel


class EvidenceExportRequest(BaseModel):
    event_id: uuid.UUID
    reason: str = ""


class EvidenceOut(BaseModel):
    id: uuid.UUID
    event_id: uuid.UUID
    requested_by: uuid.UUID
    requested_at: datetime
    sha256: str
    size_bytes: int
    content_type: str
    download_count: int
    reason: str | None = None

    model_config = {"from_attributes": True}


class EvidenceManifest(BaseModel):
    evidence_id: uuid.UUID
    event_id: uuid.UUID
    frigate_event_id: str
    sha256: str
    size_bytes: int
    content_type: str
    requested_by_email: str
    requested_at: datetime
    reason: str | None = None
    camera_name: str | None = None
    event_label: str | None = None
    event_start_time: datetime | None = None
