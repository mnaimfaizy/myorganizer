---
name: backend-api-contract-change
description: 'Use when adding or changing backend REST endpoints, DTOs, validation, Prisma schema, auth responses, OpenAPI output, or generated API client behavior in MyOrganizer.'
---

# Backend API Contract Change

## Use This Skill When

- Adding or changing controllers, request or response DTOs, validation schemas, or service behavior
- Changing auth responses, cookie behavior, refresh flow, or API security boundaries
- Updating Prisma schema, migrations, generated OpenAPI, or generated API client behavior

## Core Rules

- Treat backend controllers and DTOs as the contract source of truth.
- Use TSOA controllers, service classes, and boundary validation with Zod or class-validator style patterns already used in the repo.
- Do not hand-edit generated OpenAPI or API client files as the primary fix.
- Do not edit Prisma migration files manually.

## Workflow

1. Start from the owning controller, DTO, or validation boundary.
2. Implement behavior in the existing controller and service structure rather than adding ad hoc route logic.
3. If the API contract changes, run the sync chain in order:
   - `yarn openapi:sync`
   - `yarn api:generate`
4. If Prisma schema changes, regenerate types and create a migration instead of patching generated outputs.
5. Keep auth cookies, refresh-token flow, CORS credentials, and rate limiting aligned with the authentication and backend docs.
6. Update focused tests and docs when public behavior changes.

## Checkpoints

- If the endpoint or DTO changed but OpenAPI and generated client were not updated, the change is incomplete.
- If you edited generated files directly, replace that with a source change and regeneration.
- If a vault-backed surface now accepts plaintext sensitive data server-side, stop and redesign.

## Validation

- Run the narrowest checks first:
  - `yarn nx test backend`
  - `yarn nx lint backend`
- If the contract changed, verify regenerated outputs are in sync:
  - `yarn openapi:check`

## Key References

- `apps/backend/AGENTS.md`
- `apps/backend/README.md`
- `docs/authentication/README.md`
- `libs/api-specs/AGENTS.md`
- `libs/app-api-client/AGENTS.md`
- `package.json`
