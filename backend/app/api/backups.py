"""Backup runs endpoints."""

import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.deps import CurrentUser
from app.models.backup import BackupRun
from app.schemas.audit import BackupRunOut

router = APIRouter(prefix="/api/backups", tags=["backups"])


@router.get("/runs", response_model=list[BackupRunOut])
def list_backup_runs(user: CurrentUser, db: Session = Depends(get_db)):
    return db.query(BackupRun).order_by(BackupRun.started_at.desc()).limit(50).all()


@router.get("/runs/{run_id}", response_model=BackupRunOut)
def get_backup_run(run_id: uuid.UUID, user: CurrentUser, db: Session = Depends(get_db)):
    run = db.query(BackupRun).filter(BackupRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Backup run not found")
    return run
