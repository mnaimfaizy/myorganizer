# Libraries Agent Guide

## Scope

Shared Nx libraries for API contracts, generated clients, auth, vault logic, UI, route page implementations, and React Native feature code under `libs/mobile/*`.

## Commands

- Test: `yarn nx test <project-name>`.
- Lint: `yarn nx lint <project-name>`.
- Markdown allowlist: `yarn libs:markdown:check`.

## Do

- Keep libraries focused and exported through `src/index.ts` where public APIs are needed.
- Respect path aliases from `tsconfig.base.json`.
- Put route page logic under `libs/web/pages/<route>`.
- Put mobile feature screens, hooks, UI, and platform adapters under `libs/mobile/*`.
- Keep markdown under `libs/` to nested Agent Guides (`AGENTS.md`) and at most one Library README per Nx library, only if it earns its keep. See ADR 0023.

## Do Not

- Do not introduce circular dependencies.
- Do not move generated, app-specific, or sensitive-vault responsibilities into unrelated libraries.
- Do not add feature READMEs, design notes, or Nx scaffold READMEs next to libraries. Promote lasting decisions to `docs/adr/` or `docs/features/`; delete the rest.
