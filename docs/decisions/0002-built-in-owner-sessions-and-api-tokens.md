# 0002. Built-in owner sessions and API tokens

- **Status:** accepted
- **Date:** 2026-10-26

## Context

Exactly one owner signs in to the admin with a username and password created at
installation; there is no sign-up, no reader account, and no third-party login.
AI assistants act on the blog with named, revocable tokens (US-5). The two
mechanisms must never be confused: a token must not open the admin, and a
browser session must not authorize the API.

## Decision

Implement both in `src/server/auth` and `src/server/tokens` without an
authentication library:

- The owner password is stored as an argon2id hash. Signing in creates a
  `Session` row holding the SHA-256 hash of a random 256-bit token; the token
  travels in an httpOnly, SameSite=Lax cookie (Secure over HTTPS).
- API tokens are random 256-bit secrets shown once; only their SHA-256 hash is
  stored. The API accepts only `Authorization: Bearer` and refuses revoked
  tokens on the next request.
- Every Server Action and API route handler checks access itself; middleware
  only redirects signed-out admin requests.

## Consequences

- About a hundred lines of security-sensitive code that the project owns; it
  needs focused integration tests (wrong credentials, expiry, sign-out,
  revocation).
- No schema or upgrade coupling to an authentication library.
- Adding readers, roles, or OAuth later would need a new decision.

## Alternatives considered

- Auth.js — the credentials provider is discouraged and pushes toward
  JWT sessions; most of its value is OAuth, which is out of scope.
- Better Auth — capable, but brings its own tables and features (sign-up,
  accounts, plugins) that this single-owner product must then disable.
- Reusing the session cookie for the API — simpler, but makes the API subject
  to CSRF and ties AI assistants to the owner's password.
