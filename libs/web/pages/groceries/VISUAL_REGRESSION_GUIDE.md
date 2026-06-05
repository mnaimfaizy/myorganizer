# Groceries Page — Visual Regression Testing Guide (Phase 5)

**Date:** 2026-06-05  
**Framework:** Playwright  
**Repository:** apps/myorganizer-e2e  
**Status:** IMPLEMENTATION PLAN

---

## Overview

Visual regression testing ensures UI changes don't accidentally break layouts, colors, or spacing. This guide implements snapshot-based testing using Playwright's built-in screenshot comparison.

---

## Test Strategy

### Covered Scenarios

1. **Desktop Layout** (1024px+)
   - Main page with empty state
   - Main page with lists populated
   - List item hover states
   - Dialog open states (all 3 types)

2. **Mobile Layout** (375px)
   - Main page responsive layout
   - Touch-friendly spacing
   - Dialog full-width adaptation
   - Empty state mobile view

3. **Interactive States**
   - Focus indicators on buttons
   - Loading state skeletons
   - Error state banner
   - Disabled button states

4. **Dark Mode** (if implemented)
   - Color palette verification
   - Contrast maintenance
   - Icon visibility

---

## Playwright Visual Testing

### Setup

The tests are located in: `apps/myorganizer-e2e/src/e2e/groceries.spec.ts`

**Key Playwright API:**

```typescript
// Capture full page screenshot
await page.screenshot({ path: 'full-page.png' });

// Capture specific element
await page.locator('[role="dialog"]').screenshot({ path: 'dialog.png' });

// Compare with baseline
await expect(page).toHaveScreenshot('groceries-empty-state.png');
```

### Running Tests

```bash
# Run visual tests only
yarn nx e2e myorganizer-e2e --testNamePattern="Visual"

# Update baselines (after intentional UI changes)
yarn nx e2e myorganizer-e2e -- --update-snapshots

# Run specific test
yarn nx e2e myorganizer-e2e --testNamePattern="Empty state"
```

---

## Visual Test Cases

### Test 1: Empty State (Desktop)

**File:** `apps/myorganizer-e2e/src/e2e/groceries.spec.ts`

**Test Code:**

```typescript
test.describe('V1 — Visual Regression (Desktop)', () => {
  test('Empty state displays correctly', async ({ page }, testInfo) => {
    test.setTimeout(120000);

    // Setup (same as keyboard tests)
    await login(page, {
      webkitDelayMs: testInfo.project.name === 'webkit' ? 1500 : 0,
    });
    await gotoStable(page, '/dashboard/addresses');
    await page.fill('#setup-passphrase', passphrase);
    await page.fill('#setup-confirm', passphrase);
    await page.getByRole('button', { name: 'Create encrypted vault' }).click();
    await page.waitForFunction(() => Boolean(window.localStorage.getItem('myorganizer_vault_v1')), undefined, { timeout: 60000 });
    await gotoGroceriesAndUnlock(page, passphrase);

    // Capture full page
    await expect(page).toHaveScreenshot('groceries-empty-state-desktop.png', {
      maxDiffPixels: 100, // Allow 100 pixels difference (anti-alias tolerance)
    });

    // Capture empty state container specifically
    await expect(page.locator('[role=\"status\"]')).toHaveScreenshot('groceries-empty-state-container.png');
  });
});
```

---

### Test 2: Populated List (Desktop)

**Test Code:**

```typescript
test('List with items displays correctly', async ({ page }, testInfo) => {
  test.setTimeout(120000);

  // Setup and login
  await login(page, {
    webkitDelayMs: testInfo.project.name === 'webkit' ? 1500 : 0,
  });

  // Create vault
  await gotoStable(page, '/dashboard/addresses');
  await page.fill('#setup-passphrase', passphrase);
  await page.fill('#setup-confirm', passphrase);
  await page.getByRole('button', { name: 'Create encrypted vault' }).click();
  await page.waitForFunction(() => Boolean(window.localStorage.getItem('myorganizer_vault_v1')), undefined, { timeout: 60000 });

  // Go to groceries and create lists
  await gotoGroceriesAndUnlock(page, passphrase);

  // Create first list
  await page.getByRole('button', { name: 'New List' }).click();
  await page.waitForFunction(() => Boolean(document.querySelector('[role=\"dialog\"]')), undefined, { timeout: 5000 });
  await page.fill('input[type="text"]', 'Weekly Shopping');
  await page.getByRole('button', { name: 'Create List' }).click();
  await page.waitForTimeout(500);

  // Create second list
  await page.getByRole('button', { name: 'New List' }).click();
  await page.waitForFunction(() => Boolean(document.querySelector('[role=\"dialog\"]')), undefined, { timeout: 5000 });
  await page.fill('input[type="text"]', 'Monthly Staples');
  await page.getByRole('button', { name: 'Create List' }).click();
  await page.waitForTimeout(1000);

  // Capture lists view
  await expect(page).toHaveScreenshot('groceries-with-lists-desktop.png', {
    maxDiffPixels: 150, // Lists may vary slightly
  });

  // Capture list items specifically
  await expect(page.locator('[role=\"article\"]').first()).toHaveScreenshot('groceries-list-item-desktop.png');
});
```

---

### Test 3: Dialog States (Desktop)

**Test Code:**

```typescript
test('Create dialog renders correctly', async ({ page }, testInfo) => {
  test.setTimeout(120000);

  // Setup and navigate
  await login(page, {
    webkitDelayMs: testInfo.project.name === 'webkit' ? 1500 : 0,
  });
  await gotoStable(page, '/dashboard/addresses');
  await page.fill('#setup-passphrase', passphrase);
  await page.fill('#setup-confirm', passphrase);
  await page.getByRole('button', { name: 'Create encrypted vault' }).click();
  await page.waitForFunction(() => Boolean(window.localStorage.getItem('myorganizer_vault_v1')), undefined, { timeout: 60000 });
  await gotoGroceriesAndUnlock(page, passphrase);

  // Open create dialog
  await page.getByRole('button', { name: 'New List' }).click();
  await page.waitForFunction(() => Boolean(document.querySelector('[role=\"dialog\"]')), undefined, { timeout: 5000 });

  // Capture dialog
  await expect(page.locator('[role=\"dialog\"]')).toHaveScreenshot('groceries-create-dialog-desktop.png');

  // Type something to show character counter
  await page.fill('input[type=\"text\"]', 'My Shopping');
  await page.waitForTimeout(300);

  // Capture dialog with input filled
  await expect(page.locator('[role=\"dialog\"]')).toHaveScreenshot('groceries-create-dialog-filled-desktop.png');
});
```

---

### Test 4: Mobile Layout (375px)

**Test Code:**

```typescript
test.describe('V2 — Visual Regression (Mobile)', () => {
  test('Empty state mobile layout', async ({ page }, testInfo) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Setup (same as other tests)
    await login(page, {
      webkitDelayMs: testInfo.project.name === 'webkit' ? 1500 : 0,
    });
    await gotoStable(page, '/dashboard/addresses');
    await page.fill('#setup-passphrase', passphrase);
    await page.fill('#setup-confirm', passphrase);
    await page.getByRole('button', { name: 'Create encrypted vault' }).click();
    await page.waitForFunction(
      () => Boolean(window.localStorage.getItem('myorganizer_vault_v1')),\n      undefined,
      { timeout: 60000 },
    );
    await gotoGroceriesAndUnlock(page, passphrase);

    // Capture mobile empty state
    await expect(page).toHaveScreenshot('groceries-empty-state-mobile.png');
  });

  test('Dialog on mobile (full width)', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // Setup
    await login(page, {
      webkitDelayMs: testInfo.project.name === 'webkit' ? 1500 : 0,
    });
    await gotoStable(page, '/dashboard/addresses');
    await page.fill('#setup-passphrase', passphrase);
    await page.fill('#setup-confirm', passphrase);
    await page.getByRole('button', { name: 'Create encrypted vault' }).click();
    await page.waitForFunction(
      () => Boolean(window.localStorage.getItem('myorganizer_vault_v1')),
      undefined,
      { timeout: 60000 },
    );
    await gotoGroceriesAndUnlock(page, passphrase);

    // Open dialog
    await page.getByRole('button', { name: 'New List' }).click();
    await page.waitForFunction(
      () => Boolean(document.querySelector('[role=\"dialog\"]')),
      undefined,
      { timeout: 5000 },
    );

    // Capture mobile dialog
    await expect(page.locator('[role=\"dialog\"]')).toHaveScreenshot(
      'groceries-create-dialog-mobile.png',
    );
  });
});
```

---

### Test 5: Focus & Interactive States

**Test Code:**

```typescript
test.describe('V3 — Visual Regression (Interactive)', () => {
  test('Focus indicator visible on buttons', async ({ page }, testInfo) => {
    // Setup
    await login(page, {
      webkitDelayMs: testInfo.project.name === 'webkit' ? 1500 : 0,
    });
    await gotoStable(page, '/dashboard/addresses');
    await page.fill('#setup-passphrase', passphrase);
    await page.fill('#setup-confirm', passphrase);
    await page.getByRole('button', { name: 'Create encrypted vault' }).click();
    await page.waitForFunction(() => Boolean(window.localStorage.getItem('myorganizer_vault_v1')), undefined, { timeout: 60000 });
    await gotoGroceriesAndUnlock(page, passphrase);

    // Focus \"New List\" button
    await page.focus('button:has-text(\"New List\")');
    await page.waitForTimeout(300);

    // Capture focused button
    await expect(page.getByRole('button', { name: 'New List' })).toHaveScreenshot('groceries-button-focused.png');
  });

  test('Loading state skeletons', async ({ page }, testInfo) => {
    // Note: This test captures the loading state briefly visible on page load
    // You may need to artificially slow network or add a delay hook

    await login(page, {
      webkitDelayMs: testInfo.project.name === 'webkit' ? 1500 : 0,
    });

    // Slow down network to capture skeleton state
    await page.route('**/*', (route) => {
      setTimeout(() => route.continue(), 2000);
    });

    await gotoStable(page, '/dashboard/groceries');

    // Capture skeleton state
    await expect(page).toHaveScreenshot('groceries-loading-skeleton.png', { timeout: 2500 });
  });
});
```

---

## Baseline Management

### Creating Baselines

1. **First run** (all tests fail — baselines don't exist):

   ```bash
   yarn nx e2e myorganizer-e2e --testNamePattern="Visual"
   ```

2. **Update baselines**:

   ```bash
   yarn nx e2e myorganizer-e2e -- --update-snapshots
   ```

3. **Commit baselines**:
   ```bash
   git add apps/myorganizer-e2e/src/e2e/__screenshots__/
   git commit -m "chore: add visual regression baselines for groceries"
   ```

### Updating Baselines After Intentional Changes

When design changes are intentional:

```bash
# Review the diff
yarn nx e2e myorganizer-e2e --testNamePattern="Visual"

# Approve and update
yarn nx e2e myorganizer-e2e -- --update-snapshots

# Commit with explanation
git add apps/myorganizer-e2e/src/e2e/__screenshots__/
git commit -m \"chore: update visual baselines for Design System v2"
```

---

## CI/CD Integration

### GitHub Actions

Add to `.github/workflows/e2e.yml`:

```yaml
- name: Run visual regression tests
  run: yarn nx e2e myorganizer-e2e --testNamePattern="Visual"

- name: Upload visual diffs on failure
  if: failure()
  uses: actions/upload-artifact@v3
  with:
    name: visual-diffs
    path: apps/myorganizer-e2e/test-results/
    retention-days: 7
```

---

## Troubleshooting

### Screenshot Diffs Too Large

If tests fail with large diffs:

1. **Check for OS differences** (Windows/Mac/Linux render differently)
   - Solution: Run tests on same OS as baseline

2. **Zoom/DPI issues**
   - Solution: Set explicit DPI in browser context

3. **Font rendering differences**
   - Solution: Use `maxDiffPixels` tolerance

```typescript
await expect(page).toHaveScreenshot('test.png', {
  maxDiffPixels: 200, // Allow up to 200 pixels difference
  threshold: 0.2, // Allow 20% color difference
});
```

### Tests Flake on CI

Use `maxDiffPixels` for animations/transitions:

```typescript
// Capture dialog fade-in (may still be animating)
await page.waitForTimeout(300); // Wait for animation
await expect(dialog).toHaveScreenshot('dialog.png', {
  maxDiffPixels: 50,
});
```

---

## Next Steps

1. **Add to test suite** — Copy test code to groceries.spec.ts
2. **Generate baselines** — Run `--update-snapshots` first time
3. **Commit baselines** — Add `__screenshots__/` to Git
4. **Run in CI** — Verify tests pass on GitHub Actions
5. **Monitor diffs** — Review visual changes in PRs

---

## References

- [Playwright Visual Comparisons](https://playwright.dev/docs/test-snapshots)
- [Screenshot Testing Best Practices](https://playwright.dev/docs/test-snapshots#updating-snapshots)
- [Debugging Visual Tests](https://playwright.dev/docs/debug#debugging-tests)
