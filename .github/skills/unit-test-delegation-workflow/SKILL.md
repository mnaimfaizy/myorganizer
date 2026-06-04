---
name: unit-test-delegation-workflow
description: 'Use when a task requires creating or updating Jest unit tests, Jest integration tests, React hook/component integration tests, or specific Jest test cases in MyOrganizer. Delegate implementation to TestScaffold with a behavior matrix and review for correctness, scope, mock hygiene, duplicate output, and validation results.'
argument-hint: 'Requirement summary + source path(s) + test type + expected behaviors'
---

# Jest Test Delegation Workflow

## Use This Skill When

- A feature, bug fix, or refactor requires new or changed Jest tests.
- Existing Jest unit or integration tests need to be updated for changed behavior.
- A React hook/component integration suite needs to verify local workflows, state transitions, and mocked collaborator calls.

Use `.github/skills/playwright-e2e-workflow/SKILL.md` for Playwright specs in `apps/myorganizer-e2e`.

## Core Rules

- Always delegate Jest test implementation to the `TestScaffold` custom agent.
- Send a complete requirement brief; never ask for generic "comprehensive tests".
- The brief must include a behavior matrix based on the actual implementation, not desired behavior from a template.
- The main agent is the quality reviewer. It must reject tests that assert unsupported behavior, duplicate generated content, rely on brittle mocks, or pass without proving the named behavior.
- Happy-path-only tests are not acceptable when reachable side effects, error paths, boundaries, or security-sensitive misuse paths exist.

## Workflow

1. Gather context from the changed behavior and owning files.
2. Read the full implementation under test, not only exported types or signatures.
3. Read neighboring tests and the owning project's `jest.config.ts`.
4. Build a delegation brief using [references/delegation-runbook.md](./references/delegation-runbook.md).
5. Include a behavior matrix with:
   - happy path;
   - error/validation path;
   - side effects and collaborator calls;
   - boundary/edge cases;
   - security-sensitive paths;
   - unsupported behavior to avoid testing.
6. Assess suite size before delegating:
   - 8-15 tests is the default upper range for one focused integration suite.
   - More than 15 tests requires a reason tied to the behavior matrix.
   - More than 20 tests or multiple files requires logical batches.
7. Delegate one focused batch to `TestScaffold` with explicit requirements:
   - test type (`unit`, `Jest integration`, `React hook integration`, etc.);
   - source and target test paths;
   - project name and run command;
   - mocking boundaries;
   - in-scope and out-of-scope scenarios;
   - acceptance checks and validation commands.
8. After `TestScaffold` reports back, pause and review quality before accepting or requesting refinement.
9. For multi-batch suites, verify and review each batch before delegating the next.
10. Finalize only after focused tests, the full affected run, linting, and duplicate/syntax checks are clean or clearly reported as not run with a reason.

## Integration-Test Scope Guardrails

For hooks, components, controllers, or services, prefer core workflows and observable contracts over broad edge-case sweeps.

Test these when reachable:

- load/init behavior;
- create/update/delete or equivalent mutation workflows;
- state consistency after operations;
- persistence/API/repository collaborator calls;
- validation and error states that the implementation actually sets;
- security-sensitive boundaries such as auth checks or ciphertext-only rules.

Do not test these unless the code explicitly supports them:

- retry or recovery flows;
- concurrent `Promise.all()` mutations;
- timeout/timing-window behavior;
- thrown errors from public methods that catch and swallow;
- real network, DB, email, Google, or third-party behavior.

## Large Suite Splitting

When the full scope covers more than 20 tests or multiple test files:

1. Identify logical groups such as load/init, mutations, async side effects, failure paths, and security/edge cases.
2. Delegate one group at a time, usually 5-8 tests per session.
3. Wait for the group to be implemented, verified passing, and reviewed before starting the next group.
4. Keep a running tally of completed vs. remaining groups.

Example split for a hook with 22 justified tests:

| Session | Group                           | Tests |
| ------- | ------------------------------- | ----- |
| 1       | Load state + initial render     | 1-5   |
| 2       | Mutation operations             | 6-12  |
| 3       | Async persist + side effects    | 13-18 |
| 4       | Security + reachable edge cases | 19-22 |

## Review Checklist (Main Agent)

### Behavior correctness

- [ ] Did the sub-agent read the full implementation and produce a behavior matrix?
- [ ] Does each test scenario exist in the actual code path?
- [ ] Are retry, recovery, timeout, concurrency, or thrown-error expectations excluded unless implemented?
- [ ] Do test names accurately describe the assertions?
- [ ] Would the tests fail if the implementation were broken?

### Coverage quality

- [ ] Are important behaviors covered with concrete assertions, not only `toBeTruthy` or `toBeDefined`?
- [ ] Are reachable negative/error paths covered?
- [ ] Are side effects and collaborator call contracts asserted?
- [ ] Are boundary values and invalid inputs handled when branching exists?
- [ ] Are security-sensitive paths tested when in scope?
- [ ] Are mocks deterministic and minimal?

### Technical hygiene

- [ ] All `jest.mock()` calls appear before imports, including `import type`?
- [ ] Every configured mock module is explicitly mocked?
- [ ] Mocks are reset in `beforeEach()`, not `beforeAll()`?
- [ ] Async React state assertions use `waitFor()` where needed?
- [ ] No brittle `mockReturnValueOnce()` queues for concurrent or async ordering-sensitive behavior?
- [ ] No duplicate helper functions, duplicate `describe` blocks, or appended copy of the suite?
- [ ] No unused type-cast mock variables?
- [ ] Linting passes with `yarn nx lint <project>`?
- [ ] The full affected test run passes, not only isolated tests?

If any checklist item fails, send a targeted refinement brief back to `TestScaffold` with concrete gaps.

## References

- `./references/delegation-runbook.md`
- `.github/agents/test-scaffold.agent.md`
- `.github/skills/playwright-e2e-workflow/SKILL.md`
- `docs/testing/README.md` - canonical Nx-aware testing guide
- `AGENTS.md`
