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
  await page.waitForTimeout(1000); // Firefox animation delay

  // Try multiple selectors for robustness
  let input = page.locator('#unlock-passphrase');
  if (!(await input.isVisible({ timeout: 5000 }).catch(() => false))) {
    input = page.locator('input[placeholder*="Security"]').first();
  }

  await input.scrollIntoViewIfNeeded();
  await input.click();
  await page.waitForTimeout(300);
  await input.fill(passphrase);

  // ❌ Do NOT use input.press('Enter') — Firefox doesn't reliably submit
  // ✅ Click the button
  await page.getByRole('button', { name: /^Unlock$/i }).click();

  // Unlock is complete when the input disappears — not when the click resolves
  await page.locator('#unlock-passphrase, input[placeholder*="Security"]').first().isHidden({ timeout: 30000 });
}
```

For vault flows, the full unlock/lock cycle belongs in the preconditions of the flow matrix.

---

## Async component initialization

Vault init and Next.js hydration are client-side async. The network can be idle while React is
still initializing, so wait for **content**, not network state.

```typescript
// ❌ Wrong — network idle does not mean the UI is ready
await page.waitForLoadState('networkidle');

// ✅ Correct — wait for actual content
await page.waitForFunction(
  () => {
    const emptyState = document.querySelector('h2')?.textContent?.includes('No items yet');
    const items = document.querySelectorAll('div[role="article"]').length > 0;
    return emptyState || items;
  },
  { timeout: 30000 },
);
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

Concurrent tests saturate the network, so a strict `networkidle` wait blocks the whole suite.

```typescript
// ✅ Timeout + fallback
try {
  await page.waitForLoadState('networkidle', { timeout: 10000 });
} catch {
  try {
    await page.waitForLoadState('domcontentloaded');
  } catch {
    // Continue — the page is ready enough
  }
}
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

| Browser  | What to account for                                                                                                                  |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Chromium | Baseline. Fastest; least forgiving of arbitrary timeouts hiding real races.                                                          |
| Firefox  | Keyboard events may not submit forms — click buttons explicitly. Add delay after state changes before asserting button enable state. |
| WebKit   | Timing differs; be generous with timeouts.                                                                                           |
| All      | Use role-based selectors; never rely on incidental Tailwind/CSS classes.                                                             |

Run on all three browsers before marking an E2E change complete.

---

## Anti-pattern table

| Anti-pattern                                              | Why it's wrong                                       | Correct approach                                   |
| --------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------- |
| Using `role="button"` for non-buttons                     | Semantic HTML violation; breaks accessibility        | Use `role="article"` / `role="listitem"` for cards |
| `input.press('Enter')` for form submission                | Firefox doesn't reliably trigger it                  | Explicitly click the submit button                 |
| `page.locator()` inside `waitForFunction()`               | Browser context has no Playwright APIs               | Use `document` APIs only in browser context        |
| Assuming standard HTML context menus                      | Radix DropdownMenu is not native; buttons are hidden | Hover + click                                      |
| `waitForLoadState('networkidle')` for async React         | Client-side async (vault, hydration) isn't captured  | Content-based `waitForFunction()`                  |
| Strict `networkidle` in parallel suites                   | Network saturation blocks all tests                  | Timeout + fallback strategy                        |
| Testing on one browser only                               | Firefox and WebKit have different patterns           | Test on all three                                  |
| Not mocking CORS preflight                                | Tests fail with CORS errors                          | Handle `OPTIONS` in route mocks                    |
| Arbitrary `page.waitForTimeout()` delays                  | Hides real races; flakes under load                  | Wait for explicit state changes                    |
| Changing interaction method when a button won't enable    | Wrong layer — it's component architecture            | Investigate remount / reset / form mode            |
| Assuming `defaultValues` are fresh after a dialog reopens | Stale form state carries over                        | Verify `key={itemId}` or reset `useEffect`         |
| Asserting retry / concurrency / timeout behavior          | The UI usually doesn't implement it                  | Only test behavior the flow exposes                |
