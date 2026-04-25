# Libraries Agent Guide

## Scope

Shared Nx libraries for API contracts, generated clients, auth, vault logic, UI, and route page implementations.

## Commands

- Test: `yarn nx test <project-name>`.
- Lint: `yarn nx lint <project-name>`.

## Do

- Keep libraries focused and exported through `src/index.ts` where public APIs are needed.
- Respect path aliases from `tsconfig.base.json`.
- Put route page logic under `libs/web/pages/<route>`.

## Do Not

- Do not introduce circular dependencies.
- Do not move generated, app-specific, or sensitive-vault responsibilities into unrelated libraries.
