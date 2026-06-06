---
name: playwright-e2e-workflow
description: 'Use when adding or changing Playwright end-to-end tests, validating critical user flows, or updating browser automation in MyOrganizer. Build a behavior-first flow matrix, keep browser specs deterministic, and delegate implementation to TestScaffold only with a precise E2E brief.'
---

# Playwright E2E Workflow

## Use This Skill When

- Adding or changing Playwright tests in `apps/myorganizer-e2e`
- Validating critical route flows after frontend or auth changes
- Debugging browser behavior that is hard to cover with unit tests alone

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
4. **If planning is needed**, use `E2EPlanner` first with component inspection; if implementation is needed, delegate to `TestScaffold` with the completed flow matrix and target spec path.
5. **Keep the test deterministic and focused** on the changed behavior.
6. **Test on all browsers** during implementation — run on Chromium, Firefox, and WebKit before marking as complete.
7. **Use `yarn nx e2e myorganizer-e2e --ui`** only when the normal run is not enough to debug.
8. **Follow the detailed [Playwright e2e runbook](./references/runbook.md)** for selector rules, mocking boundaries, validation, and repo references.

## Common Patterns from Production Tests

### API Mocking with CORS Preflight

```typescript
// Mock /auth/login endpoint with CORS preflight support
await page.route(/\/auth\/login\/?(\?.*)?$/, async (route) => {
  const request = route.request();
  const origin = new URL(page.url() || 'http://localhost:3000').origin;

  // Handle CORS preflight (OPTIONS)
  if (request.method() === 'OPTIONS') {
    await route.fulfill({
      status: 204,
      headers: {
        'access-control-allow-origin': origin,
        'access-control-allow-credentials': 'true',
        'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        'access-control-allow-headers': 'content-type,authorization,if-match',
      },
    });
    return;
  }

  // Return mock response
  await route.fulfill({
    status: 200,
    headers: { 'access-control-allow-origin': origin },
    contentType: 'application/json',
    body: JSON.stringify({ token: 'fake-jwt-token', expires_in: 3600, user: {...} }),
  });
});
```

### Vault Unlock Pattern (Firefox-Compatible)

```typescript
// Do NOT use input.press('Enter') in Firefox — explicitly click button
async function unlockWithPassphrase(page, passphrase) {
  // Click "Use passphrase" button (Firefox needs time for animations)
  await page.getByRole('button', { name: 'Use passphrase' }).click();
  await page.waitForTimeout(1000); // Firefox animation delay

  // Find passphrase input (try multiple selectors for robustness)
  let input = page.locator('#unlock-passphrase');
  if (!(await input.isVisible({ timeout: 5000 }).catch(() => false))) {
    input = page.locator('input[placeholder*="Security"]').first();
  }

  // Fill input with focus
  await input.scrollIntoViewIfNeeded();
  await input.click();
  await page.waitForTimeout(300);
  await input.fill(passphrase);

  // Explicitly click Unlock button (not Enter key)
  await page.getByRole('button', { name: /^Unlock$/i }).click();
  await page.waitForTimeout(500);

  // Wait for input to disappear (unlock complete)
  await page.locator('#unlock-passphrase, input[placeholder*="Security"]').first().isHidden({ timeout: 30000 });
}
```

### Context Menu Pattern (Radix DropdownMenu)

```typescript
// For Radix DropdownMenu hidden by default (opacity-0), use hover + click
async function openContextMenu(page, cardText) {
  const card = page.locator('xpath=//div[contains(., "' + cardText + '")]').first();
  await card.hover(); // Reveals hidden buttons via group-hover
  const menuButton = card.locator('button').first(); // Three-dot button
  await menuButton.click();
}
```

### Async Vault Content Waits

```typescript
// Do NOT rely on networkidle for vault operations — use content waits
// Vault initialization is client-side async, not network-dependent
await page.waitForFunction(
  () => {
    // Check for actual UI content (empty state or list items)
    const emptyState = document.querySelector('h2')?.textContent?.includes('No items yet');
    const items = document.querySelectorAll('div[role="article"]').length > 0;
    return emptyState || items;
  },
  { timeout: 30000 },
);
```

### Parallel Execution Network Resilience

```typescript
// In parallel test suites, strict networkidle waits block all tests
// Use fallback strategy instead
try {
  await page.waitForLoadState('networkidle', { timeout: 10000 });
} catch {
  // Fallback for concurrent test execution
  try {
    await page.waitForLoadState('domcontentloaded');
  } catch {
    // Continue — page might be ready enough
  }
}
```

## Anti-Patterns to Avoid

❌ **Assuming standard HTML context menus** — Radix DropdownMenu is not a native context menu; use hover + click pattern  
❌ **Using `input.press('Enter')` for form submission** — Firefox doesn't reliably trigger it; click the button instead  
❌ **Calling `page.locator()` inside `page.waitForFunction()`** — Browser context only allows native APIs (`document`, `window`, etc.)  
❌ **Using `role="button"` for non-button elements** — Creates semantic HTML violations; use `role="article"` or `role="listitem"`  
❌ **Relying on `waitForLoadState('networkidle')` for vault operations** — Vault initialization is client-side async; use content waits  
❌ **Running strict networkidle waits in parallel test suites** — Use timeout + fallback strategy instead  
❌ **Not testing on all browsers** — Firefox and WebKit have different patterns; test during implementation, not after  
❌ **Trying different interaction patterns (keyboard vs fill methods) when form buttons don't enable** — Wrong layer; issue is likely component architecture (remounting, form reset, form mode), not the test approach  
❌ **Using arbitrary `page.waitForTimeout()` delays** — Wait for explicit form state changes: button enable/disable, validation errors appear, element visibility changes  
❌ **Not verifying form state transitions explicitly** — Test that buttons become enabled/disabled at expected times; add assertions for form isDirty/isValid if testing form library behavior  
❌ **Assuming form defaultValues are fresh after dialog reopens** — Verify component uses `key={itemId}` or `useEffect` to reset form on item change  
❌ **Not testing component lifecycle** — Dialogs/modals that edit items must reset form state when switching items; add tests for this interaction pattern

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
