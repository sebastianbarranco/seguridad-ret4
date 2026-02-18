"""Security utilities — JWT, password hashing, MFA encryption."""

from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
from jose import jwt, JWTError

from app.config import get_settings

settings = get_settings()

# --- Password hashing (bcrypt direct — avoids passlib compatibility issues) ---


def hash_password(password: str) -> str:
    pwd_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


# --- JWT ---
def create_access_token(data: dict[str, Any], expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.jwt_expire_minutes))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_refresh_token(data: dict[str, Any]) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_refresh_expire_minutes)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict[str, Any] | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return payload
    except JWTError:
        return None


# --- MFA secret encryption (simple Fernet-like with AES) ---
# For MVP we use base64-encoded XOR with key; upgrade to Fernet/KMS for production.
import base64
import hashlib


def _derive_key() -> bytes:
    return hashlib.sha256(settings.mfa_encryption_key.encode()).digest()


def encrypt_mfa_secret(secret: str) -> str:
    key = _derive_key()
    data = secret.encode()
    encrypted = bytes(a ^ b for a, b in zip(data, (key * ((len(data) // len(key)) + 1))[:len(data)]))
    return base64.urlsafe_b64encode(encrypted).decode()


def decrypt_mfa_secret(encrypted: str) -> str:
    key = _derive_key()
    data = base64.urlsafe_b64decode(encrypted.encode())
    decrypted = bytes(a ^ b for a, b in zip(data, (key * ((len(data) // len(key)) + 1))[:len(data)]))
    return decrypted.decode()
