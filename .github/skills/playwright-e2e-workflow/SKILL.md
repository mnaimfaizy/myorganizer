---
name: playwright-e2e-workflow
description: 'Use when adding or changing Playwright end-to-end tests, validating critical user flows, or updating browser automation in MyOrganizer. Build a behavior-first flow matrix, keep browser specs deterministic, and delegate implementation to TestScaffold only with a precise E2E brief.'
---

# Playwright E2E Workflow

Policy: [`docs/adr/0012-tiered-quality-gates.md`](../../../docs/adr/0012-tiered-quality-gates.md) — classify `gate:*` before choosing hops.

## Use This Skill When

- Adding or changing Playwright tests in `apps/myorganizer-e2e`
- Validating critical route flows after frontend or auth changes
- Debugging browser behavior that is hard to cover with unit tests alone

## Gate tier routing

| Gate              | Path                                                                                                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gate:mechanical` | Selector/string-only fix; flow matrix unchanged → main agent may edit directly; no E2EPlanner; still do not execute E2E in AFK                                       |
| `gate:standard`   | Behavior/assertion change with unchanged high-level flow → TestScaffold + TestReviewer (structural); **skip E2EPlanner** when the existing flow matrix still applies |
| `gate:full`       | New flow or matrix change → **E2EPlanner → TestScaffold → TestReviewer (structural)**                                                                                |

Canonical chain when planning is required: **E2EPlanner → TestScaffold → TestReviewer (structural only)**. Never execute Playwright autonomously in Sandcastle.

## Autonomous Agent Execution Policy

**In autonomous contexts (sandcastle, CI without a human in the loop), E2E tests must never be executed:**

- DO NOT run `yarn nx e2e myorganizer-e2e`. Playwright requires browser, server, and human visual verification.
- After TestScaffold completes, delegate to TestReviewer in structural-only mode (`tsc --noEmit` + `eslint` + selector/API rule check).
- TestReviewer will return `E2E_NEEDS_HUMAN_REVIEW: true`.
- Post a PR comment: _"E2E tests written but not executed — requires human verification before merge. Run: `yarn nx e2e myorganizer-e2e`"_
- Apply label `needs-e2e-review` to the PR.

**In human-in-the-loop sessions (interactive, human present), follow the full procedure below (and execute browsers only when the human is present).**

## Critical Prerequisites (Before Planning)

Verify these before starting E2E planning — if not met, recommend a PR to complete them first:

1. ✅ **Component implementation is complete** — The UI should work end-to-end manually
2. ✅ **All interactive elements have semantic roles** — No role/selector conflicts
3. ✅ **API contracts are stable** — Endpoints defined, mocks available for testing
4. ✅ **Vault architecture documented** — For vault-backed features, confirm unlock/encrypt patterns

## Core Rules

- Test user-visible flows and use stable selectors or user-facing queries.
- Start from actual route/page implementation in `libs/web/pages/<route>`, NOT a generic template.
- Read the component code to understand interactive patterns (Radix UI, hidden states, async operations).
- Build a compact flow matrix BEFORE writing or delegating a spec.
- Keep fixtures deterministic and test scope narrow.
- Account for browser-specific patterns (Firefox keyboard handling, WebKit timing, Chromium baseline).
- Do not depend on live Google, email, or other third-party services.
- Do not commit traces, screenshots, or other generated artifacts unless intentionally part of the change.
- Do not test retry, recovery, timeout, or concurrency behavior unless the app actually exposes that behavior in the user flow.

## Procedure

1. **Start from the smallest affected user journey**, not the whole app.
2. **Read component code** — Inspect the actual component in `libs/web/pages/<route>` to understand:
   - Which interactive elements have semantic roles
   - Which elements are hidden by default (Radix DropdownMenu, hidden inputs, etc.)
   - Which interactions are async (vault operations, API calls)
   - Which patterns use Radix UI vs standard HTML
3. **Build a flow matrix** with preconditions, steps, selectors, network expectations, side effects, and unsupported behavior.
4. **If planning is needed**, use `E2EPlanner` first with component inspection, then hand its **whole output** to `TestScaffold` — the plan is the handoff contract, and TestScaffold implements from it rather than re-reading the route. Without a plan, give TestScaffold a completed flow matrix and the target spec path.
   - A `data-testid` that the plan lists under `Selectors required` is an approved production change. TestScaffold must not invent one; if it needs a selector the plan does not provide, it returns `BLOCKED`.
   - `Open questions` in the plan carry a stated working assumption. Resolve them with the human before implementation when the assumption changes what gets asserted.
5. **Keep the test deterministic and focused** on the changed behavior.
6. **Test on all browsers** during implementation — run on Chromium, Firefox, and WebKit before marking as complete.
7. **Use `yarn nx e2e myorganizer-e2e --ui`** only when the normal run is not enough to debug.
8. **Follow the detailed [Playwright e2e runbook](./references/runbook.md)** for selector rules, mocking boundaries, validation, and repo references.

## References

| Need                                                                                                                                                                                         | Read                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Flow matrix, selector/fixture rules, change workflow, validation                                                                                                                             | [`references/runbook.md`](./references/runbook.md)           |
| Code-level patterns and anti-patterns: Radix context menus, vault unlock, async content waits, CORS preflight mocking, parallel resilience, React Hook Form flows, cross-browser differences | [`references/e2e-patterns.md`](./references/e2e-patterns.md) |
| Nx project tooling: config, file naming, commands                                                                                                                                            | `docs/testing/projects/e2e.md`                               |

`references/e2e-patterns.md` is the **single home** for E2E code patterns. Do not copy them into
agent prompts, briefs, or `docs/testing` — link to it instead.

## Review Checklist

- [ ] Pre-planning validation completed (component ready, APIs stable, roles defined)
- [ ] Component code was read to understand interactive patterns
- [ ] The spec covers a real user-visible flow and not implementation-only behavior
- [ ] Selectors use roles, labels, text, or stable test ids justified by the flow
- [ ] Fixtures, auth, vault unlock state, and network boundaries are deterministic
- [ ] Cross-browser patterns are documented (Firefox keyboard handling, WebKit timing, etc.)
- [ ] The test avoids live third-party services and API mocking includes CORS preflight
- [ ] Unsupported retry/concurrency/timing behavior is not asserted
- [ ] Tests pass on Chromium, Firefox, AND WebKit before marking complete
- [ ] No traces, screenshots, videos, or generated artifacts are committed accidentally
- [ ] A focused or full E2E command was run on all browsers, or a clear reason is recorded
