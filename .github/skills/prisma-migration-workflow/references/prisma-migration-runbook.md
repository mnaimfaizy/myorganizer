# Prisma Migration Runbook

## Source Of Truth

- Schema files under `apps/backend/src/prisma/schema` are the database source of truth.
- Migrations and Prisma client output are generated artifacts, not the place to hand-apply the primary fix.

## Change Workflow

1. Start from the owning schema file under `apps/backend/src/prisma/schema`.
2. Regenerate Prisma client types after schema edits:
   - `yarn nx run backend:generate-types`
3. Create the migration from the schema change:
   - `yarn nx run backend:migrate`
4. If DTOs or public API shapes changed as a result, regenerate contract outputs:
   - `yarn openapi:sync`
   - `yarn api:generate`
   - `yarn openapi:check`
5. For deployment-oriented docs or procedures, use Prisma deploy semantics instead of dev migration commands.

## Checkpoints

- If only generated Prisma output changed without a schema change, the fix is in the wrong place.
- If a migration was hand-edited, replace that with a schema-first change.
- If a vault-backed feature now stores plaintext in the database, stop and redesign.
- Do not add or resurrect a plaintext Todo model or table for vault-backed todos.

## Validation

- `yarn nx run backend:generate-types`
- `yarn nx test backend`
- `yarn nx lint backend`

## Repo References

- `apps/backend/AGENTS.md`
- `apps/backend/README.md`
- `apps/backend/project.json`
- `.github/copilot-instructions.md`
- `package.json`
