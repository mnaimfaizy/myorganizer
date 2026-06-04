---
name: playwright-e2e-workflow
description: 'Use when adding or changing Playwright end-to-end tests, validating critical user flows, or updating browser automation in MyOrganizer. Build a behavior-first flow matrix, keep browser specs deterministic, and delegate implementation to TestScaffold only with a precise E2E brief.'
---

# Playwright E2E Workflow

## Use This Skill When

- Adding or changing Playwright tests in `apps/myorganizer-e2e`
- Validating critical route flows after frontend or auth changes
- Debugging browser behavior that is hard to cover with unit tests alone

## Core Rules

- Test user-visible flows and use stable selectors or user-facing queries.
- Start from actual route/page implementation, not a generic browser-test template.
- Build a compact flow matrix before writing or delegating a spec.
- Keep fixtures deterministic.
- Keep scope narrow: one user journey should prove the changed behavior.
- Do not depend on live Google, email, or other third-party services.
- Do not commit traces, screenshots, or other generated artifacts unless they are intentionally part of the change.
- Do not test retry, recovery, timeout, or concurrency behavior unless the app actually exposes that behavior in the user flow.

## Procedure

1. Start from the smallest affected user journey, not the whole app.
2. Trace the route wrapper into the owning `libs/web/pages/<route>` implementation and note auth, vault, API, and setup requirements.
3. Build a flow matrix with preconditions, steps, selectors, network expectations, side effects, and unsupported behavior.
4. If planning is needed, use `E2EPlanner` first; if implementation is needed, delegate to `TestScaffold` with the completed flow matrix and target spec path.
5. Keep the test deterministic and focused on the changed behavior.
6. Use `yarn nx e2e myorganizer-e2e --ui` only when the normal run is not enough to debug the issue.
7. Follow the detailed [Playwright e2e runbook](./references/runbook.md) for selector rules, mocking boundaries, validation, and repo references.

## Review Checklist

- [ ] The spec covers a real user-visible flow and not implementation-only behavior.
- [ ] Selectors use roles, labels, text, or stable test ids justified by the flow.
- [ ] Fixtures, auth, vault unlock state, and network boundaries are deterministic.
- [ ] The test avoids live third-party services.
- [ ] Unsupported retry/concurrency/timing behavior is not asserted.
- [ ] No traces, screenshots, videos, or generated artifacts are committed accidentally.
- [ ] A focused or full E2E command was run, or a clear reason is recorded.
