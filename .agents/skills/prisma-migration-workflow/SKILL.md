---
name: prisma-migration-workflow
description: 'Use when editing Prisma schema files, creating migrations, regenerating Prisma client types, or changing database structure in MyOrganizer.'
---

# Prisma Migration Workflow

## Use This Skill When

- Editing files under `apps/backend/src/prisma/schema`
- Adding or changing tables, columns, indexes, or relations
- Creating Prisma migrations or regenerating Prisma client types
- Preparing database changes that also affect backend DTOs or frontend client types

## Core Rules

- Treat Prisma schema files as the database source of truth.
- Do not edit migration files manually.
- Do not patch generated Prisma client output directly.
- Do not add plaintext storage for vault-backed features.
- Do not add or resurrect a plaintext Todo model or table for vault-backed todos.

## Procedure

1. Start from the owning schema file under `apps/backend/src/prisma/schema`.
2. Regenerate types with `yarn nx run backend:generate-types` before validating anything else.
3. Create migrations with `yarn nx run backend:migrate`, not by hand-editing migration files.
4. Load `references/prisma-migration-runbook.md` for the schema-first workflow, deployment notes, validation, and repo references.
