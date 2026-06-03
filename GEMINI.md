# Gemini Workflows

Use these repo-local workflows for commit, pull request, and unit test tasks.

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

## Unit Test Delegation

When a task requires unit tests to be created or updated, delegate to the `test-scaffold` sub-agent (`.gemini/agents/test-scaffold.md`) rather than writing tests inline. The agent runs on `gemini-2.5-flash-lite` to keep costs low.

- Consult `docs/testing/README.md` first — it is the canonical Nx-aware guide for per-project tooling, environments, and mock patterns.
- Build a complete delegation brief before invoking the sub-agent:
  - Source and test file paths
  - Behavior matrix: happy path, error path, side effects, boundary values, security-sensitive paths
  - Project name (backend / myorganizer / web-ui / auth / vault-core / web-vault / web-pages/\*)
  - Relevant mocking constraints (Prisma inline factory, API client mock, Next.js router, vault stubs)
- Invoke the agent explicitly with `@test-scaffold` or let the main agent route automatically.
- Do **not** accept happy-path-only tests when error paths, side effects, boundaries, or security-sensitive misuse paths exist.
- After the sub-agent delivers output, review for: concrete assertions, negative paths, side-effect contracts, boundary inputs, and security-relevant scenarios.
- If coverage gaps remain, send a targeted refinement request back.
- Accept only when meaningful behavior coverage is achieved.

### References

- `docs/testing/README.md` — canonical Nx-aware testing guide
- `.gemini/agents/test-scaffold.md` — TestScaffold sub-agent (Gemini CLI native format, model: gemini-2.5-flash-lite)
- `.github/agents/test-scaffold.agent.md` — Copilot-CLI version of the same agent
- `.github/skills/unit-test-delegation-workflow/SKILL.md` — full workflow skill
- `.github/skills/unit-test-delegation-workflow/references/delegation-runbook.md` — delegation brief template
