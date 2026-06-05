# Jest Test Delegation Runbook

Use this runbook to provide high-signal context to the `TestScaffold` sub-agent and to review its result consistently.

The main failure mode to avoid is template-driven test generation: tests that assert ideal behavior, retry flows, concurrency, or error propagation that the implementation does not provide.

## Delegation Brief Template

Provide all of the following fields to `TestScaffold`:

1. **Goal**: one-line purpose of the test update.
2. **Test type**: `unit`, `Jest integration`, `React hook integration`, `component integration`, or another precise Jest scope.
3. **Project**: Nx project name and expected run command.
4. **Code under test**: exact source file paths.
5. **Target test files**: exact `*.spec.ts` / `*.test.ts` paths to edit or create.
6. **Implementation notes from main-agent read-through**:
   - public methods and state returned;
   - where errors are caught, swallowed, rethrown, or converted to state;
   - whether retry, timeout, cancellation, or concurrency exists;
   - important side effects and collaborators.
7. **Behavior matrix**:

   | Operation/flow | Input/precondition | Expected state/output | Side effects | Error behavior | Unsupported behavior |
   | -------------- | ------------------ | --------------------- | ------------ | -------------- | -------------------- |

8. **In scope**: the exact scenarios to test.
9. **Out of scope**: scenarios not to test, especially unsupported retry/concurrency/timing flows.
10. **Mocking boundaries**: what must be mocked and what must stay real. Reference `docs/testing/README.md`.
11. **Acceptance checks**: concrete assertions that must exist.
12. **Validation commands**: focused run, full affected run, lint command, and duplicate/syntax check.
13. **Batch scope**: if splitting, identify this batch and the total plan.

## Prompt Pattern

```markdown
Goal: <why tests are needed>
Test type: <unit | Jest integration | React hook integration | component integration>
Project: <nx-project>, run with <command>
Source files: <paths>
Target tests: <paths>

Implementation notes:

- <actual error handling and state transitions>
- <collaborators and side effects>
- <unsupported behaviors to avoid>

Behavior matrix:
| Operation/flow | Input/precondition | Expected state/output | Side effects | Error behavior | Unsupported behavior |
| -------------- | ------------------ | --------------------- | ------------ | -------------- | -------------------- |
| ... |

In scope:

- <focused scenario>

Out of scope:

- <retry/concurrency/timing/etc. if unsupported>

Mocking boundaries:

- <module> mocked because <reason>
- <module/logic> remains real because <reason>

Acceptance checks:

- <specific assertion>

Validation:

- Focused: <command>
- Full affected: <command>
- Lint: <command>
- Duplicate/syntax: inspect for duplicate helpers/describe blocks and invalid TS
```

## Integration-Test Scope Guide

Default to 8-15 focused tests for one integration suite. More tests require an explicit behavior-matrix reason.

Prefer testing:

- load or initialization behavior;
- core mutation workflows;
- persistence/API/repository collaborator calls;
- state consistency after operations;
- reachable error states;
- validation and security-sensitive boundaries.

Avoid testing unless implemented:

- error recovery or retry;
- concurrent operations;
- timeout or timing-window behavior;
- public method throws when the implementation catches and logs;
- real external infrastructure.

## Per-Project Mock Cheatsheet

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

## Mandatory Mock Hygiene Reminders

Include these in every brief:

- Place all `jest.mock()` calls before any imports, including `import type`.
- Mock every module whose functions are configured or cast in the test.
- Reset all mocks in `beforeEach()`, never `beforeAll()`.
- Use `waitFor()` for async React state assertions.
- Prefer `mockImplementation()` over `mockReturnValueOnce()` queues for async or multi-call behavior.
- Avoid concurrent `Promise.all()` tests unless the code explicitly handles concurrency and the mocks are order-independent.
- Only type-cast mocks that are referenced in assertions or setup.

## Review Standard

The main agent must treat TestScaffold output as a quality gate, not only a pass/fail check. Reject or refine output when:

- tests assert behavior that is not in the implementation;
- the behavior matrix is missing or not reflected in test names/assertions;
- only happy-path assertions are present while reachable failure paths exist;
- side effects are implied but not asserted;
- security-sensitive risks in scope are not represented;
- assertions are too weak to catch regressions;
- tests would pass with a broken implementation;
- mock setup is in `beforeAll()` instead of `beforeEach()`;
- async state assertions lack `waitFor()`;
- `jest.mock()` calls appear after imports;
- a configured mock module is not explicitly mocked;
- duplicate helper functions, duplicate `describe` blocks, or appended second copies remain;
- unused type-cast variables remain after generation.

## Security Prompts To Include When Relevant

- "Could unsafe input pass validation and alter behavior?"
- "Could auth/session or permission checks be bypassed?"
- "Could secrets/plaintext leak into logs or returned values?"
- "Could ciphertext-only rules be violated in vault-backed flows?"

## Refinement Prompt Pattern

When requesting a second pass, provide explicit gaps:

> Update `<test-file>` to add or fix assertions for `<missing behavior>`. Keep existing test style, keep mocks deterministic, do not add unsupported retry/concurrency/timing scenarios, and report the focused run plus duplicate/syntax check.

## Large Suite Split Pattern

When the full scope covers more than 20 tests or multiple files, split by logical group and record progress:

```text
Total planned: 22 tests across 1 file

Batch 1 (delegated): Load state + initial render (tests 1-5) - STATUS: PASS
Batch 2 (delegated): Mutation operations (tests 6-12) - STATUS: PASS
Batch 3 (pending): Async persist + side effects (tests 13-18)
Batch 4 (pending): Security + reachable edge cases (tests 19-22)
```

Do not start Batch N+1 until Batch N is verified passing and the main agent has reviewed coverage.
