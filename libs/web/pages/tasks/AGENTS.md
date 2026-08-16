# Tasks Page Agent Guide

## Scope

Dashboard tasks page backed by the encrypted vault.

## Do

- Store tasks inside the `tasks` encrypted blob.
- Keep the first-load vault blob migration from ADR 0003.
- Keep task UI and client-side schema changes in this page library.

## Do Not

- Do not resurrect plaintext Task REST endpoints or Prisma Task storage.
