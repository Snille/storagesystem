#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${1:-/opt/lagersystem}"
SERVICE_NAME="${2:-lagersystem.service}"
BRANCH="${3:-main}"
STAGING_DIR=".next-deploy"
PREVIOUS_DIR=".next-prev"

cd "$APP_DIR"

echo "[deploy] fetching origin/${BRANCH}"
git fetch origin "$BRANCH"

echo "[deploy] checking for live-only edits in data/languages"
# Compare against HEAD, not origin: a new commit that changes translations must not block
# the deploy, but uncommitted edits made on the server must not be overwritten.
if [ -n "$(git status --porcelain -- data/languages)" ]; then
  echo "[deploy] ABORT: data/languages has uncommitted changes on this server."
  echo "[deploy] Someone likely edited translations live via Settings > Translations."
  echo "[deploy] Commit/export those changes first, or the reset below will overwrite them."
  exit 1
fi

echo "[deploy] resetting working tree to origin/${BRANCH}"
git reset --hard origin/"$BRANCH"

echo "[deploy] building into ${STAGING_DIR}"
rm -rf "$STAGING_DIR"
NEXT_DIST_DIR="$STAGING_DIR" npm run build

echo "[deploy] swapping build directories"
rm -rf "$PREVIOUS_DIR"
if [ -d ".next" ]; then
  mv ".next" "$PREVIOUS_DIR"
fi
mv "$STAGING_DIR" ".next"

echo "[deploy] restarting ${SERVICE_NAME}"
sudo -n systemctl restart "$SERVICE_NAME"
sleep 3
systemctl is-active --quiet "$SERVICE_NAME"

echo "[deploy] cleaning previous build"
rm -rf "$PREVIOUS_DIR"

echo "[deploy] done"
