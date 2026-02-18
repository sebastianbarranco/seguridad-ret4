"""User management endpoints (SuperAdmin only)."""

import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.core import hash_password
from app.core.deps import get_current_user, audit, CurrentUser
from app.core.mfa import is_mfa_enabled
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserUpdate, UserOut

router = APIRouter(prefix="/api/users", tags=["users"])


def _require_superadmin(user: CurrentUser):
    if user.role != UserRole.SUPERADMIN.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="SuperAdmin required")
    return user


@router.get("", response_model=list[UserOut])
def list_users(
    user: CurrentUser,
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    _require_superadmin(user)
    users = db.query(User).filter(User.tenant_id == user.tenant_id).offset(skip).limit(limit).all()
    result = []
    for u in users:
        out = UserOut.model_validate(u)
        out.mfa_enabled = is_mfa_enabled(db, u.id)
        result.append(out)
    return result


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    body: UserCreate,
    user: CurrentUser,
    request: Request,
    db: Session = Depends(get_db),
):
    _require_superadmin(user)
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    new_user = User(
        tenant_id=user.tenant_id,
        email=body.email,
        password_hash=hash_password(body.password),
        role=body.role,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    audit(db, action="user_create", user=user, request=request, resource_type="user", resource_id=str(new_user.id))
    return UserOut.model_validate(new_user)


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: uuid.UUID,
    body: UserUpdate,
    user: CurrentUser,
    request: Request,
    db: Session = Depends(get_db),
):
    _require_superadmin(user)
    target = db.query(User).filter(User.id == user_id, User.tenant_id == user.tenant_id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if body.role is not None:
        target.role = body.role
    if body.is_active is not None:
        target.is_active = body.is_active
    db.commit()
    db.refresh(target)
    audit(db, action="user_update", user=user, request=request, resource_type="user", resource_id=str(user_id))
    out = UserOut.model_validate(target)
    out.mfa_enabled = is_mfa_enabled(db, target.id)
    return out


@router.post("/{user_id}/reset-password")
def reset_password(
    user_id: uuid.UUID,
    user: CurrentUser,
    request: Request,
    db: Session = Depends(get_db),
    new_password: str = "",
):
    _require_superadmin(user)
    target = db.query(User).filter(User.id == user_id, User.tenant_id == user.tenant_id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if not new_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="new_password required")

    target.password_hash = hash_password(new_password)
    db.commit()
    audit(db, action="password_reset", user=user, request=request, resource_type="user", resource_id=str(user_id))
    return {"detail": "Password reset"}
