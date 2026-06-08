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
- After `TestScaffold` reports, delegate the output to `TestReviewer` — it is the static quality gate (checklist verification, `tsc --noEmit`, `eslint`). After `TestReviewer` approves, delegate to `TestRunner` for execution. The main agent handles escalation only.
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
8. After `TestScaffold` reports back, delegate the full output to `TestReviewer` with the test file path and project name.
9. Handle `TestReviewer` verdict:
   - **APPROVED** → proceed to step 10.
   - **REJECTED** → send a targeted revision brief back to `TestScaffold` listing the specific failing checklist items (counts as one retry; max 3 retries total before escalating to the main agent with full history).
10. Delegate the `TestReviewer`-approved output to `TestRunner`.
11. Handle `TestRunner` verdict:
    - **PASS** → accept; report to main agent.
    - **FAIL(test_wrong)** → send diagnosis back to `TestScaffold` as a revision brief (retry counter applies; max 3 total).
    - **FAIL(code_broken)** → escalate to main agent with full report; do not retry.
    - **ESCALATE** → escalate to main agent with full context.
    - **NEEDS_HUMAN_REVIEW** → relay PR comment and `needs-e2e-review` label action; accept result.
12. For multi-batch suites, complete one full batch (TestScaffold → TestReviewer → TestRunner PASS) before delegating the next batch.

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

## Pipeline Chain & Retry Rules

```
TestScaffold → TestReviewer → TestRunner → main agent
     ↑              |
     └──────────────┘
      REJECTED: max 3 retries total
     ↑
     └──── FAIL(test_wrong) also counts toward the same 3-retry cap
```

**Retry cap**: Each `REJECTED` from TestReviewer or `FAIL(test_wrong)` from TestRunner that sends back to TestScaffold increments the retry counter. After **3 total retries**, escalate to the main agent with the full chain history.

**Escalate to main agent when**:

- TestRunner returns `FAIL(code_broken)` — the implementation needs fixing, not the test
- TestRunner returns `ESCALATE` — tests hung and one-at-a-time recovery failed
- Retry counter reaches 3 — recurring issues need human judgment

**Accept and pass to main agent when**:

- TestRunner returns `PASS`
- TestRunner returns `NEEDS_HUMAN_REVIEW` — relay PR comment and `needs-e2e-review` label

## References

- `./references/delegation-runbook.md`
- `.github/agents/test-scaffold.agent.md`
- `.github/agents/test-reviewer.agent.md`
- `.github/agents/test-runner.agent.md`
- `.github/skills/playwright-e2e-workflow/SKILL.md`
- `docs/testing/README.md` - canonical Nx-aware testing guide
- `AGENTS.md`
