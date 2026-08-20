# Email Shell Agent Guide

## Scope

The shared frame every MyOrganizer email renders inside — logo slot, brand colours, typography,
and footer. Renders an HTML string, a plain-text alternative, and the inline attachments that
body references, from a caller-supplied body. All three MyOrganizer emails go through it:
verification and password reset as Transactional Email, the Weekly Digest as Notification Email.
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
- Keep the CID linkage invariant here. The shell returns `attachments` alongside `html`, and
  `assertCidLinkage` runs on every render so a message can never ship an attachment its body does
  not reference, or reference a Content-ID it does not attach. The mail sender is a pass-through
  and cannot own this — it never sees how a body was built.
- Size media rows in percentages. `EmailMediaItem` deliberately has no width field: fixed pixel
  widths inside an unconstrained cell are what made the Weekly Digest scroll horizontally on a
  phone.
- `logo-email.svg` is the editable source; `src/assets/logo-email.png` is generated from it.
  Mail clients cannot render SVG, so the raster is committed as well — but regenerate it,
  never hand-edit it.
- After changing the SVG, run `yarn nx run email-shell:build-logo` and commit all three files —
  the SVG, the PNG, and `src/generated/logoEmailPng.ts`. The script rasterizes at 420px wide
  (3x the 140px display width, for retina) and derives the height from the SVG's own viewBox, so
  a reshaped logo cannot silently distort.
- `src/generated/logoEmailPng.ts` is the base64 the shell actually attaches. The bytes are
  compiled in rather than read off disk so rendering stays a pure function: an asset path that
  differs between the TypeScript sources and the webpack bundle is the dist-versus-dev candidate
  lookup that used to guard the auth templates, and it is gone.
- The rasterizer is Playwright's headless Chromium, already a devDependency for E2E. Do not
  swap it for a native image library: those compile or fetch a platform binary on every install,
  which is what broke the #396 sandbox dispatch at `yarn install --immutable`.

## Do Not

- Do not give the email class a default value or make it optional — that is what stops an
  unsubscribe link from ever reaching Transactional Email.
- Do not add a hosted-URL logo, a CSS `<style>` block the layout depends on, or a
  `prefers-color-scheme` dependency (rejected in ADR 0034).
- Do not hand-edit `src/assets/logo-email.png` or `src/generated/logoEmailPng.ts` — run the
  `build-logo` target instead.
- Do not add a width, height, or pixel dimension to `EmailMediaItem`. A caller that needs one is
  asking to reintroduce the horizontal-scroll bug.
- Do not add a light/dark logo pair — ADR 0034 calls for one logo whose colours survive forced
  client-side dark-mode inversion.
- Do not let the mail sender re-derive the CID linkage. It forwards what the shell hands it; the
  guarantee is made once, here, at render time.
