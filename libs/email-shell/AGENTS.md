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
- `logo-email.svg` is the editable source; `src/assets/logo-email.png` is generated from it.
  Mail clients cannot render SVG, so the raster is committed as well — but regenerate it,
  never hand-edit it.
- After changing the SVG, run `yarn nx run email-shell:build-logo` and commit both files.
  The script rasterizes at 420px wide (3x the 140px display width, for retina) and derives the
  height from the SVG's own viewBox, so a reshaped logo cannot silently distort.
- The rasterizer is Playwright's headless Chromium, already a devDependency for E2E. Do not
  swap it for a native image library: those compile or fetch a platform binary on every install,
  which is what broke the #396 sandbox dispatch at `yarn install --immutable`.

## Do Not

- Do not give the email class a default value or make it optional — that is what stops an
  unsubscribe link from ever reaching Transactional Email.
- Do not add a hosted-URL logo, a CSS `<style>` block the layout depends on, or a
  `prefers-color-scheme` dependency (rejected in ADR 0034).
- Do not hand-edit `src/assets/logo-email.png` — run the `build-logo` target instead.
- Do not add a light/dark logo pair — ADR 0034 calls for one logo whose colours survive forced
  client-side dark-mode inversion.
- Do not wire a consumer into this library from this slice; that is separate follow-on work.
