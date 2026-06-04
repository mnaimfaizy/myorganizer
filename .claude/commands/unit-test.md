# Unit Test Delegation Command

Use this workflow when Claude Code is asked to create or update unit tests in MyOrganizer.

## Sub-Agent

Delegate all test implementation to the `TestScaffold` sub-agent (`.claude/agents/test-scaffold.md`).
It runs on `model: haiku` to keep costs low.

## Rules

- Do **not** write tests inline in the main context. Delegate to the `TestScaffold` sub-agent.
- Always send a complete delegation brief — never a vague "add tests" request.
- Happy-path-only coverage is not acceptable when error paths, side effects, boundaries, or security-sensitive paths exist.
- Act as **quality reviewer**: challenge weak coverage, incorrect mock patterns, and vacuous tests before accepting.

## Workflow

1. Identify the source files under test and the behaviors requiring coverage.
2. **Assess suite size** before delegating:
   - ≤ 10 tests → single delegation.
   - > 10 tests or multiple files → split into logical batches of 5–8 tests; delegate one batch at a time.
3. Build a brief containing:
   - Source and test file paths
   - Behavior matrix: happy path, error path, side effects, boundary values, security-sensitive paths
   - Project name (backend / myorganizer / web-ui / auth / vault-core / web-vault / web-pages/\*)
   - Relevant mocking constraints (Prisma, API client, Next.js router, vault stubs)
   - Batch scope (if splitting a large suite)
4. Invoke `TestScaffold` with the full brief.
5. Review the output against **both** checklists below before accepting or requesting refinement.
6. For multi-batch suites, verify each batch passes before delegating the next.
7. Accept only when the full behavior matrix is meaningfully covered and linting is clean.

## Review Checklist

### Coverage quality

- [ ] Concrete assertions on all important behaviors (not just `toBeTruthy`)
- [ ] Negative and error paths covered?
- [ ] Side effects and call contracts asserted (`toHaveBeenCalledWith`)?
- [ ] Boundary and invalid inputs tested?
- [ ] Security-sensitive paths covered when applicable?
- [ ] Test names accurately describe the asserted behavior?
- [ ] Tests would fail if the implementation were broken (no vacuous tests)?

### Technical hygiene

- [ ] All `jest.mock()` calls appear **before** any imports (including `import type`) — Nx lazy-loading rule
- [ ] Mocks reset in `beforeEach()`, not `beforeAll()`
- [ ] Async state assertions use `waitFor()` (not bare `expect()` after `act()`)
- [ ] No unused type-cast mock variables
- [ ] Linting passes: `yarn nx lint <project>`
- [ ] All tests pass in the full suite run, not just in isolation

## References

- `docs/testing/README.md` — canonical Nx-aware testing guide
- `.claude/agents/test-scaffold.md` — TestScaffold sub-agent (Claude Code, model: haiku)
- `.github/agents/test-scaffold.agent.md` — Copilot version (model: `GPT-5 mini (copilot)`)
- `.gemini/agents/test-scaffold.md` — Gemini version (model: `gemini-2.5-flash`)
- `.github/skills/unit-test-delegation-workflow/references/delegation-runbook.md` — delegation brief template
