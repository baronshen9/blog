---
status: approved     # draft | approved
approved: 2026-10-25 # YYYY-MM-DD, set at gate G1
---

# Blog — Product Requirements

## Problem

A single author wants a personal blog they own, where they can write in the
browser like Ghost or WordPress, and also hand content drafted in an AI coding
assistant (Claude Code or Codex) straight to the blog without copying and
pasting. Existing self-hosted options do not fit: Ghost's built-in comments
require reader sign-up, its multilingual guidance is one installation per
language, and it has no first-party MCP server. The author writes in both
Chinese and English and wants readers to switch between the two.

## Users

| User | Goal | Current alternative |
| --- | --- | --- |
| Owner (single author) | Write, publish, and manage posts from a web admin or from an AI assistant conversation | Copy AI output into a hosted blog editor by hand |
| Reader | Read posts, find them by tag or keyword, comment without an account, read in Chinese or English | Hosted blogs that require sign-up to comment |

## Success

- The owner publishes a post from a Claude Code or Codex conversation without
  opening the web admin, and it appears on the public site.
- A fresh clone runs the complete blog locally with one Docker Compose command.
- No reader comment is publicly visible before the owner approves it.
- A reader can switch any page between Chinese and English, and move between
  the two language versions of a post.

## Scope

**In scope**

- Web admin for the owner: sign-in, Markdown writing, drafts, publish and
  unpublish, trash.
- Local MCP server with full post management for Claude Code and Codex on the
  owner's machine.
- Tags, site search that works for Chinese and English, image upload.
- Anonymous reader comments with pre-moderation.
- Bilingual interface and linked Chinese and English versions of a post.
- Local operation in Docker.

**Non-goals**

- Public deployment. It will be added later as a separate milestone through a
  PRD amendment.
- Multiple authors or roles; the blog has exactly one owner.
- Reader accounts, memberships, newsletters, or payments.
- A visual (WYSIWYG) editor; Markdown is the only authoring format.
- Analytics and traffic statistics.
- A remote MCP endpoint for web or mobile AI clients; MCP is local only.
- RSS or Atom feeds.
- Theme customization beyond the shipped design.
- Machine translation inside the blog; translations are written by the owner or
  their AI assistant.

## User stories

### US-1 Owner sign-in

As the owner, I want the admin to be private so that only I can change the blog.

Acceptance criteria:

- Visiting any admin page while signed out leads to a sign-in page.
- Signing in with the owner's credentials opens the admin; wrong credentials
  show an error and do not reveal which part was wrong.
- The owner account is set up at installation; there is no public sign-up page.
- Signing out returns to the sign-in page, and admin pages are no longer
  reachable without signing in again.

### US-2 Draft a post

As the owner, I want to write a post in Markdown and save it as a draft so that
I can finish it later.

Acceptance criteria:

- The owner can create a post with a title and a Markdown body and save it.
- A preview shows the rendered body, including headings, lists, links, and
  highlighted code blocks.
- Saved drafts appear in the admin post list marked as drafts and can be
  reopened and edited.
- Drafts are not visible on the public site, including by direct URL.
- Saving a post without a title is rejected with a clear message.

### US-3 Publish and unpublish

As the owner, I want to publish and unpublish posts so that I control what
readers see.

Acceptance criteria:

- Publishing a draft makes it visible on the public site with a stable URL and
  a publication date.
- Edits to a published post appear on the public site after saving.
- Unpublishing returns the post to draft; its public URL then shows a
  not-found page.

### US-4 Read published posts

As a reader, I want to browse and read published posts so that I can follow the
blog.

Acceptance criteria:

- The home page lists published posts, newest first, with title, date, and an
  excerpt, and pages through long lists.
- Opening a post shows its title, date, and rendered Markdown body with
  highlighted code.
- An unknown or unpublished post URL shows a not-found page.
- Pages are readable on a phone-width screen.

### US-5 API tokens

As the owner, I want to create and revoke API tokens so that AI assistants can
act on the blog without my password.

Acceptance criteria:

- The owner can create a named token in the admin; its secret is shown once.
- The admin lists tokens by name with creation and last-used time, never the
  secret.
- A revoked token is refused immediately.
- Requests without a valid token cannot change any content.

### US-6 Manage posts via MCP

As the owner, I want to manage posts from a Claude Code or Codex conversation
so that I can publish AI-assisted writing without leaving it.

Acceptance criteria:

- After following the setup instructions, the blog's MCP tools appear in
  Claude Code and in Codex on the owner's machine.
- Through MCP the owner can list posts (filtered by status), read a post,
  create a draft, edit it, publish, unpublish, and delete.
- A post created through MCP looks the same in the admin and on the public
  site as one written in the admin.
- MCP errors (invalid token, unknown post, missing title) are reported back to
  the conversation in plain language.

### US-7 Trash and restore

As the owner, I want deleted posts to go to a trash so that a mistaken
deletion, including one made through MCP, can be undone.

Acceptance criteria:

- Deleting a post from the admin or through MCP moves it to the trash and
  removes it from the public site.
- The owner can restore a trashed post from the admin; it returns as a draft.
- Only the owner, in the admin, can permanently delete a trashed post.

### US-8 Tags

As a reader, I want to browse posts by tag so that I can find related writing.

Acceptance criteria:

- The owner can assign tags to a post in the admin and through MCP.
- Published posts show their tags; each tag links to a page listing the
  published posts with that tag.
- Tags with no published posts are not shown to readers.

### US-9 Search

As a reader, I want to search posts by keyword so that I can find a specific
topic.

Acceptance criteria:

- Searching a word that appears in a published post's title or body returns
  that post, for both Chinese and English text.
- Drafts and trashed posts never appear in results.
- A search with no matches says so.

### US-10 Images

As the owner, I want to upload images and use them in posts so that posts can
include figures and screenshots.

Acceptance criteria:

- The owner can upload an image in the admin and insert it into the Markdown
  body.
- An image can also be uploaded through MCP and referenced in a post.
- Uploaded images display on the public post page.
- Files that are not images, or that exceed the size limit, are rejected with
  a clear message.

### US-11 Submit a comment

As a reader, I want to comment on a post without creating an account so that I
can respond to the author.

Acceptance criteria:

- A published post shows a comment form with a nickname and a message.
- After submitting, the reader is told the comment awaits moderation; it is not
  shown publicly yet.
- Empty or overlong submissions are rejected with a clear message.
- Automated spam submissions are rejected by basic protections, such as a
  hidden field and a per-visitor rate limit.

### US-12 Moderate comments

As the owner, I want to approve or reject comments so that only appropriate
comments are public.

Acceptance criteria:

- The admin shows pending comments with their post, nickname, message, and
  time, and indicates how many are pending.
- Approving a comment shows it under its post, oldest first; rejecting it
  removes it from the queue and it is never shown.
- The owner can remove a previously approved comment.

### US-13 Interface language

As a reader, I want to switch the site between Chinese and English so that I
can read in my language.

Acceptance criteria:

- Every public page offers a language switch; the choice changes all interface
  text, and the page URL shows the language.
- The selected language persists while the reader navigates the site, with
  one exception: a post that exists only in the other language opens at its
  own URL, and the interface follows its language.
- A first visit to `/` opens the site's default language
  (`SITE_DEFAULT_LANGUAGE`).

### US-14 Linked translations

As the owner, I want a post to have Chinese and English versions linked
together so that readers can move between them.

Acceptance criteria:

- The owner can add a translation of an existing post in the admin and through
  MCP; each version is drafted and published independently.
- A post page with a published translation links to the other version.
- Post lists, tag pages, and search show each translation group once: its
  version in the selected interface language when that is published,
  otherwise its published version in the other language, with its language
  label.

### US-15 Visual design

As a reader and as the owner, I want the site and the admin to look
consistent and polished so that reading and writing are pleasant on any
screen.

Acceptance criteria:

- Public pages and the admin follow the approved visual direction
  ([light](../design/visual/direction-b-light.png),
  [dark](../design/visual/direction-b-dark.png)): a header with the site name;
  the home page lists posts as cards with date, language label, and excerpt;
  the post page shows the body in a card with readable typography and dark,
  syntax-highlighted code blocks; the admin has a dark top bar, a styled sign-in
  page and post list, and an editor with Markdown and preview side by side.
- The color scheme follows the system setting: light and dark are both
  complete, and body text meets WCAG AA contrast in both.
- Pages work from phone width (360 px) to desktop without horizontal scrolling,
  except inside code blocks and tables.
- The site name is configurable and defaults to "Field Notes".
- Only system fonts are used; no font or style sheet is loaded from another
  host.
- The language switch shown in the mockups arrives with US-13 in M5.

## Milestones

| Milestone | Value delivered | Stories |
| --- | --- | --- |
| M1 Write and read | The owner writes, drafts, and publishes Markdown posts in the admin; readers browse and read them; the blog runs in Docker | US-1, US-2, US-3, US-4, US-15 |
| M2 Manage from AI | The owner manages posts from Claude Code or Codex through MCP, with tokens and a recoverable trash | US-5, US-6, US-7 |
| M3 Organize and find | Readers browse by tag and search in Chinese and English; posts include uploaded images | US-8, US-9, US-10 |
| M4 Reader comments | Readers comment without an account; the owner moderates before anything is public | US-11, US-12 |
| M5 Bilingual | Readers switch the site between Chinese and English and move between linked post versions | US-13, US-14 |

## Constraints and assumptions

- The blog runs locally on macOS with Docker until a deployment milestone is
  approved. The design must allow later deployment to a single virtual server
  without managed cloud services.
- The MCP server runs on the owner's machine and is used only by local Claude
  Code and Codex.
- Secrets (owner credentials, API tokens) are never committed to the
  repository.
- Assumption: posts exist in Chinese, English, or both; no other languages are
  needed.
- Assumption: comment volume is low enough for manual moderation by one person.

## Open questions

- Should a language-filtered list also show posts that exist only in the other
  language, and which language is the default for a first visit? — answered at
  M5 planning: lists show them with their language label (US-14), and `/`
  opens `SITE_DEFAULT_LANGUAGE` (US-13).
- Should the owner be notified of new pending comments outside the admin? —
  deferred to M4 planning; no notification is in scope.

## Change log

| Date | Change | Reason | Issue |
| --- | --- | --- | --- |
| 2026-10-27 | Added US-15 (visual design) to M1 | M1 acceptance found the front end unstyled; no requirement covered how the blog looks | #17 |
| 2026-10-28 | Answered the open question on language filtering and the first visit; US-13 and US-14 state the answers and the one exception to the persisting language | Decided by the user at M5 planning | #84 |
