---
status: approved     # draft | approved
approved: 2026-10-26 # YYYY-MM-DD, set at gate G2
---

# Blog — Architecture

Implements [the PRD](../product/prd.md). Decisions with trade-offs are recorded
in [`docs/decisions/`](../decisions/).

## Context and constraints

- **One set of rules, two writers.** The owner changes content from the web
  admin and from Claude Code or Codex through MCP, and both must produce
  identical results (US-6). All content rules live in the server; the MCP
  server is a thin client of a token-authenticated HTTP API.
- **MCP runs on the host.** Image upload through MCP (US-10) reads files from
  the owner's machine, so the MCP process cannot live in a container.
- **Chinese and English search.** Built-in full-text parsers do not segment
  Chinese words reliably. At single-author volume (hundreds of posts),
  substring matching over published posts is exact for both languages.
- **Language shapes URLs from day one.** A published post's URL must stay
  stable (US-3) while M5 adds language-prefixed pages and linked translations,
  so the language prefix and translation group exist from M1.
- **Small and local.** One owner, low traffic, local Docker on macOS, and a
  later single virtual server without managed services. Durability matters
  more than throughput.

## Stack

| Concern | Choice | Reason |
| --- | --- | --- |
| Language and runtime | TypeScript (strict) on Node 24 LTS, npm | One language for site, API, and MCP server; Node 24 runs erasable TypeScript without a build step |
| Framework | Next.js 16 (App Router), React 19 | Server Components render public and admin pages; Server Actions handle admin writes; route handlers serve the API ([0001](../decisions/0001-nextjs-monolith-with-postgres.md)) |
| Persistence | Postgres 18 with Prisma ORM and Prisma Migrate | Durable relational store with constraints; one engine from tests to a future server |
| Markdown | unified (remark-gfm, remark-rehype) with Shiki highlighting, server-side only | One renderer for admin preview and public pages; raw HTML in Markdown is not rendered |
| Images | sharp (also Next.js's image library) | Decodes uploads to verify their format and completeness before they are stored |
| Validation | zod | API request and response schemas shared by route handlers and the MCP server |
| MCP | `@modelcontextprotocol/sdk`, stdio transport, run on the host with `node` ([0003](../decisions/0003-mcp-as-host-stdio-client.md)) | Local Claude Code and Codex support stdio servers |
| Testing | Vitest; Testcontainers for Postgres; Playwright for smoke journeys | Integration tests run against the real engine |
| Styling | CSS Modules and global design tokens (CSS custom properties), light and dark through `prefers-color-scheme`, system fonts ([0005](../decisions/0005-css-modules-and-design-tokens.md)) | Built into Next.js, no runtime or extra dependency; tokens keep every screen consistent |
| Formatting and lint | Prettier, ESLint (typescript-eslint, Next config) | Module boundaries are enforced with ESLint `no-restricted-imports` |
| Packaging and local runtime | Docker Compose | `web` and `db` services; nothing else to install besides Node for development |

## Modules

All application code lives under `src/`.

| Module | Owns | May depend on |
| --- | --- | --- |
| `app/` | Next.js routes only: `app/[locale]/` public pages, `app/admin/` owner admin, `app/api/v1/` token API, `/media/` uploaded images, `/healthz`, `/missing` (the proxy's not-found target). Parses input, checks access, calls services, renders | `server`, `ui`, `contract`, `lib` |
| `server/<domain>/` | Domain logic and persistence, one folder per domain: `posts`, `auth` (owner sessions), `tokens`, `health` (readiness for `/healthz`), `media` (uploaded images), `comments` (reader comments and their rate limit). Each exposes its services through `index.ts` | `server/db`, other domains' `index.ts`, `contract`, `lib` |
| `proxy.ts`, `instrumentation.ts` | Next.js root hooks: the proxy redirects signed-out admin requests and rewrites a public URL whose first segment is not a language, or any URL whose path holds a malformed percent-encoding (admin and `/media` included), to the static `/missing` route, which shows the not-found page in the default language's frame (Next.js matches a rewrite target's pattern against the original path and fails with a 500 on a param it cannot decode, so the target has no dynamic segment; other top-level routes outside the languages, such as `/healthz` and `/api`, are excluded in its matcher); `register()` creates the owner at server start | Same as `app/` |
| `server/errors` | `DomainError` and its codes, shared by all domains | — |
| `server/db` | The Prisma client | — |
| `contract/` | zod schemas and types of the HTTP API | — |
| `lib/` | Pure functions: Markdown rendering, slugs, excerpts | — |
| `ui/` | Presentational React components and their CSS Modules, plus the global design tokens (`ui/tokens.css`); no data access | `lib` |
| `mcp/` | The stdio MCP server; reaches the blog only over HTTP | `contract` |

Dependencies point inward toward domain logic. Only `server/` imports Prisma,
and only through `server/db`. A domain never imports another domain's
internals, only its `index.ts`. Nothing outside `app/` and the root hooks
(`proxy.ts`, `instrumentation.ts`) imports Next.js request APIs.

## Data model

Prisma schema in `prisma/schema.prisma`; every schema change ships as a
committed migration created with `prisma migrate dev` and applied with
`prisma migrate deploy` at container start. Migrations are never edited after
merge.

| Entity | Fields | Rules |
| --- | --- | --- |
| `Owner` | id, username, passwordHash (argon2id), createdAt | Exactly one row, created at startup from `OWNER_USERNAME` and `OWNER_PASSWORD` when absent; never overwritten from the environment |
| `Session` | id, tokenHash, ownerId, createdAt, expiresAt | Cookie (path `/admin`) holds a random token; only its SHA-256 hash is stored. Sessions last 30 days; signing out deletes the row |
| `ApiToken` | id, name, tokenHash, createdAt, lastUsedAt, revokedAt | Secret shown once at creation; only its SHA-256 hash is stored. Revoked tokens are kept for the list but refused |
| `Image` | id, type (`png` \| `jpeg` \| `gif` \| `webp`), byteSize, createdAt | Owned by `media`. The file lives in `MEDIA_DIR` (the Compose `media` volume) as `<id>.<extension>` and is served at `/media/<id>.<extension>`; see image upload below |
| `Post` | id, translationGroupId, language (`zh` \| `en`), title, slug, bodyMarkdown, tags (text array, default empty), status (`draft` \| `published`), publishedAt, createdAt, updatedAt, deletedAt | Unique `(language, slug)` and `(translationGroupId, language)`; title must be non-empty. A new post starts a new translation group |
| `Comment` | id, postId, nickname, message, status (`pending` \| `approved`, default `pending`), createdAt | Owned by `comments`. Nickname and message are trimmed and non-empty, at most 40 and 2,000 characters. Rejecting or removing a comment deletes it. Deleted with its post |
| `CommentRateLimit` | visitorHash, windowStart, count | Owned by `comments`. Key `(visitorHash, windowStart)`; see reader comments below |

Post lifecycle:

- `publishedAt` is set on first publication and kept when the post is
  unpublished and published again.
- The slug is generated from the title (or a short id when the title has no
  Latin characters), editable while the post has never been published, and
  immutable afterwards.
- Deleting sets `deletedAt` (trash). Restoring clears it and sets `status` to
  `draft`. Permanent deletion is a separate admin-only service function and is
  not exposed by the API.

Tags are names stored on the post in the order given, not a separate entity:
a tag exists while a post carries it, and its page lists the published posts
that carry it. The `posts` service normalizes every name before it is stored or
compared (`lib/tag.ts`): Unicode NFKC, lowercase, and each run of spaces,
underscores, and hyphens becomes one hyphen, trimmed at both ends. Spellings
that normalize alike are one tag, kept once per post. A normalized name must be
letters (any script) and digits joined by single hyphens, at most 40
characters; blank names are dropped, other names are refused. Saving tags
replaces all of a post's tags.

## Key flows

**Owner writes in the admin**

1. The proxy (`src/proxy.ts`, Next.js 16's name for middleware) redirects
   requests under `/admin` without a session cookie to the sign-in page.
2. A Server Action calls `requireOwner()`, validates the form, and calls a
   `posts` service.
3. Preview calls the same `lib` Markdown renderer as the public page.

**Owner writes through MCP**

1. Claude Code or Codex starts `node src/mcp/server.ts` with `BLOG_URL` and
   `BLOG_API_TOKEN` from its own configuration.
2. Each tool validates arguments with `contract` schemas and calls
   `app/api/v1/` over HTTP with a Bearer token.
3. The route handler verifies the token, updates `lastUsedAt`, calls the same
   `posts` services as the admin, and returns JSON.
4. The MCP server turns error responses into plain-language tool results.

**Owner adds a translation (M5)**

1. From a post's editor, which shows its other language version and links to
   it, the owner starts the translation; the new-post editor opens in the
   other language, starting from the post's title, body, and tags. Through
   MCP, the `create_translation` tool calls
   `POST /api/v1/posts/{id}/translations` with the translated title, body,
   and tags.
2. The `posts` service creates the translation like a new draft, in the
   post's other language and its translation group. A post in the trash has
   no translation, and a group holds one post per language, trashed posts
   included, so a post whose other version exists is refused with
   `CONFLICT`.
3. Each version keeps its own slug, status, and dates; publishing,
   unpublishing, editing, or trashing one leaves the other unchanged. Post
   responses name the other version as `translation` (its id, language, title,
   status, and whether it is in the trash).

**Reader opens a post**

1. `app/[locale]/posts/[slug]` validates the locale (`zh` or `en`) and loads
   the post through the `posts` published-post query.
2. Missing, draft, or trashed posts render the not-found page.
3. The body is rendered from Markdown on each request.

**Reader browses the home page**

1. `/` redirects to `/<SITE_DEFAULT_LANGUAGE>`.
2. `app/[locale]` lists published posts through the `posts` published-post
   query: newest first publication first, with a plain-text excerpt from
   `lib`, ten per page (`?page=`); a page past the last is not found.
3. Until M5 decides language filtering, both locales list posts of every
   language, each linking to its own `/<language>/posts/<slug>`.

**Owner uploads an image (M3)**

1. In the post editor, the owner picks a file; a Server Action passes its bytes
   to the `media` upload service, the one place that decides what is accepted.
   Uploads through MCP reach the same service through the API: the
   `upload_image` tool reads a local file and sends it to `POST /api/v1/images`,
   which answers the same Markdown for the assistant to put in a post.
2. The service accepts PNG, JPEG, GIF, and WebP up to 5 MB. It decodes the
   file with sharp to learn its format, rather than trusting its name or
   declared type, so truncated or corrupt files are refused too. Every frame
   of an animation is decoded, and a GIF's blocks are also checked to be
   whole, with the trailer after them and every frame's data a valid LZW
   stream that ends with its end-of-information code and holds exactly the
   frame's pixels, because the decoder shows a frame whose data ends early
   with the rest blank and ignores a missing end code or an invalid code after
   the last pixel. SVG is refused
   because it can carry scripts. Every refusal names the reason.
3. The service writes the file, then its `Image` row, and returns its path;
   the editor inserts `![<file name>](/media/<id>.<extension>)` at the cursor
   and previews the body.
4. `/media/<file>` serves stored images to anyone, with a long-lived cache
   header, since a path's content never changes. Images are not tied to posts:
   an image in a draft is reachable by its unguessable path, and removing it
   from a post leaves the file.

The size limit is defined once, in the `media` service, which refuses larger
images for every caller. No caller buffers a larger file first: the Server
Action request limit (`next.config.ts`) is 6 MB, room for an image at the limit
plus the form's encoding, and the upload control refuses larger images before
sending them. `POST /api/v1/images` refuses a body larger than a Base64-encoded
image at the limit plus room for its description, from its declared length or
as soon as more arrives, before parsing it. The `upload_image` tool reads the
limit from `GET /api/v1/images/limits` and compares the local file's size with
it before reading the file; it accepts regular files only.

**Reader comments (M4)**

1. A published post's page shows a comment form with a nickname, a message,
   and a hidden field (`website`) that people never see. Drafts and trashed
   posts have no page, and the `comments` service accepts comments only on a
   post the `posts` published-post queries return.
2. The Server Action passes the fields and the visitor's address to the
   `comments` submit service. The address is the last `X-Forwarded-For`
   entry: the nearest proxy's view of the client, or the connection's address
   that Next.js fills in when the request has no such header. A deployment
   must put a proxy in front that appends or overwrites this header, because
   without one a client can set it.
3. The service refuses, storing nothing: a filled hidden field, an empty or
   overlong nickname or message, a post that is not published, and a visitor
   over the rate limit of 5 comments per fixed 10-minute window. Refusals
   name the reason, and the form keeps the reader's input.
4. The rate limit counts in Postgres, not a separate cache: one upsert per
   submission that passes the other checks into `CommentRateLimit`, keyed by
   an HMAC-SHA-256 of the address under a random key held only in the server process, so the
   address is never stored or logged and a stored hash cannot be reversed by
   trying every address. Ended windows are deleted on each submission; a
   restart starts every count afresh.
5. The comment is stored as `pending`, and the reader is told it awaits
   moderation. No public page shows a pending comment.
6. The owner moderates at `/admin/comments`: the pending queue, oldest first,
   with each comment's post, nickname, message, and time, and below it the
   approved comments, newest first. Approving sets `approved`; rejecting a
   pending comment and removing an approved one delete it, so neither is ever
   shown again. Each action names the status the owner saw, so a stale page
   cannot reject a comment approved meanwhile. The admin navigation shows the
   number of pending comments; it is computed by the admin layout, which does
   not render again on navigation between admin pages, so it updates on a
   page load and after each moderation action. Comments of a trashed post
   leave the queue and the count with their post and return when it is
   restored.
7. A post's page lists its approved comments, oldest first, below the post,
   through a `comments` query that finds the post with the `posts`
   published-post queries, so comments of drafts and trashed posts are never
   public.
8. The owner is not notified of new comments outside the admin: no email,
   push, or other channel. The pending count in the admin navigation is the
   only signal.

**Search (M3)** matches the query as a case-insensitive substring (`ILIKE`,
with its wildcards escaped) against title and body of published posts; there
is no separate search service. The header of every public page submits `?q=`
to `/<locale>/search`, which lists matches like the home page.

**Tag pages (M3)** at `/<locale>/tags/<tag>` (the name percent-encoded) list
the published posts carrying the tag, compared normalized, like the home page.
Post lists, search results, and the post page show each published post's tags
as links to these pages. A tag no published post carries is not found, so the
tags of drafts and trashed posts never reach readers.

## Cross-cutting rules

- **Errors:** services throw `DomainError` with a code (`NOT_FOUND`,
  `VALIDATION`, `CONFLICT`, `UNAUTHORIZED`) and a message safe to show. The API
  maps codes to HTTP status (400, 404, 409, 401) and
  `{ "error": { "code", "message" } }`; the admin shows the message; unexpected
  errors are logged and return a generic message (in the API, code `INTERNAL`
  with status 500).
- **Draft privacy:** public pages read posts only through the `posts`
  published-post queries (`status = published` and `deletedAt` is null).
- **Rendering and caching:** public and admin pages render on each request;
  the Next.js data and route caches are not enabled, so a saved change is
  visible on the next request.
- **Configuration:** environment variables only, read and validated once in
  `server/config`. `.env.example` lists every variable with a safe local value;
  `.env` is ignored by Git. MCP variables live in the assistant's
  configuration, not in `.env`.
- **Security:** every Server Action and route handler checks access itself;
  the proxy only redirects. Admin uses the session cookie (httpOnly,
  SameSite=Lax, Secure over HTTPS); the API accepts only Bearer tokens, never
  cookies. Credentials failures return one generic message. Owner and token
  secrets are compared by hash ([0002](../decisions/0002-built-in-owner-sessions-and-api-tokens.md)).
- **Logging:** one line per request and per unexpected error to stdout. Never
  log passwords, tokens, cookies, or reader IP addresses.
- **Language:** public routes live under `/<locale>/` with `zh` and `en`;
  `SITE_DEFAULT_LANGUAGE` picks the target of `/` and the language preselected
  for a new post. Interface translation and the language switch arrive in M5 ([0004](../decisions/0004-language-prefixed-urls-and-translation-groups.md)).
  The admin is English only.

## Visual design

The approved direction is B (technical): cool neutral surfaces, white cards on
a light gray page, a blue accent, compact language labels, and dark code
blocks. Reference mockups: [light](visual/direction-b-light.png) and
[dark](visual/direction-b-dark.png). The language switch and the Chinese
interface labels they show arrive in M5; until then the interface text is
English.

- **Tokens:** `src/ui/tokens.css` defines every color, spacing step, radius,
  font stack, and font size as a CSS custom property, with a dark set under
  `@media (prefers-color-scheme: dark)`. Components use tokens only: no raw
  color values, no inline styles. The one exception is Shiki's token-based
  inline colors in rendered code blocks ([0005](../decisions/0005-css-modules-and-design-tokens.md)).
- **Fonts:** system stacks only — sans (`-apple-system`, `PingFang SC`,
  `Segoe UI`, `Microsoft YaHei`, sans-serif) for text and headings, and a
  monospace stack for code.
- **Frames:** the public frame (`SiteFrame`: header with the site name, a
  content column of about 860 px, footer), the admin frame (`AdminFrame`:
  dark top bar with navigation and sign-out, full-width work area), and the
  sign-in frame (`SignInFrame`: a centered card). `AdminFrame` marks the
  current section, which `app/` derives from the pathname and passes in.
- **Components in `ui/`:** `PostCard`, `PostMeta` (date and language label),
  `Card` (a page's main content with a back link and title), `PageTitle`
  (with an optional line and actions below and beside it), `LanguageLabel`,
  `Prose` (rendered Markdown, including code, quotes, lists, and tables),
  `Pager`, `Button` and `ButtonLink`, `StatusBadge`, `Field` (labelled inputs
  and errors), `TagField` (a post's tags as removable chips with an input that
  adds them), `TagList` (a published post's tags as links to their tag
  pages), `Notice` (a form's error or success message), `CommentForm` (a
  reader's comment on a post, with its hidden spam field and outcome),
  `CommentList` (a post's approved comments), `CommentTable` (the admin
  comment queue and approved comments, with actions on each),
  `ImageUpload` (a button that uploads an image file and reports a refusal
  beside it), `PostTable` (the admin post list), `TrashTable` (the admin
  trash), `TokenTable` (the admin API token list), and `EditorLayout`
  (Markdown and preview side by side, stacked below 900 px, with the post's
  other language version beside its address).
- **Code blocks:** Shiki renders with one dark theme in both color schemes, so
  code looks the same everywhere.
- **Site name:** read from `SITE_NAME` through `server/config`, default
  "Field Notes".
- **Responsive:** one column below 640 px; code blocks and tables scroll
  horizontally inside their own box.

## Test strategy

| Behavior | Primary guard | Evidence |
| --- | --- | --- |
| Invalid input and impossible states | TypeScript, zod schemas, Prisma enums | Unit tests at the API and form boundary |
| Markdown rendering, slugs, excerpts | Pure functions in `lib/` | Unit tests |
| Post lifecycle, draft privacy, trash, token revocation | Services and database constraints | Integration tests against Postgres (Testcontainers), calling services and route handlers directly |
| Server Action access checks and their wiring to services | `requireOwner` in each action | Integration tests that call the actions directly, with the request APIs of `next/headers`, `next/server`, and `next/cache` stubbed |
| MCP tool behavior and error wording | `contract` schemas | Unit tests with a stubbed `fetch` |
| Module dependency direction | ESLint `no-restricted-imports` | `scripts/check.sh` |
| Key user journeys | The integrated stack | `scripts/smoke.sh` |
| Visual design | Design tokens and `ui/` components | Light and dark screenshots of changed screens in each interface pull request, reviewed by the user at milestone acceptance |

Integration tests share one Postgres container per run. Test files run one at
a time, and a Vitest setup file truncates every application table before each
test, so each test creates the data it needs and writes no cleanup.

Smoke journeys share one running stack and run in parallel. Each marks the
data it creates with `marker()` from `e2e/owner.ts` (random, never the clock)
and asserts only on that data, never on global order, counts, or the page that
lists it; `homeCard()` there finds a journey's post on any home page.

## Commands

| Command | Purpose | Budget |
| --- | --- | --- |
| `scripts/check.sh` | `prettier --check`, `eslint`, `tsc --noEmit`, `prisma validate`, migration drift check (`prisma migrate diff --exit-code`), `vitest run`; also run by CI. Requires Docker for Testcontainers | about 2 minutes |
| `scripts/smoke.sh` | `docker compose up --build --wait` under a project name unique to the run, so runs can overlap; health check, Playwright journeys, teardown of that project with `down -v --rmi local` | a few minutes |

Smoke journeys grow with milestones. M1: sign in, save a draft, confirm its
URL is not found, publish, read it on the public site, unpublish, confirm it is
not found again. M2 adds an API round trip with a token created in the admin
and an MCP stdio round trip that creates and publishes a draft with a token. Later milestones add one journey per milestone.

## Host toolchain

| Tool | Version | Pinned in |
| --- | --- | --- |
| Node.js with npm | 24 LTS, at least 24.7 for the built-in argon2 | `.node-version`, `package.json` engines |
| Docker with Compose | A Compose plugin that supports `docker compose up --wait` | — |

`scripts/check.sh` needs Docker for Testcontainers; `scripts/smoke.sh` needs
Compose. The MCP server needs only Node and the installed dependencies on the
host ([0003](../decisions/0003-mcp-as-host-stdio-client.md)).

## Local runtime

| Service | Image | Details |
| --- | --- | --- |
| `db` | `postgres:18` | Volume `pgdata`; health check with `pg_isready`; published on `127.0.0.1:5432` (`DB_PORT`) for `npm run dev` |
| `web` | Built from `Dockerfile` (Next.js standalone output on Node 24) | Waits for `db`; on start runs `prisma migrate deploy`, ensures the owner, then serves on `127.0.0.1:3000` (`WEB_PORT`); volume `media` at `MEDIA_DIR` (`/app/media`) keeps uploaded images |

`docker compose up --build` from a fresh clone with `.env` copied from
`.env.example` runs the complete blog. There is no seed content; the owner
account comes from `.env`. Development uses `npm run dev` against the Compose
`db` service.

## Deferred decisions

| Decision | Needed by | Current default |
| --- | --- | --- |
| Search index | M3 | `ILIKE` without an index; add `pg_trgm` only if measured latency requires it |
| Interface translation library and language switch | M5 | English interface text; candidate next-intl ([0004](../decisions/0004-language-prefixed-urls-and-translation-groups.md)) |
| Whether a language-filtered list shows posts that exist only in the other language | M5 | None (PRD open question) |
| Language of a first visit | M5 | `/` redirects to `SITE_DEFAULT_LANGUAGE` (PRD open question) |
