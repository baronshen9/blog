# 0001. Next.js monolith with Postgres

- **Status:** accepted
- **Date:** 2026-10-26

## Context

The blog needs a public site, a private web admin with Markdown preview, and a
token-authenticated HTTP API for a local MCP server. It has one owner, low
traffic, runs in local Docker, and must later move to a single virtual server
without managed services. Search must work for Chinese and English.

## Decision

Build one Next.js 16 application (App Router, React 19, TypeScript) that serves
the public pages, the admin, and the API, backed by Postgres 18 through Prisma.
Pages are rendered on the server; admin writes use Server Actions; the API uses
route handlers. Domain logic lives in `src/server/` and is shared by all three.
Search uses substring matching in Postgres rather than a separate engine.

## Consequences

- One codebase and one language for site, API, and MCP server; React gives
  room for a richer admin editor later.
- Two containers (`web`, `db`) instead of one; tests need a real Postgres
  through Testcontainers, so `scripts/check.sh` requires Docker.
- Authentication, CSRF-safe writes, and interface translation are assembled
  from small pieces rather than provided by the framework; see 0002 and 0004.
- Next.js caching must stay disabled for content pages so edits appear
  immediately.
- Postgres major upgrades need a dump and restore; the volume layout keeps
  that a single-server operation.

## Alternatives considered

- Django monolith with SQLite — fewest moving parts and built-in auth and
  i18n; not chosen by the owner at design review.
- Lightweight TypeScript server (Hono or Fastify) with templates and SQLite —
  same shape with fewer framework features; more hand-assembled glue code.
- SQLite instead of Postgres — simpler to operate, but the chosen stack is
  better supported on Postgres and Postgres leaves room for `pg_trgm` search.
- A dedicated search engine (Meilisearch, Elasticsearch) — another service to
  run for a few hundred posts.
