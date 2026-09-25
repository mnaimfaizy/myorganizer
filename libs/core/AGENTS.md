# Core Library Agent Guide

## Scope

Shared TypeScript utilities, types, and cross-cutting code with no app-specific ownership.

## Commands

- Test: `yarn nx test core`.
- Lint: `yarn nx lint core`.

## Do

- Keep exports small, typed, and broadly reusable.
- Avoid dependencies on browser, React, Next.js, Express, or Prisma unless already established.

## Do Not

- Do not place feature-specific frontend or backend behavior here.
- Do not add Vault concepts here — record shapes, envelopes, Tombstones, merges,
  or crypto. They belong in `libs/vault-core`, which mobile and the backend
  reach and this library does not. `core` depends on `vault-core/portable` (for
  `CurrencyCode`), never the reverse: `core` carries browser globals that the
  Portable Entry Point must not reach.
- Do not introduce circular dependencies between libraries.
