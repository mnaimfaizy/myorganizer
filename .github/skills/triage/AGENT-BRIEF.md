# Writing Agent Briefs

An agent brief is a structured comment posted when an issue or PR moves to `ready-for-agent`. It is the working contract for asynchronous implementation.

## Principles

### Durability over precision

The brief must remain useful after refactors.

- Do describe interfaces, behaviors, and acceptance checks.
- Do call out important types and contracts.
- Do not rely on file paths or line numbers.

### Behavioral, not procedural

Describe what must be true after completion, not how to code it.

- Good: "`TaskSummary` should include overdue counts grouped by project."
- Bad: "Edit `summary.service.ts` and add logic in `buildSummary`"

### Complete acceptance criteria

Every brief must include concrete, testable checks.

### Explicit scope boundaries

State what is out of scope to prevent overreach.

## Template

```md
## Agent Brief

**Category:** bug / enhancement
**Summary:** one-line objective

**Current behavior:**
Describe what happens now.

**Desired behavior:**
Describe what should happen after completion, including edge/error cases.

**Key interfaces:**

- `TypeOrContract` - what changes and why
- `FunctionOrCommand` - expected behavior constraints
- Config shape changes (if any)

**Acceptance criteria:**

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

**Out of scope:**

- Explicitly excluded concern 1
- Explicitly excluded concern 2
```

## PR-specific note

For PR triage, "current behavior" describes the current diff state and remaining gaps. The brief should direct completion of the existing work, not restart from zero.
