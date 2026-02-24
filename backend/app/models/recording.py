"""Recording model — hourly camera recordings stored on disk."""

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Column, String, Date, DateTime, ForeignKey, Integer, Boolean, Float, SmallInteger
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class Recording(Base):
    __tablename__ = "recordings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    camera_id = Column(UUID(as_uuid=True), ForeignKey("cameras.id"), nullable=False)
    recording_date = Column(Date, nullable=False, index=True)
    hour = Column(SmallInteger, nullable=False, default=0)  # 0-23, hour of the day
    filename = Column(String, nullable=False)           # relative path inside /recordings
    duration_seconds = Column(Float, nullable=True)     # duration in seconds
    size_bytes = Column(Integer, nullable=True)
    status = Column(String, nullable=False, default="available")  # available, processing, error
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    camera = relationship("Camera", backref="recordings")

    def __repr__(self):
        return f"<Recording {self.recording_date} H{self.hour:02d} camera={self.camera_id}>"
