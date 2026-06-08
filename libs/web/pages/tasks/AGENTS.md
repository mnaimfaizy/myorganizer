# Tasks Page Agent Guide

## Scope

Dashboard tasks page backed by the encrypted vault.

## Do

- Store tasks inside the `tasks` encrypted blob.
- Auto-migrate from `todos` blob on first load if `tasks` blob is absent.
- Keep task UI and client-side schema changes in this page library.

## Do Not

- Do not resurrect plaintext Task REST endpoints or Prisma Task storage.
