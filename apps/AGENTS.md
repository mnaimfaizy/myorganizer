# Apps Agent Guide

## Scope

Application projects live here: backend API, Next.js frontend shell, React Native mobile client, and Playwright e2e tests.

## Do

- Use each app's project-specific Nx targets.
- Keep shared logic in `libs/**`.
- Read the nearest app AGENTS.md before changing files.
- Keep markdown under `apps/` to nested Agent Guides (`AGENTS.md`) and at most one Operational README per deployable app. See ADR 0022.

## Do Not

- Do not duplicate reusable code across apps.
- Do not bypass app-specific security, routing, or testing notes.
- Do not add feature READMEs, design notes, component breakdowns, or implementation summaries next to app routes. Promote lasting decisions to `docs/adr/` or `docs/`; delete the rest.
