# Blog

A self-hosted, single-author blog in Chinese and English. The owner writes,
previews, publishes, and tags Markdown posts with uploaded images, in a web
admin or from Claude Code and Codex through the blog's MCP server. Readers
browse posts, follow tags, search in Chinese and English, and read in light or
dark. Reader comments and the bilingual interface arrive in later
[milestones](docs/product/prd.md#milestones).

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
the host; `npm run dev` applies pending migrations first:

```bash
npm ci
docker compose up --detach --wait db
npm run dev
```

## Manage posts from Claude Code or Codex

The MCP server in `src/mcp/` runs on your machine and calls the blog's API
with a token. Its tools list posts by status, read a post, create a draft,
edit its content, slug, and tags, publish, unpublish, and delete it to the
trash (restore it from the admin's Trash). `upload_image` uploads an image file from your machine under
the same rules as the admin and returns the Markdown that shows it, for the
assistant to put in a post's body.

1. Run `npm ci` in this checkout; the server needs Node 24 and the installed
   dependencies, and the blog must be running.
2. In the admin, open Tokens, create a token for the assistant, and copy its
   secret; it is shown only once.
3. Register the server from the checkout's root, replacing `<secret>`. The
   commands store the secret in your own client configuration
   (`~/.claude.json` or `~/.codex/config.toml`); never commit it.

   ```bash
   # Claude Code
   claude mcp add blog --scope user -e BLOG_URL=http://127.0.0.1:3000 \
     -e BLOG_API_TOKEN=<secret> -- node "$PWD/src/mcp/server.ts"

   # Codex
   codex mcp add blog --env BLOG_URL=http://127.0.0.1:3000 \
     --env BLOG_API_TOKEN=<secret> -- node "$PWD/src/mcp/server.ts"
   ```

   If `node` on the client's `PATH` is not Node 24, give the absolute path of
   a Node 24 binary instead.
4. Start a new conversation; `/mcp` in either client lists the `blog` tools.

Revoking the token in the admin cuts the assistant off; the tools then report
that the blog refused the token.

## Checks

```bash
scripts/check.sh   # format, lint, types, migrations, tests (needs Docker)
scripts/smoke.sh   # builds and starts the stack, runs Playwright journeys, tears down
```
