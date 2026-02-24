"""Recordings endpoints — list, upload, play, and simulate daily recordings."""

import os
import uuid
import shutil
from datetime import date, datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile, File, Form
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import get_settings
from app.core.deps import CurrentUser, audit
from app.models.recording import Recording
from app.models.camera import Camera
from app.models.user import UserRole
from app.schemas.recording import RecordingOut

router = APIRouter(prefix="/api/recordings", tags=["recordings"])


def _require_admin(user):
    """Raise 403 if user is not admin or superadmin."""
    if user.role not in [UserRole.SUPERADMIN.value, UserRole.ADMIN.value]:
        raise HTTPException(status_code=403, detail="Admin required")
settings = get_settings()

RECORDINGS_DIR = os.environ.get("RECORDINGS_DIR", "/recordings")


def _ensure_dir():
    os.makedirs(RECORDINGS_DIR, exist_ok=True)


@router.get("", response_model=list[RecordingOut])
def list_recordings(
    user: CurrentUser,
    db: Session = Depends(get_db),
    camera_id: uuid.UUID | None = None,
    recording_date: date | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """List recordings with optional filters by camera and date range."""
    q = db.query(Recording)
    if camera_id:
        q = q.filter(Recording.camera_id == camera_id)
    if recording_date:
        q = q.filter(Recording.recording_date == recording_date)
    if from_date:
        q = q.filter(Recording.recording_date >= from_date)
    if to_date:
        q = q.filter(Recording.recording_date <= to_date)
    q = q.order_by(Recording.recording_date.desc(), Recording.created_at.desc())
    return q.offset(offset).limit(limit).all()


@router.get("/{recording_id}", response_model=RecordingOut)
def get_recording(recording_id: uuid.UUID, user: CurrentUser, db: Session = Depends(get_db)):
    rec = db.query(Recording).filter(Recording.id == recording_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found")
    return rec


@router.get("/{recording_id}/play")
def play_recording(recording_id: uuid.UUID, user: CurrentUser, db: Session = Depends(get_db)):
    """Stream the recording MP4 file for playback in the browser."""
    rec = db.query(Recording).filter(Recording.id == recording_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found")

    filepath = os.path.join(RECORDINGS_DIR, rec.filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Recording file not found on disk")

    file_size = os.path.getsize(filepath)
    return FileResponse(
        filepath,
        media_type="video/mp4",
        filename=rec.filename.replace("/", "_"),
        headers={
            "Accept-Ranges": "bytes",
            "Content-Length": str(file_size),
        },
    )


@router.post("/upload", response_model=RecordingOut)
async def upload_recording(
    user: CurrentUser,
    request: Request,
    db: Session = Depends(get_db),
    file: UploadFile = File(...),
    camera_id: str = Form(...),
    recording_date: str = Form(...),
    duration_seconds: float = Form(None),
):
    """Upload a recording file (MP4/MKV) and register it in the system."""
    _require_admin(user)
    _ensure_dir()

    # Validate camera
    cam = db.query(Camera).filter(Camera.id == uuid.UUID(camera_id)).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")

    rec_date = date.fromisoformat(recording_date)

    # Create directory for this date
    date_dir = os.path.join(RECORDINGS_DIR, rec_date.isoformat())
    os.makedirs(date_dir, exist_ok=True)

    # Save file
    safe_name = f"{cam.frigate_name}_{rec_date.isoformat()}_{uuid.uuid4().hex[:8]}.mp4"
    dest_path = os.path.join(date_dir, safe_name)
    relative_path = f"{rec_date.isoformat()}/{safe_name}"

    with open(dest_path, "wb") as f:
        content = await file.read()
        f.write(content)

    file_size = os.path.getsize(dest_path)

    rec = Recording(
        id=uuid.uuid4(),
        camera_id=uuid.UUID(camera_id),
        recording_date=rec_date,
        filename=relative_path,
        duration_seconds=duration_seconds,
        size_bytes=file_size,
        status="available",
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)

    audit(db, action="recording_upload", user=user, request=request,
          meta={"recording_id": str(rec.id), "camera": cam.frigate_name, "date": rec_date.isoformat()})

    return rec


@router.post("/simulate")
def simulate_daily_recording(
    user: CurrentUser,
    request: Request,
    db: Session = Depends(get_db),
):
    """Simulate a daily recording cut: copies sample videos as 'yesterday's' recordings.
    This creates a recording entry for each camera as if they recorded yesterday."""
    _require_admin(user)
    _ensure_dir()

    yesterday = date.today() - timedelta(days=1)
    cameras = db.query(Camera).filter(Camera.enabled == True).all()

    if not cameras:
        raise HTTPException(status_code=400, detail="No cameras configured")

    # Check for sample videos
    sample_dir = "/samples"
    sample_files = []
    if os.path.exists(sample_dir):
        sample_files = [f for f in os.listdir(sample_dir) if f.endswith(('.mp4', '.mkv'))]

    created = []
    for i, cam in enumerate(cameras):
        # Check if already has a recording for yesterday
        existing = db.query(Recording).filter(
            Recording.camera_id == cam.id,
            Recording.recording_date == yesterday,
        ).first()
        if existing:
            continue

        # Create date directory
        date_dir = os.path.join(RECORDINGS_DIR, yesterday.isoformat())
        os.makedirs(date_dir, exist_ok=True)

        # Pick a sample file or generate a test pattern
        safe_name = f"{cam.frigate_name}_{yesterday.isoformat()}.mp4"
        dest_path = os.path.join(date_dir, safe_name)

        if sample_files:
            # Use existing sample
            src = os.path.join(sample_dir, sample_files[i % len(sample_files)])
            shutil.copy2(src, dest_path)
        else:
            # Generate a 30-second test pattern using ffmpeg
            os.system(
                f'ffmpeg -y -f lavfi -i "testsrc2=size=1280x720:rate=30:duration=30" '
                f'-f lavfi -i "sine=frequency=440:duration=30" '
                f'-c:v libx264 -preset ultrafast -c:a aac -shortest '
                f'"{dest_path}" 2>/dev/null'
            )

        if os.path.exists(dest_path):
            file_size = os.path.getsize(dest_path)
            rec = Recording(
                id=uuid.uuid4(),
                camera_id=cam.id,
                recording_date=yesterday,
                filename=f"{yesterday.isoformat()}/{safe_name}",
                duration_seconds=30.0,
                size_bytes=file_size,
                status="available",
            )
            db.add(rec)
            created.append(cam.frigate_name)

    db.commit()

    audit(db, action="recording_simulate", user=user, request=request,
          meta={"date": yesterday.isoformat(), "cameras": created})

    return {
        "date": yesterday.isoformat(),
        "cameras": created,
        "count": len(created),
        "message": f"Simulación completada: {len(created)} grabaciones creadas para {yesterday.isoformat()}"
    }


@router.delete("/{recording_id}")
def delete_recording(
    recording_id: uuid.UUID,
    user: CurrentUser,
    request: Request,
    db: Session = Depends(get_db),
):
    _require_admin(user)
    rec = db.query(Recording).filter(Recording.id == recording_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found")

    # Delete file
    filepath = os.path.join(RECORDINGS_DIR, rec.filename)
    if os.path.exists(filepath):
        os.remove(filepath)

    db.delete(rec)
    db.commit()

    audit(db, action="recording_delete", user=user, request=request,
          meta={"recording_id": str(recording_id)})

    return {"deleted": True}
