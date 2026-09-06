# Playwright E2E Runbook

## Scope Boundary

- Favor the smallest user journey that can falsify the change.
- Extend an existing focused test before adding a broad new suite when possible.
- Trace the actual route and page implementation before writing steps.
- Do not generate generic login/navigation scripts without verifying the current UI and selectors.

## Flow Matrix

Before writing or delegating a Playwright spec, define:

| Area                  | Required detail                                                      |
| --------------------- | -------------------------------------------------------------------- |
| Route and entry point | URL, route wrapper, page library                                     |
| Preconditions         | auth state, seeded data, vault unlock state                          |
| User steps            | action and expected result per step                                  |
| Selectors             | role/label/text selector or justified stable test id                 |
| Network/data          | intercept, seed, or passthrough decision                             |
| Side effects          | persisted state, navigation, API call, or visible status             |
| Unsupported behavior  | retry, concurrency, timeout, or third-party behavior not implemented |

## Selector And Fixture Rules

- Use stable selectors or user-facing queries.
- Avoid selectors tied to Tailwind classes, animation wrappers, or incidental DOM nesting.
- Keep fixtures deterministic.
- Do not rely on live Google OAuth, real email delivery, or external APIs.

## Change Workflow

1. Identify the user-facing flow changed by the code edit.
2. Read the route wrapper and owning page/component implementation to confirm selectors and states.
3. Mock or seed whatever data is required so the test can run without third-party dependencies.
4. Keep the assertion surface narrow and behavior-oriented.
5. If the change touches auth, vault, or YouTube flows, isolate the external boundary and keep the browser test deterministic.
6. If implementation is delegated, pass the completed flow matrix to `TestScaffold` and require duplicate/artifact checks before reporting success.

## Checkpoints

- If the test depends on live third-party behavior, redesign it.
- If the selector strategy depends on layout-only DOM shape, redesign it.
- If a test asserts retry, recovery, timeout, or concurrency behavior that the UI does not implement, remove it.
- If setup requires manual local state, redesign it with deterministic seed/intercept fixtures.
- If a route or workflow changed materially and no e2e validation was considered, the task may be incomplete.

## Validation

- `yarn nx e2e myorganizer-e2e`
- `yarn nx e2e myorganizer-e2e --ui`
- Use cross-browser targets only when the change justifies wider coverage.
- Verify no generated traces, screenshots, videos, or downloaded artifacts are left in the worktree unless intentionally committed.

## Repo References

- `apps/myorganizer-e2e/AGENTS.md`
- `apps/myorganizer-e2e/playwright.config.ts`
- `.github/copilot-instructions.md`
- `README.md`
