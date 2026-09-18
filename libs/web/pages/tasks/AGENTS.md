# Tasks Page Agent Guide

## Scope

Dashboard tasks page backed by the encrypted vault.

## Do

- Store tasks inside the `tasks` encrypted blob.
- Keep the first-load `'todos'` → `'tasks'` vault blob migration until [ADR 0003](../../../../docs/adr/0003-tasks-replaces-todos.md)'s unmigrated-todos query is zero and a warning release has shipped. Do not remove that path in this library alone.
- Keep task UI and client-side schema changes in this page library.

## Do Not

- Do not resurrect plaintext Task REST endpoints or Prisma Task storage.
