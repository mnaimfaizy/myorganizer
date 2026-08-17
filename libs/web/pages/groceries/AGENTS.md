# Groceries Page Agent Guide

## Scope

Dashboard groceries page backed by the encrypted vault (trip board, staples catalog, list detail).

## Do

- Store grocery trips, catalog items, and list lines inside the `groceries` encrypted blob.
- Keep validation and display logic in this page library.
- Feature behaviour for humans lives in `docs/features/groceries.md`.

## Do Not

- Do not add plaintext grocery endpoints or server-side search over sensitive fields.
