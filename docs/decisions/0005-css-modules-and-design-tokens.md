# 0005. CSS Modules with global design tokens

- **Status:** accepted
- **Date:** 2026-10-27

## Context

M1 shipped without a visual design. US-15 now requires a consistent look that
follows visual direction B, light and dark color schemes that follow the
system, phone and desktop widths, and system fonts only. Several agents will
build screens independently, so the styling approach must make the consistent
choice the easy one and keep styles next to the components that use them.

## Decision

- Global design tokens in `src/ui/tokens.css`: CSS custom properties for color,
  spacing, radius, fonts, and font sizes, with a dark set under
  `@media (prefers-color-scheme: dark)`.
- Component styles in CSS Modules (`*.module.css`) next to their components in
  `src/ui/`, using tokens only. Route files compose `ui/` components and carry
  no styles of their own beyond layout glue.
- No CSS framework, CSS-in-JS library, or web font.

## Consequences

- No new dependency and no runtime cost; Next.js builds CSS Modules natively.
- Dark mode is a second set of token values, not a second set of styles.
- Consistency depends on using tokens; review rejects raw color values and
  inline styles.
- Utility classes for one-off spacing are not available; small layout needs go
  into the component's module.

## Alternatives considered

- **Tailwind CSS v4:** fast to write and widely known by coding agents, but
  adds a build dependency and spreads styling decisions across markup, which
  makes the shared look harder to review.
- **Plain global CSS:** simplest, but class names collide as screens grow and
  styles drift away from their components.
