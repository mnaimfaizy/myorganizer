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
- Treat the main agent as the **quality reviewer**: it must challenge weak coverage and request refinements.
- Happy-path-only tests are not acceptable when side effects, error paths, boundaries, or security-sensitive misuse paths exist.

## Workflow

1. Gather context from the changed behavior and owning files.
2. **Assess suite size** before delegating:
   - ≤ 10 tests → single delegation.
   - > 10 tests or multiple test files → split into logical batches (see "Large Suite Splitting" below).
3. Build a delegation brief using [references/delegation-runbook.md](./references/delegation-runbook.md).
4. Delegate to `TestScaffold` with explicit requirements:
   - target files to edit/create
   - behavior matrix (happy, error, side effect, boundary, security)
   - project-specific mocking constraints
   - which batch this delegation covers (if splitting)
5. After `TestScaffold` reports back, **pause and review quality** (see Review Checklist below) before approving or requesting a refinement pass.
6. If coverage is weak, delegate a refinement pass with concrete gaps listed.
7. For multi-batch suites, verify each batch passes before delegating the next.
8. Finalize only after all batches pass and linting is clean.

## Large Suite Splitting

When the full scope covers **more than ~20 test cases** or **multiple test files**, do not delegate everything in one shot. Instead:

1. Identify logical groups (e.g., happy-path cases, error-path cases, async/side-effect cases, security cases).
2. Delegate **one group at a time** — typically 5–8 tests per session.
3. Wait for the group to be implemented, verified passing, and reported back before starting the next group.
4. Keep a running tally of completed vs. remaining groups and surface it to the user.

Example split for a hook with 22 tests:

| Session | Group                        | Tests |
| ------- | ---------------------------- | ----- |
| 1       | Load state + error states    | 1–6   |
| 2       | Mutation operations          | 7–14  |
| 3       | Async persist + side effects | 15–19 |
| 4       | Security + edge cases        | 20–22 |

## Review Checklist (Main Agent)

The main agent **must review test quality**, not just check that tests pass. Run through this checklist after each TestScaffold batch:

### Coverage quality

- [ ] Does each important behavior have concrete, specific assertions (not `toBeTruthy` or `toBeDefined` alone)?
- [ ] Are negative/error paths covered, not only success?
- [ ] Are side effects and collaborator call contracts asserted?
- [ ] Are boundary values and invalid inputs handled?
- [ ] Are security-sensitive paths tested when in scope?
- [ ] Are mocks deterministic and minimal?

### Test correctness

- [ ] Do the test names accurately describe what is being tested?
- [ ] Do the assertions actually verify the behavior claimed in the test name?
- [ ] Are there any tests that would pass even if the implementation were broken (vacuous tests)?
- [ ] Is the behavior matrix from the delegation brief fully covered?

### Technical hygiene

- [ ] All `jest.mock()` calls appear before imports (Nx lazy-loading rule)?
- [ ] Mocks are reset in `beforeEach()`, not `beforeAll()`?
- [ ] Async state assertions use `waitFor()` (not bare `expect()` after `act()`)?
- [ ] No unused type-cast mock variables (`const mockFn = fn as jest.Mock` without use)?
- [ ] Linting passes: `yarn nx lint <project>`?
- [ ] All tests pass in the full suite run (not just in isolation)?

If any checklist item fails, send a targeted refinement brief back to `TestScaffold` with the specific gaps.

## References

- `./references/delegation-runbook.md`
- `.github/agents/test-scaffold.agent.md`
- `docs/testing/README.md` — canonical Nx-aware testing guide (tooling, environments, mock patterns per project)
- `AGENTS.md`
