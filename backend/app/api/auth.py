"""Auth endpoints — login, refresh, MFA enroll/verify."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database import get_db
from app.core import verify_password, create_access_token, create_refresh_token, decode_token
from app.core.deps import get_current_user, audit, CurrentUser
from app.core.mfa import enroll_totp, verify_totp, is_mfa_enabled
from app.models.user import User
from app.schemas.auth import LoginResponse, MfaEnrollResponse, MfaVerifyRequest, MfaVerifyResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")

    mfa_required = is_mfa_enabled(db, user.id)

    token_data = {"sub": str(user.id), "role": user.role}

    if mfa_required:
        # Return a temporary token that requires MFA verification
        token_data["mfa_pending"] = True

    access = create_access_token(token_data)
    refresh = create_refresh_token(token_data)

    user.last_login_at = datetime.now(timezone.utc)
    db.commit()

    audit(db, action="login", user=user, request=request)

    return LoginResponse(
        access_token=access,
        refresh_token=refresh,
        mfa_required=mfa_required,
    )


@router.post("/logout")
def logout(request: Request, user: CurrentUser, db: Session = Depends(get_db)):
    audit(db, action="logout", user=user, request=request)
    return {"detail": "Logged out"}


@router.post("/refresh", response_model=LoginResponse)
def refresh_token(
    refresh_token: str,
    db: Session = Depends(get_db),
):
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    token_data = {"sub": str(user.id), "role": user.role}
    return LoginResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )


@router.post("/mfa/totp/enroll", response_model=MfaEnrollResponse)
def mfa_enroll(user: CurrentUser, db: Session = Depends(get_db), request: Request = None):
    result = enroll_totp(db, user)
    audit(db, action="mfa_enroll", user=user, request=request)
    return MfaEnrollResponse(**result)


@router.post("/mfa/totp/verify", response_model=MfaVerifyResponse)
def mfa_verify(
    body: MfaVerifyRequest,
    user: CurrentUser,
    db: Session = Depends(get_db),
    request: Request = None,
):
    ok = verify_totp(db, user, body.code)
    if not ok:
        audit(db, action="mfa_verify_fail", user=user, request=request)
        return MfaVerifyResponse(success=False)

    audit(db, action="mfa_verify_ok", user=user, request=request)

    # Issue fresh tokens without mfa_pending
    token_data = {"sub": str(user.id), "role": user.role}
    return MfaVerifyResponse(
        success=True,
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )
