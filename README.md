# Blog

A self-hosted, single-author blog in Chinese and English. The owner writes
Markdown posts in a web admin or from Claude Code and Codex through a local MCP
server; readers browse, search, and comment.

- Product requirements: [docs/product/prd.md](docs/product/prd.md)
- Architecture: [docs/design/architecture.md](docs/design/architecture.md)
- Decisions: [docs/decisions/](docs/decisions/)
- Contributor and agent guide: [AGENTS.md](AGENTS.md)

## Requirements

- Node.js 24 with npm (pinned in `.node-version`)
- Docker with Compose

## Run locally

```bash
cp .env.example .env
docker compose up --build
```

The blog is served at <http://127.0.0.1:3000>; `/healthz` reports whether it
can reach its database. Sign in to the admin at
<http://127.0.0.1:3000/admin> with `OWNER_USERNAME` and `OWNER_PASSWORD` from
`.env`; the owner is created from them on first start and never changed by
them afterwards.

For development with hot reload, start only the database and run Next.js on
the host:

```bash
npm ci
docker compose up --detach db
npm run dev
```

## Checks

```bash
scripts/check.sh   # format, lint, types, migrations, tests (needs Docker)
scripts/smoke.sh   # builds and starts the stack, runs Playwright journeys, tears down
```
