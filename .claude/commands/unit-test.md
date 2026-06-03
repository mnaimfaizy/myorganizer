# Unit Test Delegation Command

Use this workflow when Claude Code is asked to create or update unit tests in MyOrganizer.

## Sub-Agent

Delegate all test implementation to the `TestScaffold` sub-agent (`.claude/agents/test-scaffold.md`).
It runs on `model: haiku` to keep costs low.

## Rules

- Do **not** write tests inline in the main context. Delegate to the `TestScaffold` sub-agent.
- Always send a complete delegation brief — never a vague "add tests" request.
- Happy-path-only coverage is not acceptable when error paths, side effects, boundaries, or security-sensitive paths exist.
- Review the sub-agent output; challenge weak coverage and request targeted refinements.

## Workflow

1. Identify the source files under test and the behaviors requiring coverage.
2. Build a brief containing:
   - Source and test file paths
   - Behavior matrix: happy path, error path, side effects, boundary values, security-sensitive paths
   - Project name (backend / myorganizer / web-ui / auth / vault-core / web-vault / web-pages/\*)
   - Relevant mocking constraints (Prisma, API client, Next.js router, vault stubs)
3. Invoke `TestScaffold` with the full brief.
4. Review the output:
   - Concrete assertions on all important behaviors?
   - Negative and error paths covered?
   - Side effects and call contracts asserted?
   - Boundary and invalid inputs tested?
   - Security-sensitive paths covered when applicable?
5. If gaps remain, send a refinement request with specific missing scenarios.
6. Accept only when the behavior matrix is meaningfully covered.

## References

- `docs/testing/README.md` — canonical Nx-aware testing guide
- `.claude/agents/test-scaffold.md` — TestScaffold sub-agent (Claude Code native format, model: haiku)
- `.github/agents/test-scaffold.agent.md` — Copilot-CLI version of the same agent
- `.github/skills/unit-test-delegation-workflow/references/delegation-runbook.md` — delegation brief template
