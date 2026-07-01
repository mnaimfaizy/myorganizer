---
name: prototype
description: Build throwaway prototypes to answer design questions quickly. Use when you need to sanity-check logic/state behavior or compare multiple UI directions before committing to production implementation.
---

# Prototype

Adapted from `mattpocock/skills` for MyOrganizer workflows.

A prototype is **throwaway code that answers a question**. The question decides the shape.

## Pick a branch

Identify the question first:

- **"Does this logic/state model feel right?"** → follow [LOGIC.md](LOGIC.md)
- **"What should this look like?"** → follow [UI.md](UI.md)

If the question is ambiguous and the user is AFK, choose the branch that best matches the touched area and state that assumption in the prototype.

## Rules for both branches

1. **Throwaway from day one**: make it obvious this is prototype-only (name/path/comment).
2. **One command to run**: use existing project tooling (`yarn nx ...`, `yarn ...`).
3. **No persistence by default**: keep state in memory unless persistence itself is the question.
4. **Skip polish**: no tests, no production hardening, minimal error handling.
5. **Surface state clearly**: every interaction should expose resulting state/shape.
6. **Delete or absorb quickly**: once answered, remove prototype code or fold validated decisions into real implementation.

## MyOrganizer constraints

- Keep Next.js route wrappers in `apps/myorganizer/src/app/**` thin. For UI prototypes, prefer putting throwaway implementation in an appropriate `libs/web/pages/<route>/` area and expose it via a temporary wrapper route only if needed.
- Do not add plaintext persistence for vault-backed domains.
- Do not hand-edit generated outputs (API client/spec artifacts) just to prototype behavior.

## After the prototype

Capture the **answer** (question + conclusion) in a durable place (issue, ADR, PR note, or nearby notes), then clean up the prototype.
