#!/usr/bin/env bash
# Format check, lint, type check, Prisma schema validation, and tests.
# The Vitest global setup starts a Postgres container (Testcontainers), applies
# the committed migrations, and fails on drift between them and the schema, so
# Docker must be running. Install dependencies first with `npm ci`.
set -euo pipefail
cd "$(dirname "$0")/.."
trap 'echo "check: FAILED" >&2' ERR

npx --no-install prettier --check .
npx --no-install eslint --max-warnings 0 .
npx --no-install prisma validate
npx --no-install prisma generate
npx --no-install tsc --noEmit
npx --no-install vitest run

echo "check: OK"
