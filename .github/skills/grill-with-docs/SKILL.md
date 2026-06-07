---
name: grill-with-docs
description: Grilling session that challenges your plan against the existing domain model, sharpens terminology, and updates documentation (CONTEXT.md, ADRs) inline as decisions crystallise. Use when you want to stress-test a plan against the project's language and documented decisions.
---

<what-to-do>

Interview relentlessly about every aspect of the plan until reaching a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.

Ask questions one at a time, waiting for feedback on each question before continuing.

If a question can be answered by exploring the codebase, explore the codebase instead of asking.

</what-to-do>

<supporting-info>

## Domain awareness for MyOrganizer

During codebase exploration, look for existing documentation:

### File structure

MyOrganizer uses a single context structure:

```
/
├── CONTEXT.md              (if exists - domain language glossary)
├── docs/
│   ├── ARCHITECTURE.md     (high-level overview)
│   └── adr/                (architecture decision records)
│       ├── 0001-*.md
│       └── 0002-*.md
├── .github/
│   ├── copilot-instructions.md
│   └── skills/
└── src/
```

Create files lazily — only when you have something to write. If no `CONTEXT.md` exists, create one when the first domain term is resolved. If no `docs/adr/` exists, create it when the first ADR is needed.

## During the session

### Challenge against the glossary

When a term is used that might conflict with existing language in `CONTEXT.md`, call it out immediately. "Your glossary defines 'vault' as X, but you seem to mean Y — which is it?"

### Sharpen fuzzy language

When vague or overloaded terms are used, propose a precise canonical term. "You're saying 'user' — do you mean the authenticated User in the database or the system User entity? Those are different things."

### Discuss concrete scenarios

When domain relationships are discussed, stress-test them with specific scenarios. Invent scenarios that probe edge cases and force precision about the boundaries between concepts.

### Cross-reference with code

When the user states how something works, check whether the code agrees. If a contradiction is found, surface it: "Your code stores Todos in vault ciphertext, but you just said they should also be indexed — which is right?"

### Update CONTEXT.md inline

When a term is resolved, update `CONTEXT.md` right there. Don't batch these up — capture them as they happen. Use the format in [CONTEXT-FORMAT.md](./CONTEXT-FORMAT.md).

`CONTEXT.md` should be totally devoid of implementation details. Do not treat `CONTEXT.md` as a spec, a scratch pad, or a repository for implementation decisions. It is a glossary and nothing else.

### Offer ADRs sparingly

Only offer to create an ADR when all three are true:

1. **Hard to reverse** — the cost of changing your mind later is meaningful
2. **Surprising without context** — a future reader will wonder "why did they do it this way?"
3. **The result of a real trade-off** — there were genuine alternatives and you picked one for specific reasons

If any of the three is missing, skip the ADR. Use the format in [ADR-FORMAT.md](./ADR-FORMAT.md).

## Project-specific context

### MyOrganizer Domain Terms

These are key concepts already present in the codebase:

- **Vault**: End-to-end encrypted storage for sensitive data on client; server stores ciphertext only
- **Todo**: A task or item to organize (vault-backed in current architecture)
- **Subscription**: Recurring task or reminder (vault-backed)
- **User**: Authenticated account holder
- **Organization**: Group for organizing shared resources (emerging context)
- **Ciphertext**: Encrypted blob format for vault-backed types

Refer to `CONTEXT.md` (if present) for canonical definitions.

### Technology Stack

> For current package versions see [TECH_STACK.md](../../../TECH_STACK.md).

- **Frontend**: Next.js with App Router, React, TypeScript, Tailwind CSS, React Hook Form + Zod
- **Backend**: Express.js, Prisma ORM, TSOA (decorators for API docs)
- **Database**: PostgreSQL (Prisma as data access layer)
- **Monorepo**: Nx with path aliases
- **Testing**: Jest (unit/integration), Playwright (E2E)
- **Architecture**: DDD-influenced with vault-backed end-to-end encryption

When making architectural decisions, consider:

- Vault implications (ciphertext-only sync, no plaintext server-side indexing)
- Database schema impact (Prisma migrations, model shape)
- API contract surface (TSOA controllers, OpenAPI spec generation)
- Nx module boundaries (avoid circular dependencies between contexts)

</supporting-info>
