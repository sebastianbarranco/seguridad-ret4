"""Audit log endpoints (SuperAdmin only)."""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.deps import CurrentUser
from app.models.user import UserRole
from app.models.audit import AuditLog
from app.schemas.audit import AuditOut

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("", response_model=list[AuditOut])
def list_audit(
    user: CurrentUser,
    db: Session = Depends(get_db),
    from_dt: datetime | None = None,
    to_dt: datetime | None = None,
    actor: str | None = None,
    action: str | None = None,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    if user.role != UserRole.SUPERADMIN.value:
        raise HTTPException(status_code=403, detail="SuperAdmin required")

    q = db.query(AuditLog)
    if from_dt:
        q = q.filter(AuditLog.created_at >= from_dt)
    if to_dt:
        q = q.filter(AuditLog.created_at <= to_dt)
    if action:
        q = q.filter(AuditLog.action == action)
    if actor:
        q = q.filter(AuditLog.actor_user_id == actor)

    return q.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit).all()
