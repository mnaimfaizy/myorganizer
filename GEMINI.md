# Gemini Workflows

Use these repo-local workflows for commit, pull request, test, and Storybook-suite tasks.

## Commit Changes

- Draft the Conventional Commit message with the existing `Commit` sub-agent or equivalent diff-based commit-message generator.
- Execute the commit with `corepack yarn ai:commit`.
- Wait for the commit process to finish; do not cancel the command while Husky is running.
- If Husky fails, fix the reported issue, rerun the narrow validation, and retry the commit.

## Create Pull Request

- Build the PR title and description from the current branch commits.
- Execute `corepack yarn ai:create-pr`.
- Push upstream if needed.
- Assign the authenticated GitHub user.
- Leave reviewers empty unless the user explicitly supplies them with `--reviewer <login>`.
- Return only the PR URL on success.

## Jest Test Delegation

When a task requires Jest unit tests or Jest integration tests to be created or updated, delegate to the `test-scaffold` sub-agent (`.gemini/agents/test-scaffold.md`) rather than writing tests inline. The agent runs on `gemini-2.5-flash` to keep costs low.

Use `.github/skills/playwright-e2e-workflow/SKILL.md` for Playwright E2E specs in `apps/myorganizer-e2e`.

- Consult `docs/testing/README.md` first — it is the canonical Nx-aware guide for per-project tooling, environments, and mock patterns.
- Build a complete delegation brief before invoking the sub-agent:
  - Test type (`unit`, `Jest integration`, `React hook integration`, `component integration`, etc.)
  - Source and test file paths
  - Implementation notes from reading the actual code under test
  - Behavior matrix: happy path, error path, side effects, boundary values, security-sensitive paths, unsupported behavior
  - Project name (backend / myorganizer / web-ui / auth / vault-core / web-vault / web-pages/\*)
  - Relevant mocking constraints (Prisma inline factory, API client mock, Next.js router, vault stubs)
  - In-scope and out-of-scope scenarios
  - Acceptance assertions and validation commands
- Invoke the agent explicitly with `@test-scaffold` or let the main agent route automatically.
- Do **not** accept happy-path-only tests when error paths, side effects, boundaries, or security-sensitive misuse paths exist.
- Do **not** accept tests for retry, recovery, concurrency, timeout, or thrown-error behavior unless the implementation actually supports it.
- After the sub-agent delivers output, review for: concrete assertions, negative paths, side-effect contracts, boundary inputs, security-relevant scenarios, deterministic mocks, and duplicate/syntax checks.
- If coverage gaps remain, send a targeted refinement request back.
- Accept only when meaningful behavior coverage is achieved.

### References

- `docs/testing/README.md` — canonical Nx-aware testing guide
- `.gemini/agents/test-scaffold.md` — TestScaffold sub-agent (Gemini CLI native format, model: gemini-2.5-flash)
- `.github/agents/test-scaffold.agent.md` — Copilot-CLI version of the same agent
- `.github/skills/unit-test-delegation-workflow/SKILL.md` — full workflow skill
- `.github/skills/unit-test-delegation-workflow/references/delegation-runbook.md` — delegation brief template

## Storybook Delegation

When a task requires Storybook creation or updates (`*.stories.tsx`), delegate to the `storybook-curator` sub-agent (`.gemini/agents/storybook-curator.md`) rather than editing stories inline.

- Build a complete delegation brief before invoking the sub-agent:
  - requirement summary and desired UX outcome
  - component file path(s)
  - story file path(s) to create/update
  - required states/variants and relevant references
- Require the sub-agent to perform requirement-readiness analysis before file edits.
- If the sub-agent reports missing requirements, ask the human-in-the-loop for clarification before continuing.
- Allow the sub-agent to challenge weak requirements and recommend additional story scenarios when needed for quality.
- Accept only when story coverage is meaningful and UX/a11y concerns are addressed.

### References

- `.gemini/agents/storybook-curator.md` — StorybookCurator sub-agent (Gemini CLI native format, model: gemini-2.5-flash-lite)
- `.github/agents/storybook-curator.agent.md` — Copilot-CLI version of the same agent
- `.github/skills/storybook-delegation-workflow/SKILL.md` — full workflow skill
- `.github/skills/storybook-delegation-workflow/references/delegation-runbook.md` — delegation brief template
- `docs/storybook/README.md` — Storybook usage and conventions
