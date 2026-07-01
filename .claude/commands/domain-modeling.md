# Domain Modeling Command

Use this workflow when the user wants to build or sharpen the project's domain model — pinning down terminology, resolving fuzzy language, or recording an architectural decision.

1. Read and follow `.github/skills/domain-modeling/SKILL.md` exactly.
2. Read the existing root `CONTEXT.md` before the session begins to understand terms already defined.
3. Scan `docs/adr/` for the highest existing ADR number before creating a new one.
4. **Challenge immediately** — when the user uses a term that conflicts with the existing glossary, surface the conflict before proceeding.
5. **Update `CONTEXT.md` inline** — as each term is resolved, write it immediately. Do not batch.
6. **Offer ADRs sparingly** — only when all three conditions are met: hard to reverse, surprising without context, result of a real trade-off. Use the format in `.github/skills/domain-modeling/ADR-FORMAT.md`.
