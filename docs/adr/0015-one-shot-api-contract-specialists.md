# API Contract work uses One-shot Specialists, not a Gated Pipeline

The main agent's context window is the scarce resource. If the orchestrator writes Prisma schema, TSOA controllers, and OpenAPI sync itself, it burns that window and starts inventing. We offload those jobs to One-shot Specialists that return a report and stop. The orchestrator applies an Orchestrator Patch for a local miss, or stops if the specialist missed the assignment. There is no writer–reviewer retry loop.

This is a different shape from components and Jest (Gated Pipelines, ADR 0004 / ADR 0014). API Contract remains `gate:full` in risk (ADR 0012); the execution shape is one-shot, not a third copy of Builder → Reviewer.

## Status

accepted

## Decision

- **PrismaWriter** owns persistence (schema, generated types, migration). Skipped when the contract needs no schema change.
- **ApiWriter** owns the API Contract (controller, DTOs/validation, the service method the controller calls).
- **ApiSync** owns generated OpenAPI and the API client. Already exists; skipped when the contract did not change.
- Then **leave**. Jest stays the existing Gated Pipeline. Auth and vault stay stop conditions, not writer agents.
- **`backend-api-contract-change`** is the orchestrator skill. **`prisma-migration-workflow`** stays the runbook PrismaWriter reads. No new skill name, no backend GUIDELINES book, no hygiene script, no reviewer agent, no PageWriter.
- Only **Independent Hops** may run in parallel. PrismaWriter, ApiWriter, and ApiSync are sequential when they run on the same change. The orchestrator judges independence; specialists do not schedule themselves.

## Considered Options

- **Clone ComponentBuilder → ComponentReviewer** — rejected: that is a Gated Pipeline. The goal here is to protect orchestrator context, not to add retry rounds.
- **One backend mega-agent (schema + controller + OpenAPI)** — rejected: it re-teaches every convention and will "improve" the schema on a DTO-only change.
- **Fold Prisma into ApiWriter** — rejected: many contract changes do not touch persistence; the runbook is already schema-first and separate.
- **New skill name (`backend-api-workflow`)** — rejected: `backend-api-contract-change` already owns this surface.
- **PageWriter in the first cut** — rejected: page libraries are frontend; mixing them here inflates the skill.
- **Parallel by default** — rejected: these hops share artifacts. Fan-out only when the orchestrator can name that neither hop needs the other's output.

## Consequences

- Add `PrismaWriter` and `ApiWriter` agent definitions; keep `ApiSync` as-is.
- Thicken `.agents/skills/backend-api-contract-change` with the hop list, Orchestrator Patch / stop rule, and Independent Hop rule. Do not duplicate the Prisma runbook.
- `.claude/checklist.md` needs an API Contract row that points at this skill, not at a Gated Pipeline.
- Do not send ApiWriter output back for a second round. Do not invent `docs/backend/GUIDELINES.md`.
