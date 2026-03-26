#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${1:-/opt/lagersystem}"
SERVICE_NAME="${2:-lagersystem.service}"
STAGING_DIR=".next-deploy"
PREVIOUS_DIR=".next-prev"

cd "$APP_DIR"

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
systemctl restart "$SERVICE_NAME"
sleep 3
systemctl is-active --quiet "$SERVICE_NAME"

echo "[deploy] cleaning previous build"
rm -rf "$PREVIOUS_DIR"

echo "[deploy] done"
