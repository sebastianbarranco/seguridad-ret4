"""Application configuration — loaded from environment variables."""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # --- Database ---
    database_url: str = "postgresql+psycopg://nvr:changeme@localhost:5432/nvr_portal"

    # --- Frigate ---
    frigate_base_url: str = "http://frigate:5000"
    frigate_poll_interval_seconds: int = 30

    # --- MinIO / S3 ---
    minio_endpoint: str = "minio:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "changeme"
    minio_bucket: str = "evidence"
    minio_secure: bool = False

    # --- Auth ---
    jwt_secret: str = "changeme_jwt_secret_min_32_chars_long!!"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60
    jwt_refresh_expire_minutes: int = 1440  # 24h

    # --- MFA ---
    mfa_encryption_key: str = "changeme_mfa_key_32_chars_exactly!"
    mfa_issuer: str = "NVR Portal"

    # --- Evidence ---
    evidence_dir: str = "/evidence"

    # --- General ---
    tz: str = "America/Mexico_City"
    debug: bool = False

    # --- SuperAdmin seed ---
    seed_admin_email: str = "admin@nvr.local"
    seed_admin_password: str = "Admin123!"

    model_config = {"env_file": ".env", "case_sensitive": False}


@lru_cache
def get_settings() -> Settings:
    return Settings()
