#!/usr/bin/env bash
# One-shot remote bootstrap — run AFTER your SSH key works on the VPS.
# Usage (from your laptop, with SSH working):
#   ./scripts/bootstrap-vps-web.sh
#
# Or paste the remote half into an Aliyun console session.

set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:-root@47.243.33.162}"
DEPLOY_PATH="${DEPLOY_PATH:-/root/html-deck-studio}"
REPO_URL="${REPO_URL:-git@github.com:Trade-Offf/NextPPT.git}"

echo "==> Checking SSH to ${DEPLOY_HOST}"
ssh -o BatchMode=yes -o ConnectTimeout=15 "$DEPLOY_HOST" 'echo ok; whoami; hostname'

echo "==> Ensuring repo at ${DEPLOY_PATH}"
ssh "$DEPLOY_HOST" bash -s <<REMOTE
set -euo pipefail
if [[ ! -d '${DEPLOY_PATH}/.git' ]]; then
  mkdir -p '$(dirname "${DEPLOY_PATH}")'
  git clone '${REPO_URL}' '${DEPLOY_PATH}'
else
  cd '${DEPLOY_PATH}'
  git fetch origin
  git checkout main
  git pull --ff-only origin main
fi
mkdir -p '${DEPLOY_PATH}/web-dist'
# Tiny placeholder so Caddy has something before first rsync
if [[ ! -f '${DEPLOY_PATH}/web-dist/index.html' ]]; then
  printf '%s\n' '<!doctype html><title>NextPPT</title><p>Deploy pending</p>' > '${DEPLOY_PATH}/web-dist/index.html'
fi
cd '${DEPLOY_PATH}'
docker compose up -d
docker compose ps
REMOTE

echo "==> Now run: pnpm deploy-web"
echo "==> Then switch Cloudflare DNS (grey cloud A → 47.243.33.162). See apps/web/DEPLOY.md"
