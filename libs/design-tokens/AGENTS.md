# Design Tokens Agent Guide

## Scope

Single source of truth for colors, spacing, typography, radius, and shadow. Machine values live in `src/tokens.json`; brand rationale lives in `DESIGN.md`; humans consume the Library README.

## Commands

- Regenerate: `yarn nx run design-tokens:build-tokens`.
- Markdown allowlist: `yarn libs:markdown:check`.

## Do

- Edit `src/tokens.json`, regenerate, and commit both `tokens.json` and `src/generated/`.
- Follow the consumer workflow in [README.md](README.md).
- Update [DESIGN.md](DESIGN.md) only when you add, rename, or retire a semantic role, or when brand rules change.

## Do Not

- Do not hand-edit files under `src/generated/`.
- Do not treat `DESIGN.md` as a second palette or copy hex/spacing values into its front matter.
- Do not hard-code token values in components; add the token first.
