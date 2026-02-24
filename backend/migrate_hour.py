"""Add hour column to recordings table if it doesn't exist."""
from app.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    result = conn.execute(
        text("SELECT column_name FROM information_schema.columns WHERE table_name='recordings' AND column_name='hour'")
    )
    rows = result.fetchall()
    if rows:
        print("hour column already exists")
    else:
        print("Adding hour column...")
        conn.execute(text("ALTER TABLE recordings ADD COLUMN hour SMALLINT NOT NULL DEFAULT 0"))
        conn.commit()
        print("hour column added successfully")
