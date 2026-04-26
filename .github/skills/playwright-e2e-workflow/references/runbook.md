# Playwright E2E Runbook

## Scope Boundary

- Favor the smallest user journey that can falsify the change.
- Extend an existing focused test before adding a broad new suite when possible.

## Selector And Fixture Rules

- Use stable selectors or user-facing queries.
- Avoid selectors tied to Tailwind classes, animation wrappers, or incidental DOM nesting.
- Keep fixtures deterministic.
- Do not rely on live Google OAuth, real email delivery, or external APIs.

## Change Workflow

1. Identify the user-facing flow changed by the code edit.
2. Mock or seed whatever data is required so the test can run without third-party dependencies.
3. Keep the assertion surface narrow and behavior-oriented.
4. If the change touches auth, vault, or YouTube flows, isolate the external boundary and keep the browser test deterministic.

## Checkpoints

- If the test depends on live third-party behavior, redesign it.
- If the selector strategy depends on layout-only DOM shape, redesign it.
- If a route or workflow changed materially and no e2e validation was considered, the task may be incomplete.

## Validation

- `yarn nx e2e myorganizer-e2e`
- `yarn nx e2e myorganizer-e2e --ui`
- Use cross-browser targets only when the change justifies wider coverage.

## Repo References

- `apps/myorganizer-e2e/AGENTS.md`
- `apps/myorganizer-e2e/playwright.config.ts`
- `.github/copilot-instructions.md`
- `README.md`
