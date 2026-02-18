"""MFA TOTP helpers — enrollment, verification, QR generation."""

import io
import base64
from datetime import datetime, timezone

import pyotp
import qrcode

from sqlalchemy.orm import Session

from app.config import get_settings
from app.core import encrypt_mfa_secret, decrypt_mfa_secret
from app.models.user import MfaTotp, User

settings = get_settings()


def enroll_totp(db: Session, user: User) -> dict:
    """Generate a new TOTP secret and return provisioning URI + QR as base64."""
    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name=user.email, issuer_name=settings.mfa_issuer)

    # Generate QR code as base64 PNG
    img = qrcode.make(uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    qr_b64 = base64.b64encode(buf.getvalue()).decode()

    # Store encrypted secret (not yet enabled)
    encrypted = encrypt_mfa_secret(secret)
    mfa = db.query(MfaTotp).filter(MfaTotp.user_id == user.id).first()
    if mfa:
        mfa.secret_enc = encrypted
        mfa.enabled = False
        mfa.created_at = datetime.now(timezone.utc)
    else:
        mfa = MfaTotp(
            user_id=user.id,
            secret_enc=encrypted,
            enabled=False,
        )
        db.add(mfa)
    db.commit()

    return {
        "secret": secret,
        "uri": uri,
        "qr_base64": qr_b64,
    }


def verify_totp(db: Session, user: User, code: str) -> bool:
    """Verify a TOTP code. On first successful verify, enable MFA."""
    mfa = db.query(MfaTotp).filter(MfaTotp.user_id == user.id).first()
    if not mfa:
        return False

    secret = decrypt_mfa_secret(mfa.secret_enc)
    totp = pyotp.TOTP(secret)

    if not totp.verify(code, valid_window=1):
        return False

    # Enable on first verification
    if not mfa.enabled:
        mfa.enabled = True
    mfa.last_used_at = datetime.now(timezone.utc)
    db.commit()
    return True


def is_mfa_enabled(db: Session, user_id) -> bool:
    mfa = db.query(MfaTotp).filter(MfaTotp.user_id == user_id).first()
    return mfa is not None and mfa.enabled


def disable_totp(db: Session, user_id) -> None:
    mfa = db.query(MfaTotp).filter(MfaTotp.user_id == user_id).first()
    if mfa:
        db.delete(mfa)
        db.commit()
