# Todos Page Agent Guide

## Scope

Dashboard todos page backed by the encrypted vault.

## Do

- Store todos inside the `todos` encrypted blob.
- Keep todo UI and client-side schema changes in this page library.

## Do Not

- Do not resurrect plaintext Todo REST endpoints or Prisma Todo storage.
