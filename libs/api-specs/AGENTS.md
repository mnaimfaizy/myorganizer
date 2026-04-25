# API Specs Agent Guide

## Scope

OpenAPI specs synced from the backend TSOA output.

## Commands

- Sync: `yarn openapi:sync`.
- Check drift: `yarn openapi:check`.

## Do

- Treat backend controllers/DTOs as the contract source.
- Keep this library in sync when APIs change.

## Do Not

- Do not hand-edit generated spec snapshots as the primary fix.
- Do not update specs without regenerating the API client when needed.
