#!/usr/bin/env bash
# Builds and starts the Compose stack under a Compose project of its own with
# the values from .env.example, waits for the health checks, runs the Playwright
# journeys in e2e/, and tears that project down, including its volumes and its
# image. The project name is unique per run, so concurrent runs from different
# worktrees never share containers, data, or the built image. Empty port
# variables let Docker pick free host ports, so a running stack is no obstacle.
set -euo pipefail
cd "$(dirname "$0")/.."

export DB_PORT="" WEB_PORT=""
compose=(docker compose --project-name "blog-smoke-$$-$RANDOM" --env-file .env.example)
cleanup() { "${compose[@]}" down --volumes --rmi local --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT
trap 'echo "smoke: FAILED" >&2' ERR

# The browser for the journeys; a no-op once the matching version is installed.
npx --no-install playwright install --only-shell chromium
"${compose[@]}" up --build --detach --wait --wait-timeout 180
BASE_URL="http://$("${compose[@]}" port web 3000)" npx --no-install playwright test

echo "smoke: OK"
