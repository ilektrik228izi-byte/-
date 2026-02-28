#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

MODE="${1:-deploy}"

echo "[deploy_worker] cwd: $(pwd)"
if [[ ! -f "wrangler.root.toml" ]]; then
  echo "[deploy_worker] ERROR: wrangler.root.toml not found in $ROOT_DIR" >&2
  exit 1
fi

case "$MODE" in
  deploy)
    npx wrangler deploy --config ./wrangler.root.toml
    ;;
  upload-version)
    npx wrangler versions upload --config ./wrangler.root.toml
    ;;
  deploy-version)
    npx wrangler versions deploy --config ./wrangler.root.toml
    ;;
  *)
    echo "[deploy_worker] ERROR: unknown mode '$MODE' (use: deploy|upload-version|deploy-version)" >&2
    exit 1
    ;;
esac
