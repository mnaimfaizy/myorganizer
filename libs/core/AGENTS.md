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
- Do not introduce circular dependencies between libraries.
