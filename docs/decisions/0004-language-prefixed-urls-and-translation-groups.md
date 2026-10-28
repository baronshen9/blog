# 0004. Language-prefixed URLs and translation groups from the start

- **Status:** accepted
- **Date:** 2026-10-26

## Context

M5 adds a Chinese and English interface whose language shows in the URL
(US-13) and links between language versions of a post (US-14). M1 already
promises stable post URLs (US-3). Introducing the language prefix or the
translation link later would change published URLs and require a data
migration of every post.

## Decision

- From M1, public routes live under `/<locale>/` with `zh` and `en`, and post
  URLs are `/<locale>/posts/<slug>`. `/` redirects to `SITE_DEFAULT_LANGUAGE`.
- Every post has a `language` and a `translationGroupId`. A new post starts a
  new group; a translation joins its source post's group. At most one post per
  language exists in a group, and slugs are unique per language.
- The interface translation library and the language switch are chosen in M5
  (default candidate: next-intl). Until then the locale segment is validated
  and the interface text is English. M5 chose typed message files instead
  ([0006](0006-typed-interface-messages.md)).

## Consequences

- Post URLs do not change when M5 lands; M5 adds translation, not migration.
- Each language version has its own slug, status, and publication date, so
  versions are drafted and published independently.
- M1 must handle the locale segment even though only one interface language
  exists.
- Which posts a language-filtered list shows, and the default language of a
  first visit, stay open until M5 planning as the PRD defers them.

## Alternatives considered

- Unprefixed URLs until M5 — simpler in M1, but every published URL would
  change or need redirects later.
- One post row holding both languages — couples the two versions' drafting and
  publishing, which US-14 requires to be independent.
- Language chosen by cookie or `Accept-Language` without a URL prefix — US-13
  requires the language in the URL.
