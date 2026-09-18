# Tasks Page Agent Guide

## Scope

Dashboard tasks page backed by the encrypted vault.

## Do

- Store tasks inside the `tasks` encrypted blob.
- Keep task UI and client-side schema changes in this page library. The `'todos'` → `'tasks'` first-load migrate path is gone ([ADR 0003](../../../../docs/adr/0003-tasks-replaces-todos.md) cleanup, issue #841).

## Do Not

- Do not resurrect plaintext Task REST endpoints or Prisma Task storage.
