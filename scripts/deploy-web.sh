#!/usr/bin/env bash
# Build the static web app and rsync apps/web/dist → VPS web-dist/.
#
# Usage (from repo root):
#   ./scripts/deploy-web.sh
#   DEPLOY_HOST=root@47.243.33.162 DEPLOY_PATH=/root/html-deck-studio ./scripts/deploy-web.sh
#   SKIP_BUILD=1 ./scripts/deploy-web.sh          # rsync existing dist only
#   SKIP_VERIFY=1 ./scripts/deploy-web.sh         # skip post-deploy smoke test
#
# Prerequisites:
#   - SSH access to DEPLOY_HOST (key auth)
#   - Remote repo checked out at DEPLOY_PATH with docker compose running caddy
#   - DNS for next-ppt.com already points (grey-cloud) at the VPS

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DEPLOY_HOST="${DEPLOY_HOST:-root@47.243.33.162}"
DEPLOY_PATH="${DEPLOY_PATH:-/root/html-deck-studio}"
REMOTE_DIST="${DEPLOY_PATH%/}/web-dist"
SKIP_BUILD="${SKIP_BUILD:-0}"
SKIP_VERIFY="${SKIP_VERIFY:-0}"
VERIFY_DOMAIN="${VERIFY_DOMAIN:-https://next-ppt.com}"

echo "==> Deploy web → ${DEPLOY_HOST}:${REMOTE_DIST}"

if [[ "$SKIP_BUILD" != "1" ]]; then
  echo "==> Building @hds/web"
  pnpm --filter @hds/web build
fi

if [[ ! -f apps/web/dist/index.html ]]; then
  echo "ERROR: apps/web/dist/index.html missing — run a build first." >&2
  exit 1
fi

if ! grep -q '__VITE_REACT_SSG_STATIC_LOADER_MANIFEST__' apps/web/dist/index.html; then
  echo "ERROR: dist/index.html is missing inlined SSG loader globals." >&2
  echo "       Rebuild so ssgOptions.onFinished runs inline-ssg-loader-data.mjs." >&2
  exit 1
fi

echo "==> Ensuring remote web-dist exists"
ssh -o BatchMode=yes -o ConnectTimeout=15 "$DEPLOY_HOST" "mkdir -p '$REMOTE_DIST'"

echo "==> rsync dist → remote"
rsync -az --delete \
  --exclude '.DS_Store' \
  --exclude '.vite/' \
  "apps/web/dist/" \
  "${DEPLOY_HOST}:${REMOTE_DIST}/"

echo "==> Reloading Caddy (pick up any Caddyfile changes; static files need no restart)"
ssh -o BatchMode=yes "$DEPLOY_HOST" \
  "cd '$DEPLOY_PATH' && (docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile 2>/dev/null \
    || docker compose up -d caddy)"

if [[ "$SKIP_VERIFY" != "1" ]]; then
  echo "==> verify-deploy against ${VERIFY_DOMAIN}"
  # Give ACME / DNS a short window on first cutover.
  sleep 2
  DEPLOY_DOMAIN="$VERIFY_DOMAIN" pnpm verify-deploy
fi

echo "==> Done."
