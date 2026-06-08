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
6. Delegate `TestScaffold` output to `TestReviewer` (`.claude/agents/test-reviewer.md`).
7. Handle `TestReviewer` verdict:
   - **APPROVED** → proceed to step 8.
   - **REJECTED** → send revision brief to `TestScaffold` listing the specific failing checklist items (counts as one retry; max 3 retries total before escalating to the main agent).
8. Delegate `TestReviewer`-approved output to `TestRunner` (`.claude/agents/test-runner.md`).
9. Handle `TestRunner` verdict:
   - **PASS** → report result to main agent.
   - **FAIL(test_wrong)** → send diagnosis to `TestScaffold` as revision brief (retry counter applies; max 3 total).
   - **FAIL(code_broken)** → escalate to main agent with full TestRunner report; do not retry.
   - **ESCALATE** → escalate to main agent with full context.
   - **NEEDS_HUMAN_REVIEW** → relay PR comment and `needs-e2e-review` label to main agent; accept result.
10. For multi-batch suites: complete one full batch through TestScaffold → TestReviewer → TestRunner PASS before delegating the next batch.

## Integration-Test Guardrails

- Prefer core workflows, state consistency, collaborator calls, and reachable failures.
- Do not test retry, recovery, concurrency, timeout, or thrown-error behavior unless the implementation explicitly supports it.
- Prefer deterministic external-boundary mocks over mocking incidental implementation details.
- Avoid `mockReturnValueOnce()` queues for async or concurrent ordering-sensitive behavior; prefer `mockImplementation()`.

## Retry & Escalation Rules

**Retry cap**: Each `REJECTED` from TestReviewer or `FAIL(test_wrong)` from TestRunner that routes back to TestScaffold counts as one retry. After **3 total retries**, escalate to the main agent with the full history — do not attempt a 4th retry.

**Escalate immediately** (no retry) when TestRunner returns `FAIL(code_broken)` or `ESCALATE`.

## References

- `docs/testing/README.md` — canonical Nx-aware testing guide
- `.claude/agents/test-scaffold.md` — TestScaffold (Claude Code, model: haiku)
- `.claude/agents/test-reviewer.md` — TestReviewer (Claude Code, model: haiku)
- `.claude/agents/test-runner.md` — TestRunner (Claude Code, model: inherit)
- `.github/agents/test-scaffold.agent.md` — Copilot TestScaffold
- `.github/agents/test-reviewer.agent.md` — Copilot TestReviewer
- `.github/agents/test-runner.agent.md` — Copilot TestRunner
- `.gemini/agents/test-scaffold.md` — Gemini TestScaffold
- `.gemini/agents/test-reviewer.md` — Gemini TestReviewer
- `.gemini/agents/test-runner.md` — Gemini TestRunner
- `.github/skills/unit-test-delegation-workflow/SKILL.md` — shared Jest test delegation skill
- `.github/skills/unit-test-delegation-workflow/references/delegation-runbook.md` — delegation brief template
- `.github/skills/playwright-e2e-workflow/SKILL.md` — Playwright E2E workflow
