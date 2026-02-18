"""Backup run model — tracks nightly rclone jobs."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, BigInteger, Integer
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class BackupRun(Base):
    __tablename__ = "backup_runs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="running")  # running / ok / error
    utc_day: Mapped[str] = mapped_column(String(10), nullable=False)  # YYYY-MM-DD
    bytes_sent: Mapped[int] = mapped_column(BigInteger, default=0)
    files_sent: Mapped[int] = mapped_column(Integer, default=0)
    errors: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
