---
name: playwright-e2e-workflow
description: 'Use when adding or changing Playwright end-to-end tests, validating critical user flows, or updating browser automation in MyOrganizer.'
---

# Playwright E2E Workflow

## Use This Skill When

- Adding or changing Playwright tests in `apps/myorganizer-e2e`
- Validating critical route flows after frontend or auth changes
- Debugging browser behavior that is hard to cover with unit tests alone

## Core Rules

- Test user-visible flows and use stable selectors or user-facing queries.
- Keep fixtures deterministic.
- Do not depend on live Google, email, or other third-party services.
- Do not commit traces, screenshots, or other generated artifacts unless they are intentionally part of the change.

## Procedure

1. Start from the smallest affected user journey, not the whole app.
2. Keep the test deterministic and focused on the changed behavior.
3. Use `yarn nx e2e myorganizer-e2e --ui` only when the normal run is not enough to debug the issue.
4. Follow the detailed [Playwright e2e runbook](./references/runbook.md) for selector rules, mocking boundaries, validation, and repo references.
