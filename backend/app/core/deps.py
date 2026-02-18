"""FastAPI dependencies — current user, role checks, audit helper."""

import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.core import decode_token
from app.models.user import User, UserRole
from app.models.audit import AuditLog

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Session = Depends(get_db),
) -> User:
    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    user = db.query(User).filter(User.id == uuid.UUID(user_id)).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_role(*roles: UserRole):
    """Dependency factory: user must have one of the given roles."""
    def checker(user: CurrentUser) -> User:
        if user.role not in [r.value for r in roles]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return user
    return checker


RequireSuperAdmin = Depends(require_role(UserRole.SUPERADMIN))
RequireAdmin = Depends(require_role(UserRole.SUPERADMIN, UserRole.ADMIN))
RequireAny = Depends(require_role(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.READONLY))


def audit(
    db: Session,
    *,
    action: str,
    user: User | None = None,
    request: Request | None = None,
    resource_type: str | None = None,
    resource_id: str | None = None,
    site_id: uuid.UUID | None = None,
    meta: dict | None = None,
) -> None:
    """Write an audit log entry."""
    entry = AuditLog(
        site_id=site_id,
        actor_user_id=user.id if user else None,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        ip=request.client.host if request and request.client else None,
        user_agent=request.headers.get("user-agent") if request else None,
        meta=meta,
    )
    db.add(entry)
    db.commit()
