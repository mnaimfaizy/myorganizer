# Playwright E2E Patterns and Anti-Patterns

Code-level reference for MyOrganizer E2E specs. This is the **single home** for these patterns —
`SKILL.md` covers workflow and policy, `runbook.md` covers the flow matrix and selector rules,
and this file covers what the code must actually look like.

Read this before implementing a spec. Do not restate it in agent prompts or briefs.

---

## Playwright API boundaries

`page.waitForFunction()` and `page.evaluate()` execute in the **browser** context — only
browser-native APIs are available there. Playwright APIs are only available in test context.

```typescript
// ❌ Wrong — Playwright APIs are not available in browser context
await page.waitForFunction(() => page.locator('#input').isVisible());

// ✅ Correct — browser-native APIs only
await page.waitForFunction(() => !!document.querySelector('#input'));
```

---

## Context menus (Radix DropdownMenu)

Radix DropdownMenu triggers are hidden by default with Tailwind `opacity-0` and become visible on
`group-hover`. They are **not** native context menus.

```typescript
// ❌ Wrong — won't find the hidden button
await page.dispatchEvent('contextmenu');

// ✅ Correct — hover reveals the button, then click
async function openContextMenu(page, cardText) {
  const card = page.locator('xpath=//div[contains(., "' + cardText + '")]').first();
  await card.hover(); // reveals hidden buttons via group-hover
  const menuButton = card.locator('button').first(); // three-dot button
  await menuButton.click();
}
```

---

## Vault unlock (Firefox-compatible)

Vault decryption is asynchronous. Firefox requires explicit button clicks and extra delays; the
Enter key does not reliably submit.

```typescript
async function unlockWithPassphrase(page, passphrase) {
  await page.getByRole('button', { name: 'Use passphrase' }).click();

  // Try multiple selectors for robustness. The field appearing is the end of
  // the panel's transition — no sleep needed for Firefox's animation.
  let input = page.locator('#unlock-passphrase');
  if (!(await input.isVisible({ timeout: 5000 }).catch(() => false))) {
    input = page.locator('input[placeholder*="Security"]').first();
  }

  await input.scrollIntoViewIfNeeded();
  await input.click();
  await input.fill(passphrase);

  // No wait between fill and click. VaultGate renders inside DashboardGuard,
  // which returns null until its client effect resolves, so this panel being
  // on screen already proves React is driving it and onChange is bound.
  // ❌ `expect(input).toHaveValue(passphrase)` would NOT prove that: `fill`
  //    sets the DOM value itself, so the assertion passes either way.

  // ❌ Do NOT use input.press('Enter') — Firefox doesn't reliably submit
  // ✅ Click the button
  await page.getByRole('button', { name: /^Unlock$/i }).click();

  // Unlock is complete when the input disappears — not when the click resolves.
  // ❌ `isHidden({ timeout })` does not wait: it samples once and resolves.
  await expect(page.locator('#unlock-passphrase, input[placeholder*="Security"]')).toHaveCount(0, { timeout: 30000 });
}
```

For vault flows, the full unlock/lock cycle belongs in the preconditions of the flow matrix.

---

## Async component initialization

Vault init and Next.js hydration are client-side async. The network can be idle while React is
still initializing, so wait for **content**, not network state.

```typescript
// ❌ Wrong — network idle does not mean the UI is ready. Playwright marks
// `networkidle` DISCOURAGED, and it hangs against a production build.
await page.waitForLoadState('networkidle');

// ✅ Correct — assert the route has settled into one of the states it can
// reach. `.or()` keeps both legs in one auto-retrying web assertion.
await expect(page.getByRole('heading', { name: 'No items yet' }).or(page.getByRole('article').first()).first()).toBeVisible({ timeout: 30000 });
```

Reach for `waitForFunction` only when the condition is not expressible as a locator — reading
`localStorage`, say. It polls in browser context and reports failures far less usefully than
`expect`.

---

## Controlled inputs whose state lands after an await

`locator.check()` clicks and then verifies the checked state **once**, without retrying. That is
fine for a checkbox holding its own local state, and wrong for a controlled one whose `checked`
prop only flips after an awaited round-trip — every vault-backed toggle in this app, which
persists before it re-renders. Under WebKit the persist regularly outlives the verification, and
the test fails with `Clicking the checkbox did not change its state` on a click that in fact
worked (issue #557).

```typescript
// ❌ Wrong — one verification, no retry. Races the persist.
await checkbox.check();
await expect(checkbox).toBeChecked();

// ✅ Correct — click, then let the web assertion retry until the state lands.
await checkbox.click();
await expect(checkbox).toBeChecked({ timeout: 30000 });
```

The same applies to `uncheck()`; a second `click()` plus `not.toBeChecked()` replaces it.

---

## Waiting out a full page reload

A locator assertion cannot tell the pre-reload document from the post-reload one. When the app
calls `window.location.reload()` — `RemoveVaultCard` does, after removing a Vault — any wait for
persistent chrome is satisfied **immediately, by the doomed document**, and the next
`page.evaluate` races the navigation commit and dies with `Execution context was destroyed`
(issue #557).

Pin the current document, then wait for it to be gone. `waitForFunction` survives navigation and
re-evaluates in the new context, which is exactly the property needed here.

```typescript
// ❌ Wrong — this chrome is already on screen, so the wait returns before the reload commits.
await confirmButton.click();
await waitForDashboardReady(page);

// ✅ Correct — `waitForReload` (helpers/auth.ts) marks the document, runs the click,
// and resolves only once the marker is gone and the new shell has mounted.
await waitForReload(page, () => confirmButton.click());
```

---

## API mocking with CORS preflight

Mocked endpoints must handle `OPTIONS` (CORS preflight) or the test fails with CORS errors.

```typescript
await page.route(/\/auth\/login\/?(\?.*)?$/, async (route) => {
  const request = route.request();
  const origin = new URL(page.url() || 'http://localhost:3000').origin;

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

  await route.fulfill({
    status: 200,
    headers: { 'access-control-allow-origin': origin },
    contentType: 'application/json',
    body: JSON.stringify({ token: 'fake-jwt-token', expires_in: 3600, user: {} }),
  });
});
```

---

## Parallel execution resilience

Concurrent tests saturate the network, which is one more reason never to wait on it. A
`networkidle` ladder with a `domcontentloaded` fallback is not resilience — when the first leg
times out the test has already burned its budget waiting for something it never needed.

```typescript
// ❌ Wrong — waits 10s for a condition that says nothing about the page,
// then falls back to one that says almost nothing either.
try {
  await page.waitForLoadState('networkidle', { timeout: 10000 });
} catch {
  await page.waitForLoadState('domcontentloaded');
}

// ✅ Correct — name what the page must show. Under load this waits longer;
// on a quiet machine it returns as soon as the element is there.
await expect(page.getByTestId('export-vault-button')).toBeVisible({
  timeout: 60000,
});
```

### Hydration

A controlled React form drops values typed before hydration: `fill()` writes to the DOM, but
React state stays empty and the form submits blank. Neither `networkidle` nor a sleep observes
hydration. Probe it with an interaction whose visible result is pure client state, and retry the
click — a pre-hydration click is dropped. `waitForLoginFormInteractive` in
`apps/myorganizer-e2e/src/e2e/helpers/auth.ts` is the worked example.

```typescript
await expect(async () => {
  await toggle.click();
  await expect(password).toHaveAttribute('type', 'text', { timeout: 1000 });
}).toPass({ timeout: 30000 });
```

Tests running in parallel must also use deterministic fixtures with no shared state, and document
their network expectations in a test comment.

---

## Form-based flows (React Hook Form + Zod)

Production incidents traced to gaps between test expectations and component lifecycle. Verify the
component's form configuration before writing assertions.

### MyOrganizer form defaults

```typescript
// EditItemDialog pattern
const form = useForm<ItemData>({
  mode: 'onChange', // ← real-time validation; REQUIRED for save-button UX
  resolver: zodResolver(itemSchema),
  defaultValues: itemData,
});

// Parent ensures form state resets per item
<EditItemDialog
  key={editingItemId ?? 'none'} // ← forces remount per item; REQUIRED
  item={editingItem || null}
/>;

// Dialog resets defaults and re-runs validation on item change
useEffect(() => {
  if (item) {
    form.reset(itemData, { keepDirty: false, keepErrors: false });
    form.trigger();
  }
}, [item?.id, form]);

// Save button logic
<Button disabled={isLoading || !form.formState.isDirty || !form.formState.isValid}>Save</Button>;
```

### Pre-implementation checklist

Confirm from the component code (not from assumption):

- [ ] Form library and validation mode (`onChange` vs `onSubmit` vs `onBlur`)
- [ ] Remounting strategy (e.g. `key={itemId}` on dialogs)
- [ ] Form reset behavior — which `useEffect` dependencies trigger it
- [ ] Exact conditions under which each button enables/disables
- [ ] How and when validation errors become visible

### Pattern 1 — assert button state transitions explicitly

```typescript
it('should enable Save button when a valid field is modified', async () => {
  await page.click('[aria-label="Edit Item"]');
  await page.waitForSelector('[role="dialog"]');

  const saveButton = page.locator('button', { hasText: 'Save' });
  expect(await saveButton.isDisabled()).toBe(true); // not dirty yet

  await page.locator('input[placeholder="Item Name"]').fill('Updated Item');

  // ✅ Assert the transition — do not wait and hope
  await expect(saveButton).toBeEnabled({ timeout: 5000 });
});
```

### Pattern 2 — validation errors block submission

```typescript
it('should prevent save when a required field is empty', async () => {
  await page.click('[aria-label="Edit Item"]');
  await page.waitForSelector('[role="dialog"]');

  await page.locator('input[aria-label="Item Name *"]').fill('');

  await expect(page.locator('text=/Item name is required/')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('button', { hasText: 'Save' })).toBeDisabled();
});
```

### Pattern 3 — form resets when switching items

```typescript
it('should reset the form when editing a different item', async () => {
  await page.click('[aria-label="Edit Item 1"]');
  await page.waitForSelector('[role="dialog"]');
  await page.locator('input[placeholder="Item Name"]').fill('Modified Name');
  await page.click('button:has-text("Save")');
  await page.waitForSelector('[role="dialog"]', { state: 'hidden' });

  await page.click('[aria-label="Edit Item 2"]');
  await page.waitForSelector('[role="dialog"]');

  // ✅ Fresh defaultValues for item 2, not the modified name
  expect(await page.locator('input[placeholder="Item Name"]').inputValue()).toBe('Item 2 Original Name');
});
```

### Pattern 4 — explicit form-state helpers

Prefer named helpers with explicit conditions over arbitrary waits.

```typescript
async function waitForFormValid(page: Page, timeout = 5000) {
  await expect(page.locator('button[type="submit"]:not(:disabled)')).toBeEnabled({ timeout });
}

async function waitForFormInvalid(page: Page, timeout = 5000) {
  await expect(page.locator('button[type="submit"]')).toBeDisabled({ timeout });
}
```

### Debugging form state

When a button doesn't change state as expected:

1. **Do NOT try different interaction patterns** (keyboard vs `fill` vs selectAll+type) — that is
   the wrong layer. Stop and investigate component architecture instead.
2. Check: does the dialog remount per item (`key={itemId}`)? Does `form.reset()` run on item
   change? Is `mode: 'onChange'` set?
3. Add debug output before concluding an interaction is correct:
   - `await page.screenshot({ path: 'dialog.png' })`
   - `console.log('Save disabled:', await button.isDisabled())`
   - `expect(page.locator('[aria-invalid="true"]')).toBeVisible()`

### Early error detection

1. Verify the test reaches the first form assertion (dialog opens, fields visible) before writing
   all remaining steps.
2. After filling fields, assert button state **before** attempting to click it.

---

## Cross-browser considerations

| Browser  | What to account for                                                                                                         |
| -------- | --------------------------------------------------------------------------------------------------------------------------- |
| Chromium | Baseline. Fastest; least forgiving of arbitrary timeouts hiding real races.                                                 |
| Firefox  | Keyboard events may not submit forms — click buttons explicitly. Assert the state change; do not sleep before asserting it. |
| WebKit   | Timing differs; be generous with assertion timeouts — never with sleeps.                                                    |
| All      | Use role-based selectors; never rely on incidental Tailwind/CSS classes.                                                    |

Run on all three browsers before marking an E2E change complete.

---

## Anti-pattern table

| Anti-pattern                                               | Why it's wrong                                                                                | Correct approach                                                                   |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Using `role="button"` for non-buttons                      | Semantic HTML violation; breaks accessibility                                                 | Use `role="article"` / `role="listitem"` for cards                                 |
| `input.press('Enter')` for form submission                 | Firefox doesn't reliably trigger it                                                           | Explicitly click the submit button                                                 |
| `page.locator()` inside `waitForFunction()`                | Browser context has no Playwright APIs                                                        | Use `document` APIs only in browser context                                        |
| Assuming standard HTML context menus                       | Radix DropdownMenu is not native; buttons are hidden                                          | Hover + click                                                                      |
| `waitForLoadState('networkidle')` anywhere                 | DISCOURAGED by Playwright; misses client-side async, and hangs against a production build     | Assert what the page must show                                                     |
| A `networkidle` → `domcontentloaded` fallback ladder       | Burns the timeout budget on a condition nothing needs                                         | One `expect(locator)` with a generous timeout                                      |
| `locator.isHidden({ timeout })` to wait for removal        | `isHidden` samples once and resolves; Playwright marks the timeout deprecated and ignores it  | `await expect(locator).toHaveCount(0, { timeout })`                                |
| `locator.isVisible({ timeout })` to wait for appearance    | Identical no-op — it never waits, so it races the render                                      | Assert the page has settled, then branch on it                                     |
| `expect(input).toHaveValue(v)` after `fill(v)`             | `fill` sets the DOM value, so it is true either way — it does not prove React state took      | Under `/dashboard/*` no wait is needed; on a server-rendered form, probe hydration |
| Testing on one browser only                                | Firefox and WebKit have different patterns                                                    | Test on all three                                                                  |
| Not mocking CORS preflight                                 | Tests fail with CORS errors                                                                   | Handle `OPTIONS` in route mocks                                                    |
| Arbitrary `page.waitForTimeout()` delays                   | Hides real races; flakes under load                                                           | Wait for explicit state changes                                                    |
| Changing interaction method when a button won't enable     | Wrong layer — it's component architecture                                                     | Investigate remount / reset / form mode                                            |
| Assuming `defaultValues` are fresh after a dialog reopens  | Stale form state carries over                                                                 | Verify `key={itemId}` or reset `useEffect`                                         |
| Asserting retry / concurrency / timeout behavior           | The UI usually doesn't implement it                                                           | Only test behavior the flow exposes                                                |
| `locator.check()` on a checkbox persisted through an await | Its state verification does not retry, so it races the round-trip that flips `checked`        | `click()`, then `expect(...).toBeChecked({ timeout })`                             |
| Waiting for persistent chrome after `location.reload()`    | The pre-reload document already satisfies it; the next `evaluate` loses its execution context | `waitForReload(page, () => trigger())`                                             |
