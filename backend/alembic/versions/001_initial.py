"""001 — Initial schema: tenants, sites, users, mfa, cameras, events, evidence, audit, backups.

Revision ID: 001_initial
Revises: None
Create Date: 2026-02-17
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- user_role enum ---
    user_role = sa.Enum("superadmin", "admin", "readonly", name="user_role", create_type=True)

    # --- tenants ---
    op.create_table(
        "tenants",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    # --- sites ---
    op.create_table(
        "sites",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("timezone", sa.String(64), server_default="America/Mexico_City"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    # --- users ---
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("email", sa.String(320), unique=True, nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", user_role, nullable=False, server_default="readonly"),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # --- mfa_totp ---
    op.create_table(
        "mfa_totp",
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("secret_enc", sa.String(512), nullable=False),
        sa.Column("enabled", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
    )

    # --- cameras ---
    op.create_table(
        "cameras",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("site_id", UUID(as_uuid=True), sa.ForeignKey("sites.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("frigate_name", sa.String(255), unique=True, nullable=False),
        sa.Column("rtsp_url_redacted", sa.String(512), server_default=""),
        sa.Column("enabled", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    # --- events ---
    op.create_table(
        "events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("site_id", UUID(as_uuid=True), sa.ForeignKey("sites.id"), nullable=False),
        sa.Column("camera_id", UUID(as_uuid=True), sa.ForeignKey("cameras.id"), nullable=False),
        sa.Column("frigate_event_id", sa.String(64), unique=True, nullable=False),
        sa.Column("label", sa.String(64), nullable=False),
        sa.Column("sub_label", sa.String(128), nullable=True),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("has_clip", sa.Boolean, server_default="false"),
        sa.Column("has_snapshot", sa.Boolean, server_default="false"),
        sa.Column("score", sa.Float, nullable=True),
        sa.Column("top_score", sa.Float, nullable=True),
        sa.Column("zones", JSONB, nullable=True),
        sa.Column("thumbnail", sa.Text, nullable=True),
        sa.Column("raw", JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_events_camera_start", "events", ["camera_id", "start_time"])
    op.create_index("ix_events_frigate_id", "events", ["frigate_event_id"], unique=True)
    op.create_index("ix_events_label", "events", ["label"])
    op.create_index("ix_events_start_time", "events", ["start_time"])

    # --- evidence_exports ---
    op.create_table(
        "evidence_exports",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("event_id", UUID(as_uuid=True), sa.ForeignKey("events.id"), nullable=False),
        sa.Column("requested_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("object_store_uri", sa.String(1024), nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("size_bytes", sa.BigInteger, nullable=False),
        sa.Column("content_type", sa.String(64), server_default="video/mp4"),
        sa.Column("download_count", sa.Integer, server_default="0"),
        sa.Column("last_download_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reason", sa.String(512), nullable=True),
    )
    op.create_index("ix_evidence_event", "evidence_exports", ["event_id"])

    # --- audit_log ---
    op.create_table(
        "audit_log",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("site_id", UUID(as_uuid=True), sa.ForeignKey("sites.id"), nullable=True),
        sa.Column("actor_user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("resource_type", sa.String(64), nullable=True),
        sa.Column("resource_id", sa.String(128), nullable=True),
        sa.Column("ip", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("meta", JSONB, nullable=True),
    )
    op.create_index("ix_audit_action", "audit_log", ["action"])
    op.create_index("ix_audit_created", "audit_log", ["created_at"])

    # --- backup_runs ---
    op.create_table(
        "backup_runs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(32), server_default="running"),
        sa.Column("utc_day", sa.String(10), nullable=False),
        sa.Column("bytes_sent", sa.BigInteger, server_default="0"),
        sa.Column("files_sent", sa.Integer, server_default="0"),
        sa.Column("errors", JSONB, nullable=True),
    )


def downgrade() -> None:
    op.drop_table("backup_runs")
    op.drop_table("audit_log")
    op.drop_table("evidence_exports")
    op.drop_table("events")
    op.drop_table("cameras")
    op.drop_table("mfa_totp")
    op.drop_table("users")
    op.drop_table("sites")
    op.drop_table("tenants")
    op.execute("DROP TYPE IF EXISTS user_role")
