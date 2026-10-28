# 0006. Interface text in typed message files

- **Status:** accepted
- **Date:** 2026-10-28

## Context

US-13 requires every public page to offer a Chinese and an English interface,
with the language in the URL and kept while the reader navigates. The
language-prefixed routes, their validation, and the redirect from `/` exist
since M1 ([0004](0004-language-prefixed-urls-and-translation-groups.md)),
which named next-intl as the default candidate for the interface text. The
public interface has a few dozen short strings, two languages, no plural
rules beyond a count in parentheses, and server and client components that
both show text. The admin stays English.

## Decision

- The public interface's text lives in its own module, `src/messages/`: one
  TypeScript object per language (`en.ts`, `zh.ts`). It holds text only and
  depends on nothing, because client components import it; a module that
  also exported server code, such as `lib/` with the Markdown renderer, would
  ship that code to browsers. The English object's shape is the
  `Messages` type, so the compiler refuses a language that lacks a message;
  text with values is a function of them.
- Routes read the locale segment and pass it to the `ui/` components they
  render, which look their text up in `messages[locale]`. Server and client
  components use the same objects; there is no provider or request-scoped
  state.
- A service whose refusals reach a public page gives each one a reason key
  with a message in the message files (the `comments` service's
  `CommentRefused`), so the page says it in the reader's language; the API and
  the admin keep the English message.
- The language switch in the public header links each language to the
  equivalent page — home, a tag page, or a search with its words — and
  otherwise to that language's home page.

## Consequences

- No new dependency, middleware, or configuration; the routing of 0004 stays
  as it is.
- Adding a language means adding a message file and the language to the
  contract, and the compiler lists every message still missing.
- Plural forms, dates, and numbers are formatted by hand in the message
  functions; if the interface ever needs locale-aware plurals or many more
  languages, a library becomes worth its cost.

## Alternatives considered

- next-intl — a mature library, but its routing duplicates what 0004 already
  built, and it adds a request configuration file, a plugin in
  `next.config.ts`, and a client provider for two languages and a few dozen
  strings.
- One JSON file per language — the same lookup without the compiler checking
  that both languages have every message or the values a message takes.
