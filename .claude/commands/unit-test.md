# Jest Test Delegation Command

Use this workflow when Claude Code is asked to create or update Jest unit tests or Jest integration tests in MyOrganizer.

## Sub-Agent

Delegate Jest test implementation to the `TestScaffold` sub-agent (`.claude/agents/test-scaffold.md`).
It runs on `model: haiku` to keep costs low.

Use `.github/skills/playwright-e2e-workflow/SKILL.md` for Playwright E2E specs in `apps/myorganizer-e2e`.

## Rules

- Do **not** write Jest tests inline in the main context. Delegate to the `TestScaffold` sub-agent.
- Always send a complete delegation brief; never a vague "add comprehensive tests" request.
- Read the full implementation first and brief the sub-agent on actual behavior, not only types or desired behavior.
- Include unsupported behavior to avoid testing, such as retry, concurrency, timeout, or thrown-error expectations the code does not implement.
- Happy-path-only coverage is not acceptable when error paths, side effects, boundaries, or security-sensitive paths exist.
- Act as **quality reviewer**: challenge weak coverage, incorrect mock patterns, and vacuous tests before accepting.

## Workflow

1. Identify the source files under test and the behaviors requiring coverage.
2. Read the full implementation, neighboring tests, `docs/testing/README.md`, and the owning project's `jest.config.ts`.
3. **Assess suite size** before delegating:
   - 8-15 tests is the default upper range for one focused integration suite.
   - More than 15 tests requires a behavior-matrix reason.
   - More than 20 tests or multiple files requires logical batches of 5-8 tests; delegate one batch at a time.
4. Build a brief containing:
   - Test type (`unit`, `Jest integration`, `React hook integration`, `component integration`, etc.)
   - Source and test file paths
   - Behavior matrix: happy path, error path, side effects, boundary values, security-sensitive paths, unsupported behavior
   - Project name (backend / myorganizer / web-ui / auth / vault-core / web-vault / web-pages/\*)
   - Relevant mocking constraints (Prisma, API client, Next.js router, vault stubs)
   - In-scope and out-of-scope scenarios
   - Acceptance assertions and validation commands
   - Batch scope (if splitting a large suite)
5. Invoke `TestScaffold` with the full brief.
6. Review the output against **both** checklists below before accepting or requesting refinement.
7. For multi-batch suites, verify each batch passes before delegating the next.
8. Accept only when the full behavior matrix is meaningfully covered, duplicate/syntax checks are clean, tests pass, and linting is clean.

## Integration-Test Guardrails

- Prefer core workflows, state consistency, collaborator calls, and reachable failures.
- Do not test retry, recovery, concurrency, timeout, or thrown-error behavior unless the implementation explicitly supports it.
- Prefer deterministic external-boundary mocks over mocking incidental implementation details.
- Avoid `mockReturnValueOnce()` queues for async or concurrent ordering-sensitive behavior; prefer `mockImplementation()`.

## Review Checklist

### Coverage quality

- [ ] Concrete assertions on all important behaviors (not just `toBeTruthy`)
- [ ] Negative and error paths covered?
- [ ] Side effects and call contracts asserted (`toHaveBeenCalledWith`)?
- [ ] Boundary and invalid inputs tested?
- [ ] Security-sensitive paths covered when applicable?
- [ ] Unsupported retry/concurrency/timing/throw expectations excluded unless implemented?
- [ ] Test names accurately describe the asserted behavior?
- [ ] Tests would fail if the implementation were broken (no vacuous tests)?

### Technical hygiene

- [ ] All `jest.mock()` calls appear **before** any imports (including `import type`) — Nx lazy-loading rule
- [ ] Every configured mock module is explicitly mocked?
- [ ] Mocks reset in `beforeEach()`, not `beforeAll()`
- [ ] Async state assertions use `waitFor()` (not bare `expect()` after `act()`)
- [ ] No brittle mock queues for async/concurrent operations?
- [ ] No duplicate helpers, duplicate `describe` blocks, or appended suite copies?
- [ ] No unused type-cast mock variables
- [ ] Linting passes: `yarn nx lint <project>`
- [ ] All tests pass in the full suite run, not just in isolation

## References

- `docs/testing/README.md` — canonical Nx-aware testing guide
- `.claude/agents/test-scaffold.md` — TestScaffold sub-agent (Claude Code, model: haiku)
- `.github/agents/test-scaffold.agent.md` — Copilot version (model: `GPT-5 mini (copilot)`)
- `.gemini/agents/test-scaffold.md` — Gemini version (model: `gemini-2.5-flash`)
- `.github/skills/unit-test-delegation-workflow/SKILL.md` — shared Jest test delegation skill
- `.github/skills/unit-test-delegation-workflow/references/delegation-runbook.md` — delegation brief template
- `.github/skills/playwright-e2e-workflow/SKILL.md` — Playwright E2E workflow
