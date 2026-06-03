---
name: unit-test-delegation-workflow
description: 'Use when a task requires creating or updating Jest unit tests or specific unit test cases in MyOrganizer. Delegate implementation to the TestScaffold sub-agent, then review for happy path, side effects, failure paths, edge cases, and security-sensitive assertions.'
argument-hint: 'Requirement summary + source path(s) + expected behaviors'
---

# Unit Test Delegation Workflow

## Use This Skill When

- A feature or bug fix requires new unit tests.
- Existing unit tests need to be updated for changed behavior.
- The task includes one or more specific Jest test cases that should be delegated to a focused sub-agent.

## Core Rules

- Always delegate unit-test implementation to the `TestScaffold` custom agent.
- Send a complete requirement brief to the sub-agent instead of a vague "add tests" request.
- Keep the sub-agent on low-cost models first (`GPT-5 mini`, fallback `Claude Haiku 4.5`) via the `TestScaffold` agent config.
- Treat the main agent as the reviewer: it must challenge weak coverage and request refinements.
- Happy-path-only tests are not acceptable when side effects, error paths, boundaries, or security-sensitive misuse paths exist.

## Workflow

1. Gather context from the changed behavior and owning files.
2. Build a delegation brief using [references/delegation-runbook.md](./references/delegation-runbook.md).
3. Delegate to `TestScaffold` with explicit requirements:
   - target files to edit/create
   - behavior matrix (happy, error, side effect, boundary, security)
   - project-specific mocking constraints
4. Review the sub-agent output against the coverage checklist.
5. If coverage is weak, delegate a refinement pass with concrete gaps.
6. Finalize only after tests meaningfully protect behavior and regressions.

## Review Checklist (Main Agent)

- Does each important behavior have concrete assertions?
- Are negative/error paths covered, not only success?
- Are side effects and call contracts asserted?
- Are boundary values and invalid inputs handled?
- Are security-sensitive paths tested when in scope?
- Are mocks deterministic and minimal?

## References

- `./references/delegation-runbook.md`
- `.github/agents/test-scaffold.agent.md`
- `docs/testing/README.md` — canonical Nx-aware testing guide (tooling, environments, mock patterns per project)
- `AGENTS.md`
