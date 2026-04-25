# App API Client Agent Guide

## Scope

Generated TypeScript API client consumed by frontend libraries.

## Commands

- Generate: `yarn api:generate`.
- Full API sync: `yarn openapi:sync`.

## Do

- Prefer consuming this client over manual frontend HTTP calls.
- Derive narrow local UI types when generated aliases are unstable.

## Do Not

- Do not hand-edit generated client files.
- Do not couple UI code to brittle generated names when a minimal local type is enough.
