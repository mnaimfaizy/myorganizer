# Markdown under `apps/` is Agent Guides and Operational READMEs only

Feature write-ups, design notes, component trees, and ticket close-outs next to Next.js routes go stale (nothing links to them, and they drift from the code) and fight the thin-wrapper rule: `apps/myorganizer/src/app/**` is routing and layout, not a docs tree. Decisions, UI rules, and auth behaviour already have homes in `docs/adr/`, `docs/ui/`, and `docs/authentication/`.

## Decision

The only markdown allowed under `apps/` is a nested **Agent Guide** (`AGENTS.md`) colocated with the project it constrains, and at most one **Operational README** per deployable app that people actually run from that folder. Everything else is promoted to `docs/` or deleted.

## Considered Options

- **Colocate feature docs with the route**: rejected; those files become unreferenced and stale, and they train agents to treat the app shell as a documentation tree.
- **Move all app docs into `docs/` including Agent Guides**: rejected; agents already read the nearest `AGENTS.md`, and that nested pattern is used across `libs/` too.
