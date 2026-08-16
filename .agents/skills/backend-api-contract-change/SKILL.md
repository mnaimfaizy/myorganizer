---
name: backend-api-contract-change
description: 'Use when adding or changing backend REST endpoints, DTOs, validation, Prisma schema, auth responses, OpenAPI output, or generated API client behavior in MyOrganizer. Orchestrates PrismaWriter → ApiWriter → ApiSync as One-shot Specialists (ADR 0015).'
---

# Backend API Contract Change

Policy: [`docs/adr/0015-one-shot-api-contract-specialists.md`](../../../docs/adr/0015-one-shot-api-contract-specialists.md). Classify `gate:*` first (ADR 0012).

This skill is the **orchestrator**. It does not write controllers or schema itself. Specialists do the work, return a report, and stop. You apply an Orchestrator Patch or you stop. There is no retry loop.

## Use This Skill When

- Adding or changing controllers, request or response DTOs, validation schemas, or service behavior
- Updating Prisma schema or migrations that the public HTTP surface depends on
- Regenerating OpenAPI or the generated API client after a contract change

Do **not** use this skill as the writer for cookie/refresh/session behavior (`auth-session-workflow`) or vault plaintext rules (`vault-feature-workflow`). Those are stop conditions.

## Core Rules

- Treat backend controllers and DTOs as the contract source of truth.
- Prisma schema files are the persistence source of truth. PrismaWriter reads `.agents/skills/prisma-migration-workflow` — do not copy that runbook here.
- Do not hand-edit generated OpenAPI, API client, or Prisma client files.
- Do not edit Prisma migration files manually.
- Do not send a One-shot Specialist's output back for another round.
- Only Independent Hops may run in parallel. PrismaWriter, ApiWriter, and ApiSync share artifacts on the same change — they stay sequential. You judge independence; specialists do not schedule themselves.

## Gate tier routing

| Gate                          | Path                                                                                                                                                |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gate:mechanical`             | Rename, import, or comment only → you may edit + focused lint. No specialist hop.                                                                   |
| `gate:standard` / `gate:full` | Persistence and/or HTTP contract behavior → hops below. API Contract is `gate:full` in risk; the execution shape is one-shot, not a Gated Pipeline. |

## Workflow

1. Classify whether persistence changed and whether the public HTTP surface changed.
2. **Persistence changed** → delegate **PrismaWriter** with a Persistence Brief (schema files, change, migration name, vault). Skip this hop if the schema did not change.
3. Read the report and the diff. **Orchestrator Patch** for a local miss (wrong field type, skipped `generate-types`). **Stop** if the specialist missed the assignment, hand-edited a migration, or added plaintext for vault-backed data. Do not re-delegate.
4. **HTTP surface changed** → delegate **ApiWriter** with an API Contract Brief (capability, paths, request/response, persistence status). Skip this hop if only persistence changed and no public contract moved.
5. Read the report and the diff. Orchestrator Patch or stop. Do not re-delegate.
6. **Public contract changed** → delegate **ApiSync** to regenerate (`yarn api-docs:generate` → `yarn openapi:sync` → `yarn api:generate`). Skip if the contract did not change.
7. Read the ApiSync report. Orchestrator Patch or stop.
8. **Leave this skill.** If tests are needed, use `.agents/skills/unit-test-delegation-workflow/SKILL.md` (Gated Pipeline). Do not pull TestScaffold into this chain.

### Briefs (keep them short)

PrismaWriter:

```
## Persistence Brief
### Action
create | edit
### Schema files
- apps/backend/src/prisma/schema/<file>
### Change
<what changed>
### Migration name
<kebab-case>
### Vault
ciphertext-only | not vault-backed
```

ApiWriter:

```
## API Contract Brief
### Capability
<one sentence>
### Action
create | edit
### Paths
- Controller: ...
- Types/DTOs: ...
- Service: ...
### Request / response
<shapes and status codes>
### Persistence
none | already applied by PrismaWriter
```

## Checkpoints

- If the endpoint or DTO changed but OpenAPI and generated client were not updated, the change is incomplete — run ApiSync.
- If you edited generated files directly, replace that with a source change and regeneration.
- If a vault-backed surface now accepts plaintext sensitive data server-side, stop and redesign.
- If you wrote the controller or schema yourself on `standard`/`full`, you skipped the specialists. Stop and delegate.

## Validation

After the hops (you run these, not the specialists in a loop):

- `yarn nx lint backend`
- `yarn openapi:check` when the contract changed

Do not run the Jest Gated Pipeline inside this skill.

## Key References

- `docs/adr/0015-one-shot-api-contract-specialists.md`
- `apps/backend/AGENTS.md`
- `.agents/skills/prisma-migration-workflow/SKILL.md` (runbook PrismaWriter reads)
- `.github/agents/prisma-writer.agent.md`
- `.github/agents/api-writer.agent.md`
- `.github/agents/api-sync.agent.md`
- `docs/authentication/README.md`
- `libs/api-specs/AGENTS.md`
- `libs/app-api-client/AGENTS.md`
