# Unit Test Delegation Runbook

Use this runbook to provide high-signal context to the `TestScaffold` sub-agent and to review its result consistently.

## Delegation Brief Template

Provide all of the following fields to the sub-agent:

1. **Goal**: one-line purpose of the test update.
2. **Project**: which Nx project owns the file (e.g. `backend`, `web-ui`, `vault-core`). The sub-agent will read its `jest.config.ts` to determine tooling.
3. **Code under test**: exact source file paths.
4. **Target test files**: exact `*.spec.ts` / `*.test.ts` paths (new or existing).
5. **Behavior matrix**:
   - happy path
   - error/validation path
   - side effects/collaborator calls
   - boundary/edge cases
   - security-sensitive misuse path (if any)
6. **Mocking boundaries**: what must be mocked and what must remain real. Reference `docs/testing/README.md` for the per-project mock cheatsheet.
7. **Batch scope** (if splitting a large suite): which group of behaviors this delegation covers and the total plan.
8. **Out of scope**: explicit exclusions.
9. **Acceptance checks**: concrete assertions that must exist.

### Per-project mock cheatsheet (quick reference)

| Project surface            | Key mocks to supply                                                              |
| -------------------------- | -------------------------------------------------------------------------------- |
| `apps/backend` services    | `jest.mock('../prisma', factory)`, external SDK mocks, env vars via `beforeEach` |
| `apps/backend` controllers | `supertest` + app instance, no real server                                       |
| `apps/myorganizer`         | `jest.mock('@myorganizer/app-api-client')`, `jest.mock('next/navigation')`       |
| `libs/auth`                | `clearAuthSession()` in `beforeEach`, no real network                            |
| `libs/vault-core`          | Deterministic `Buffer` stubs, no real crypto keys                                |
| `libs/web-vault*`          | `jest.mock('@myorganizer/vault-core')`, stub unlock/read/write                   |
| `libs/web/pages/*`         | API client + auth + vault mocks, Zod `safeParse` for form validation             |

For full examples see `docs/testing/README.md`.

### Mandatory mock hygiene reminders (include in every brief)

- Place all `jest.mock()` calls **before** any imports (including `import type`) — Nx lazy-loading rule.
- Reset all mocks in `beforeEach()` — never `beforeAll()`.
- Use `waitFor()` for all async state assertions in React hook tests.
- Only type-cast mocks that are referenced in assertions; delete unused casts.

## Review Standard

The main agent must treat this as a **quality gate**, not just a pass/fail check. Reject or refine output when:

- Only happy-path assertions are present.
- Side effects are implied but not asserted.
- Failure states are skipped even though reachable.
- Boundary inputs are missing for branching logic.
- Security-sensitive risks in scope are not represented in tests.
- Assertions are too weak to catch regressions (`toBeTruthy`, `toBeDefined` alone, etc.).
- Test names don't match what the test actually asserts.
- Tests would pass even with a broken implementation (vacuous tests).
- Mock setup is in `beforeAll()` instead of `beforeEach()`.
- Async state assertions lack `waitFor()`.
- `jest.mock()` calls appear after imports.
- Unused type-cast variables remain after generation.

## Security Prompts To Include When Relevant

- "Could unsafe input pass validation and alter behavior?"
- "Could auth/session or permission checks be bypassed?"
- "Could secrets/plaintext leak into logs or returned values?"
- "Could ciphertext-only rules be violated in vault-backed flows?"

## Refinement Prompt Pattern

When requesting a second pass, provide explicit gaps:

> Update `<test-file>` to add assertions for `<missing behavior>`.  
> Keep existing test style, keep mocks deterministic, and explain any changed strategy.

## Large Suite Split Pattern

When the full scope covers > 20 tests or multiple files, split by logical group and record progress:

```
Total planned: 22 tests across 1 file

Batch 1 (delegated): Load state + initial render (tests 1–5) — STATUS: PASS
Batch 2 (delegated): Mutation operations (tests 6–12) — STATUS: PASS
Batch 3 (pending): Async persist + side effects (tests 13–18)
Batch 4 (pending): Security + edge cases (tests 19–22)
```

Do not start Batch N+1 until Batch N is verified passing and the main agent has reviewed the coverage.
