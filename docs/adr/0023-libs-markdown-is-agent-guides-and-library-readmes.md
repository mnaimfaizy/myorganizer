# Markdown under `libs/` is Agent Guides and Library READMEs only

Feature write-ups next to page libraries go stale the same way route docs under `apps/` did (ADR 0022): nothing links to them, they drift from the code, and they train agents to treat a library folder as a docs tree. Decisions and feature behaviour already have homes in `docs/adr/` and `docs/features/`.

## Decision

The only markdown allowed under `libs/` is a nested **Agent Guide** (`AGENTS.md`) colocated with the project it constrains, and at most one **Library README** per Nx library — and only when that README earns its keep as a human package guide (today: `libs/design-tokens/README.md`). No feature READMEs next to `libs/web/pages/<route>/`. Unique page constraints live in that page's Agent Guide; user/dev feature write-ups stay in `docs/features/`.

`libs/design-tokens/DESIGN.md` is brand rationale (when to use a semantic role), not a second token palette. Hex, spacing, and type values live only in `tokens.json`. Update `DESIGN.md` when a role or brand rule changes, not when a value moves.

`yarn libs:markdown:check` enforces the filename allowlist.

## Considered Options

- **Broaden Operational README to cover libraries**: rejected; "operational" means a runbook for a deployable app.
- **Agent Guides only, zero READMEs under `libs/`**: rejected; the design-tokens consumer guide is used by humans and is linked from the root README.
- **Keep Library READMEs on generated-API packages (`api-specs`, `app-api-client`)**: rejected; those Agent Guides already say do not hand-edit and to run `yarn openapi:sync`.
- **Require an Agent Guide on every page or mobile library**: rejected; empty stubs recreate the dashboard README problem. Nested guides exist only when they add constraints the parent does not.

## Consequences

- The pre-tool-use hook protects generated sources (`libs/app-api-client/src`, `libs/api-specs/src`), not Agent Guides or other markdown next to those packages.
