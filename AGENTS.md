# Blog — Agent Contract

A self-hosted, single-author Chinese and English blog with a Markdown web admin
and a local MCP server so the owner can manage posts from Claude Code or Codex.

- What and why: [docs/product/prd.md](docs/product/prd.md)
- How it is built: [docs/design/architecture.md](docs/design/architecture.md)
- Decisions: [docs/decisions/](docs/decisions/)
- Work in progress: GitHub issues and milestones of this repository

## Commands

```bash
scripts/check.sh   # format check, lint, type check, migration drift, tests — must pass before a PR (needs Docker)
scripts/smoke.sh   # Docker Compose up, probe key paths with Playwright, tear down
docker compose up --build              # run the complete blog at http://127.0.0.1:3000
npx prisma migrate dev --name <slug>   # create a migration after changing prisma/schema.prisma
node src/mcp/server.ts                 # the stdio MCP server; assistants start it (setup in README.md)
```

Copy `.env.example` to `.env` before running Compose. Node 24 is pinned in
`.node-version`.

## Layout

| Path | Owns |
| --- | --- |
| `src/app/` | Next.js routes only: `[locale]/` public pages, `admin/` owner admin, `api/v1/` token API |
| `src/proxy.ts`, `src/instrumentation.ts` | Next.js root hooks: redirect signed-out admin requests, send unknown languages to the framed 404 (exclude new top-level routes in the proxy matcher); create the owner at server start |
| `src/server/<domain>/` | Domain services and persistence (`posts`, `auth`, `tokens`, `health`, `media`, later `comments`); public surface is `index.ts` |
| `src/server/errors/` | `DomainError`, shared by all domains |
| `src/server/db/` | The Prisma client (generated into `generated/`, Git-ignored); the only place it is created |
| `src/contract/` | zod schemas and types of the HTTP API, shared with the MCP server |
| `src/lib/` | Pure functions: Markdown rendering, slugs, excerpts |
| `src/ui/` | Presentational React components |
| `src/mcp/` | Stdio MCP server run on the host; talks to the blog over HTTP only |
| `prisma/` | Schema and committed migrations |
| `e2e/` | Playwright journeys run by `scripts/smoke.sh` |

## Conventions

- Routes, Server Actions, and route handlers stay thin: parse input, check
  access, call one service, render or respond.
- Services throw `DomainError` with a code (`NOT_FOUND`, `VALIDATION`,
  `CONFLICT`, `UNAUTHORIZED`); the API returns
  `{ "error": { "code", "message" } }`; MCP tools turn errors into plain
  sentences.
- Validate external input with zod at the boundary; trust types inside.
- The web server reads configuration only through `src/server/config`; add
  every new variable to `.env.example`. The MCP server reads `BLOG_URL` and
  `BLOG_API_TOKEN` from the assistant's configuration, not from `.env`.
- Tests sit next to the code as `*.test.ts`; database tests use the shared
  Testcontainers Postgres, never mocks of Prisma. Every test starts with empty
  tables (`src/server/db/testing/setup.ts`); create the data a test needs in
  the test and write no cleanup.
- Use only erasable TypeScript syntax in `src/mcp/` so Node runs it without a
  build.
- Next.js 16 differs from older versions; check `node_modules/next/dist/docs/`
  before relying on a remembered API.
- Style with the design tokens in `src/ui/tokens.css` and CSS Modules next to
  `ui/` components; no raw colors, inline styles, CSS frameworks, or web fonts
  ([0005](docs/decisions/0005-css-modules-and-design-tokens.md)).
- Pull requests that change a screen include light and dark screenshots of it.

## Invariants

- Dependency direction: `app → server, ui, contract, lib`; `server → contract,
  lib`; `ui → lib`; `mcp → contract`. Enforced by ESLint; do not disable it.
- Only `src/server/` touches the database, and a domain uses another domain
  only through its `index.ts`.
- Admin and MCP share the same services; never add content rules to a route,
  action, or MCP tool.
- Public pages read posts only through the `posts` published-post queries;
  drafts and trashed posts are never public.
- Every Server Action and route handler checks access itself. The API accepts
  only Bearer tokens; the admin accepts only the session cookie.
- Passwords, session tokens, and API tokens are stored hashed and never logged.
- Deleting moves a post to the trash; permanent deletion is admin-only and not
  in the API.
- Post URLs are `/<locale>/posts/<slug>`; a slug is immutable after first
  publication.
- Content pages render per request; do not enable Next.js data or route
  caching.
- Schema changes ship as new migrations; never edit a merged migration.

## Workflow

- Every change starts from an issue and lands through a pull request with green
  CI; follow the `deliver-issue` Skill.
- Branches: `<type>/<issue>-<slug>` with type `feat`, `fix`, `docs`,
  `refactor`, `test`, or `chore`; worktrees under `.worktrees/`.
- Pull request titles use Conventional Commits and reference the issue; pull
  requests are squash-merged.
- Update the PRD, architecture, or this file in the same pull request when a
  change affects them.
