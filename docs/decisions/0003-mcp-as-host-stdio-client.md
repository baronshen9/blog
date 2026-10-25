# 0003. MCP server as a host-side stdio client of the HTTP API

- **Status:** accepted
- **Date:** 2026-10-26

## Context

The owner manages posts from Claude Code and Codex on the same machine (US-6).
Posts created through MCP must behave exactly like posts created in the admin,
deletions through MCP must be recoverable (US-7), and MCP must be able to
upload an image from a local file path (US-10). Remote MCP is a non-goal.

## Decision

Ship the MCP server in `src/mcp/` as a stdio process that the assistant starts
on the host with `node src/mcp/server.ts`. It holds no business logic and no
database access: each tool validates its arguments with the `contract` schemas
and calls `app/api/v1/` over HTTP at `BLOG_URL` with `BLOG_API_TOKEN`. Both
variables live in the assistant's MCP configuration on the owner's machine.
The API exposes no permanent deletion.

## Consequences

- One implementation of content rules; MCP and admin results cannot diverge.
- The MCP server can read local files for image upload and needs only Node and
  the repository's installed dependencies on the host.
- The blog must be running for MCP tools to work; the tools report a plain
  connection error otherwise.
- The HTTP API is a versioned contract (`/api/v1`); breaking changes need a
  new version or a coordinated MCP change in the same pull request.

## Alternatives considered

- MCP server inside the Docker stack — cannot read host files for image upload
  without extra mounts.
- MCP server talking to Postgres directly — duplicates or bypasses the domain
  rules and would need database credentials on the host.
- Remote MCP over HTTP — out of scope in the PRD.
