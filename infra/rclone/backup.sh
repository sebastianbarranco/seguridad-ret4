#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# backup.sh — Nightly backup to Google Drive via rclone
# Copies yesterday's recordings (UTC), clips, and evidence
# Then verifies integrity and applies retention policy
# ============================================================

: "${SOURCE_DIR:?SOURCE_DIR required}"
: "${DEST_REMOTE:?DEST_REMOTE required}"
: "${DEST_PATH:?DEST_PATH required}"
: "${RETENTION_DAYS:?RETENTION_DAYS required}"

UTC_YDAY="$(date -u -d 'yesterday' +%F)"

SRC_RECORDINGS="${SOURCE_DIR}/frigate/recordings/${UTC_YDAY}"
SRC_CLIPS="${SOURCE_DIR}/frigate/clips"
SRC_EVID="${SOURCE_DIR}/evidence"

DEST="${DEST_REMOTE}:${DEST_PATH}"

echo "==========================================="
echo "[INFO] $(date -Iseconds) Backup started"
echo "[INFO] UTC day: ${UTC_YDAY}"
echo "[INFO] Source recordings: ${SRC_RECORDINGS}"
echo "[INFO] Destination: ${DEST}/${UTC_YDAY}"
echo "==========================================="

# ----------------------------------------------------------
# 1) Copy recordings (yesterday UTC) to Drive
# Using 'copy' (not sync) to avoid accidental deletions
# ----------------------------------------------------------
if [ -d "${SRC_RECORDINGS}" ]; then
    echo "[STEP 1] Copying recordings for ${UTC_YDAY}..."
    rclone copy "${SRC_RECORDINGS}" "${DEST}/recordings/${UTC_YDAY}" \
        --create-empty-src-dirs \
        --transfers=4 --checkers=8 --fast-list \
        --log-level INFO
    echo "[STEP 1] Recordings copy completed."
else
    echo "[STEP 1] SKIP — no recordings folder for ${UTC_YDAY}"
fi

# ----------------------------------------------------------
# 2) Copy clips/snapshots (may contain evidence)
# ----------------------------------------------------------
if [ -d "${SRC_CLIPS}" ]; then
    echo "[STEP 2] Copying clips..."
    rclone copy "${SRC_CLIPS}" "${DEST}/clips" \
        --transfers=4 --checkers=8 --fast-list \
        --log-level INFO
    echo "[STEP 2] Clips copy completed."
else
    echo "[STEP 2] SKIP — no clips folder"
fi

# ----------------------------------------------------------
# 3) Copy evidence vault (signed exports)
# ----------------------------------------------------------
if [ -d "${SRC_EVID}" ]; then
    echo "[STEP 3] Copying evidence..."
    rclone copy "${SRC_EVID}" "${DEST}/evidence" \
        --transfers=4 --checkers=8 --fast-list \
        --log-level INFO
    echo "[STEP 3] Evidence copy completed."
else
    echo "[STEP 3] SKIP — no evidence folder"
fi

# ----------------------------------------------------------
# 4) Verify integrity of freshly copied recordings
# ----------------------------------------------------------
if [ -d "${SRC_RECORDINGS}" ]; then
    echo "[STEP 4] Verifying integrity (rclone check)..."
    rclone check "${SRC_RECORDINGS}" "${DEST}/recordings/${UTC_YDAY}" \
        --one-way \
        --log-level INFO || {
            echo "[ERROR] Integrity check FAILED for ${UTC_YDAY}"
            exit 1
        }
    echo "[STEP 4] Integrity check PASSED."
fi

# ----------------------------------------------------------
# 5) Retention — delete old files in destination
# ----------------------------------------------------------
echo "[STEP 5] Applying retention (>${RETENTION_DAYS} days)..."
rclone delete "${DEST}/recordings" --min-age "${RETENTION_DAYS}d" --rmdirs \
    --log-level INFO 2>/dev/null || true
rclone delete "${DEST}/clips" --min-age "${RETENTION_DAYS}d" --rmdirs \
    --log-level INFO 2>/dev/null || true
rclone delete "${DEST}/evidence" --min-age "${RETENTION_DAYS}d" --rmdirs \
    --log-level INFO 2>/dev/null || true
echo "[STEP 5] Retention applied."

echo "==========================================="
echo "[OK] $(date -Iseconds) Backup completed: ${UTC_YDAY}"
echo "==========================================="
