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
7. **Out of scope**: explicit exclusions.
8. **Acceptance checks**: concrete assertions that must exist.

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

## Review Standard

The main agent should reject or refine output when:

- only happy-path assertions are present
- side effects are implied but not asserted
- failure states are skipped even though reachable
- boundary inputs are missing for branching logic
- security-sensitive risks in scope are not represented in tests
- assertions are too weak to catch regressions

## Security Prompts To Include When Relevant

- "Could unsafe input pass validation and alter behavior?"
- "Could auth/session or permission checks be bypassed?"
- "Could secrets/plaintext leak into logs or returned values?"
- "Could ciphertext-only rules be violated in vault-backed flows?"

## Refinement Prompt Pattern

When requesting a second pass, provide explicit gaps:

> Update `<test-file>` to add assertions for `<missing behavior>`.  
> Keep existing test style, keep mocks deterministic, and explain any changed strategy.
