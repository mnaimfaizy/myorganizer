# Email Shell Agent Guide

## Scope

The shared frame every MyOrganizer email renders inside — logo slot, brand colours, typography,
and footer. Renders an HTML string and a plain-text alternative from a caller-supplied body.
See [ADR 0034](../../docs/adr/0034-emails-share-one-shell-and-are-built-to-degrade.md) and the
`## Email` section of `CONTEXT.md`.

## Commands

- Test: `yarn nx test email-shell`.
- Lint: `yarn nx lint email-shell`.

## Do

- Keep the email class (`transactional` | `notification`) a required parameter with no default.
- Escape every interpolated value.
- Resolve colours from `@myorganizer/design-tokens`; never hardcode hex.
- Keep layout table-based with inline CSS, fluid, single-column.

## Do Not

- Do not give the email class a default value or make it optional — that is what stops an
  unsubscribe link from ever reaching Transactional Email.
- Do not add a hosted-URL logo, a CSS `<style>` block the layout depends on, or a
  `prefers-color-scheme` dependency (rejected in ADR 0034).
- Do not wire a consumer into this library from this slice; that is separate follow-on work.
