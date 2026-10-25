#!/usr/bin/env bash
# Builds and starts the Compose stack under a throwaway project with the
# values from .env.example, waits for the health checks, runs the Playwright
# journeys in e2e/, and tears everything down, including volumes.
set -euo pipefail
cd "$(dirname "$0")/.."

compose=(docker compose --project-name blog-smoke --env-file .env.example)
cleanup() { "${compose[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT
trap 'echo "smoke: FAILED" >&2' ERR

"${compose[@]}" up --build --detach --wait --wait-timeout 180
BASE_URL=http://127.0.0.1:3000 npx --no-install playwright test

echo "smoke: OK"
