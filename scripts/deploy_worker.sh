#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[deploy_worker] cwd: $(pwd)"
if [[ ! -f "wrangler.toml" ]]; then
  echo "[deploy_worker] ERROR: wrangler.toml not found in $ROOT_DIR" >&2
  exit 1
fi

npx wrangler deploy --config ./wrangler.toml
