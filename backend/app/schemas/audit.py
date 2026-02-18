"""Audit schemas."""

import uuid
from datetime import datetime
from pydantic import BaseModel


class AuditOut(BaseModel):
    id: uuid.UUID
    site_id: uuid.UUID | None = None
    actor_user_id: uuid.UUID | None = None
    action: str
    resource_type: str | None = None
    resource_id: str | None = None
    ip: str | None = None
    created_at: datetime
    meta: dict | None = None

    model_config = {"from_attributes": True}


class BackupRunOut(BaseModel):
    id: uuid.UUID
    started_at: datetime
    finished_at: datetime | None = None
    status: str
    utc_day: str
    bytes_sent: int
    files_sent: int
    errors: dict | None = None

    model_config = {"from_attributes": True}
