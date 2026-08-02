import { expect, test } from '@playwright/test';

/**
 * E2E tests for groceries items (create / edit / delete / filter / persistence)
 * Reuses vault unlock and login patterns from groceries.spec.ts
 */

const passphrase = 'correct horse battery staple';

async function gotoStable(
  page: import('@playwright/test').Page,
  url: string,
  options?: Parameters<import('@playwright/test').Page['goto']>[1],
) {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await page.goto(url, options);
      return;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (
        message.includes('Navigation to') &&
        message.includes('is interrupted by another navigation') &&
        attempt < maxAttempts
      ) {
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(250);
        continue;
      }
      throw e;
    }
  }
}

function corsHeaders(origin: string) {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization,if-match',
  } as const;
}

async function login(
  page: import('@playwright/test').Page,
  options: { webkitDelayMs: number },
) {
  const loginUrl = /\/auth\/login\/?(\?.*)?$/;
  await page.route(loginUrl, async (route) => {
    const request = route.request();
    const origin = new URL(page.url() || 'http://localhost:3000').origin;

    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders(origin) });
      return;
    }

    await route.fulfill({
      status: 200,
      headers: corsHeaders(origin),
      contentType: 'application/json',
      body: JSON.stringify({
        token: 'fake-jwt-token',
        expires_in: 3600,
        user: {
          id: '1',
          name: 'Test User',
          email: 'testuser@example.com',
          firstName: 'Test',
          lastName: 'User',
        },
      }),
    });
  });

  await page.goto('/login');
  await expect(page).toHaveURL(/.*login/);
  await expect(page.locator('h1')).toContainText('Login');

  try {
    await page.waitForLoadState('networkidle', { timeout: 10000 });
  } catch {
    try {
      await page.waitForLoadState('domcontentloaded');
    } catch {
      // proceed
    }
  }

  if (options.webkitDelayMs > 0)
    await page.waitForTimeout(options.webkitDelayMs);

  await page.fill('input[type="email"]', 'testuser@example.com');
  await page.fill('input[type="password"]', 'password123');

  const submitButton = page.locator('button[type="submit"]');
  await expect(submitButton).toBeVisible();
  await expect(submitButton).toBeEnabled();
  await submitButton.click();

  await expect(page).toHaveURL(/.*dashboard/, { timeout: 60000 });

  try {
    await page.waitForLoadState('networkidle', { timeout: 10000 });
  } catch {
    try {
      await page.waitForLoadState('domcontentloaded');
    } catch {}
  }

  if (options.webkitDelayMs > 0)
    await page.waitForTimeout(options.webkitDelayMs);
}

async function unlockWithPassphrase(
  page: import('@playwright/test').Page,
  passphrase: string,
) {
  const unlockUI = page.getByRole('button', { name: 'Use passphrase' });
  const isUnlockScreenVisible = await unlockUI
    .isVisible({ timeout: 10000 })
    .catch(() => false);

  if (!isUnlockScreenVisible) return;

  if (await unlockUI.isVisible({ timeout: 1000 }).catch(() => false)) {
    await unlockUI.click();
    await page.waitForTimeout(1000);
  }

  let input = page.locator('#unlock-passphrase');
  let inputExists = await input.isVisible({ timeout: 5000 }).catch(() => false);

  if (!inputExists) {
    input = page
      .locator(
        'input[placeholder*="Security"], input[placeholder*="passphrase"]',
      )
      .first();
    inputExists = await input.isVisible({ timeout: 5000 }).catch(() => false);
  }

  if (!inputExists)
    throw new Error(
      'Passphrase input not found after clicking "Use passphrase"',
    );

  await input.scrollIntoViewIfNeeded();
  await input.click();
  await page.waitForTimeout(500);

  await input.fill(passphrase);
  await page.waitForTimeout(300);

  const unlockButton = page.getByRole('button', { name: /^Unlock$/i });
  const buttonExists = await unlockButton
    .isVisible({ timeout: 5000 })
    .catch(() => false);
  if (!buttonExists)
    throw new Error('Unlock button not found after filling passphrase');

  await unlockButton.click();
  await page.waitForTimeout(500);

  try {
    await page
      .locator(
        '#unlock-passphrase, input[placeholder*="Security"], input[placeholder*="passphrase"]',
      )
      .first()
      .isHidden({ timeout: 30000 });
  } catch {
    try {
      await page.waitForLoadState('networkidle', { timeout: 10000 });
    } catch {}
  }

  await page.waitForTimeout(1000);
}

async function gotoGroceriesAndUnlock(
  page: import('@playwright/test').Page,
  passphrase: string,
) {
  await gotoStable(page, '/dashboard/groceries');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  const unlockButton = page.getByRole('button', { name: 'Use passphrase' });
  const isLocked = await unlockButton
    .isVisible({ timeout: 10000 })
    .catch(() => false);

  if (isLocked) await unlockWithPassphrase(page, passphrase);

  await expect(page.getByRole('heading', { name: 'Active trips' })).toBeVisible(
    { timeout: 30000 },
  );

  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
}

async function clickNewTrip(page: import('@playwright/test').Page) {
  const newTrip = page.getByRole('button', { name: 'New trip' });
  const createFirst = page.getByRole('button', {
    name: 'Create Your First List',
  });
  if (await newTrip.isVisible({ timeout: 2000 }).catch(() => false)) {
    await newTrip.click();
  } else {
    await createFirst.click();
  }
}

function tripCard(page: import('@playwright/test').Page, tripName: string) {
  return page.getByRole('article').filter({
    has: page.getByRole('link', { name: tripName, exact: true }),
  });
}

async function createListViaUI(
  page: import('@playwright/test').Page,
  name: string,
) {
  await clickNewTrip(page);

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  const input = page.getByPlaceholder('e.g., Weekly Shopping');
  await expect(input).toBeVisible();
  await input.fill(name);

  await expect(page.getByText(/\d+ \/ 100/)).toBeVisible();

  await page.getByRole('button', { name: 'Create List' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 60000 });
  await expect(tripCard(page, name)).toBeVisible({ timeout: 60000 });
}

async function openListByName(
  page: import('@playwright/test').Page,
  listName: string,
  passphraseParam?: string,
) {
  const link = tripCard(page, listName)
    .getByRole('link', { name: listName, exact: true })
    .first();

  // Get the href and navigate to it
  const href = await link.getAttribute('href');
  if (!href) {
    throw new Error(`Could not find link for list "${listName}"`);
  }

  await page.goto(href);

  // Wait for the list view to load
  await page.waitForLoadState('networkidle');

  // Check if vault unlock is required on this page
  const passphraseInput = page
    .locator('#unlock-passphrase, [data-testid="unlock-passphrase"]')
    .first();
  if (await passphraseInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    // Vault unlock is required; fill and submit
    if (!passphraseParam) {
      throw new Error(
        `Vault unlock required but passphrase not provided to openListByName`,
      );
    }
    await passphraseInput.fill(passphraseParam);
    const unlockBtn = page
      .getByRole('button', { name: /Unlock|Confirm/ })
      .first();
    await unlockBtn.click();
    await page.waitForLoadState('networkidle');
  }

  await page.waitForFunction(
    (name) => {
      const heading = document.querySelector('h1, h2');
      return heading && heading.textContent?.includes(name);
    },
    listName,
    { timeout: 30000 },
  );
}

async function addItemViaDialog(
  page: import('@playwright/test').Page,
  name: string,
) {
  await page.getByRole('button', { name: 'Add Item' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 30000 });

  const nameInput = page.getByRole('combobox', { name: /Item Name/ });
  await expect(nameInput).toBeVisible({ timeout: 10000 });
  await nameInput.fill(name);

  const addBtn = dialog.getByRole('button', { name: 'Add to List' });
  await expect(addBtn).toBeEnabled({ timeout: 10000 });
  await addBtn.click();

  await expect(dialog).toHaveCount(0, { timeout: 30000 });
  await expect(page.getByText(name, { exact: true })).toBeVisible({
    timeout: 30000,
  });
}

async function openRowActionsMenu(
  page: import('@playwright/test').Page,
  itemName: string,
) {
  await page
    .getByRole('button', { name: `More actions for ${itemName}` })
    .click();
}

async function editCatalogItemViaMenu(
  page: import('@playwright/test').Page,
  originalName: string,
  updates: {
    name?: string;
    category?: string;
    price?: string;
    notes?: string;
  },
) {
  await openRowActionsMenu(page, originalName);
  await page.getByRole('menuitem', { name: 'Edit Catalog Item' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 30000 });

  if (updates.name) {
    await page.getByLabel('Catalog Item Name').fill(updates.name);
  }
  if (updates.category) {
    await dialog.getByRole('button', { name: updates.category }).click();
  }
  if (updates.price) {
    await page.getByLabel('Default Price').fill(updates.price);
  }
  if (updates.notes) {
    await page.getByLabel('Notes').fill(updates.notes);
  }

  await page.getByRole('button', { name: 'Save Catalog Item' }).click();
  await expect(dialog).toHaveCount(0, { timeout: 30000 });
}

async function editListLineViaPencil(
  page: import('@playwright/test').Page,
  itemName: string,
  updates: { amount?: string },
) {
  await page
    .getByRole('button', { name: `Edit List Line for ${itemName}` })
    .click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 30000 });

  if (updates.amount) {
    await page.getByLabel('Quantity / Amount').fill(updates.amount);
  }

  await page.getByRole('button', { name: 'Save List Line' }).click();
  await expect(dialog).toHaveCount(0, { timeout: 30000 });
}

async function removeLineViaMenu(
  page: import('@playwright/test').Page,
  itemName: string,
) {
  await openRowActionsMenu(page, itemName);
  await page.getByRole('menuitem', { name: 'Remove from list' }).click();
  await page.getByRole('menuitem', { name: 'Confirm remove line' }).click();
}

async function assertItemRowVisible(
  page: import('@playwright/test').Page,
  itemName: string,
) {
  await expect(
    page.getByRole('checkbox', { name: new RegExp(`Toggle ${itemName}`) }),
  ).toBeVisible({ timeout: 30000 });
}

test.describe('Groceries Items (E2E)', () => {
  test.beforeEach(async ({ page }) => {
    // start from root to ensure clean navigation state
    await page.goto('/');
  });

  test.afterEach(async ({ page }) => {
    // Clear local storage to isolate tests (vault state)
    try {
      await page.evaluate(() => window.localStorage.clear());
    } catch {}
  });

  test('1 — Add Single Item (full fields) ', async ({ page }, testInfo) => {
    test.setTimeout(120000);

    await login(page, {
      webkitDelayMs: testInfo.project.name === 'webkit' ? 1500 : 0,
    });

    // Create vault and unlock
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

    // Create and open list
    await createListViaUI(page, 'Single Item List');
    await openListByName(page, 'Single Item List', passphrase);

    // Add item via dialog
    await addItemViaDialog(page, 'Organic Bananas');

    await editCatalogItemViaMenu(page, 'Organic Bananas', {
      name: 'Organic Bananas - Ripe',
      category: 'Produce',
      price: '3.50',
      notes: 'Choose ripe ones',
    });
    await editListLineViaPencil(page, 'Organic Bananas - Ripe', {
      amount: '1 dozen',
    });

    await expect(page.getByText('Organic Bananas - Ripe')).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByText('$3.50')).toBeVisible({ timeout: 30000 });
  });

  test('2 — Add Multiple Items and persist', async ({ page }, testInfo) => {
    test.setTimeout(120000);

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

    await createListViaUI(page, 'Multiple Items List');
    await openListByName(page, 'Multiple Items List', passphrase);

    const items = ['Milk', 'Eggs', 'Bread'];
    for (const it of items) await addItemViaDialog(page, it);

    for (const it of items) await assertItemRowVisible(page, it);

    await page.reload();
    await gotoGroceriesAndUnlock(page, passphrase);
    await expect(tripCard(page, 'Multiple Items List')).toBeVisible({
      timeout: 60000,
    });
    await openListByName(page, 'Multiple Items List', passphrase);

    for (const it of items) await assertItemRowVisible(page, it);
  });

  test('4 — Edit Item (name, category, price)', async ({ page }, testInfo) => {
    test.setTimeout(120000);

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

    await createListViaUI(page, 'Edit Flow List');
    await openListByName(page, 'Edit Flow List', passphrase);

    await addItemViaDialog(page, 'Cherry Tomatoes');
    await editCatalogItemViaMenu(page, 'Cherry Tomatoes', {
      name: 'Cherry Tomatoes - Sweet',
      category: 'Produce',
      price: '2.99',
    });

    await expect(page.getByText('Cherry Tomatoes - Sweet')).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByText('$2.99')).toBeVisible({ timeout: 30000 });
  });

  test('5 — Mark as Done visual change', async ({ page }, testInfo) => {
    test.setTimeout(120000);

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

    await createListViaUI(page, 'Done State List');
    await openListByName(page, 'Done State List', passphrase);

    await addItemViaDialog(page, 'Cucumber');

    // Find and check the checkbox by aria-label
    const checkbox = page.getByRole('checkbox', { name: /Toggle Cucumber/ });
    await expect(checkbox).toBeVisible({ timeout: 30000 });
    await checkbox.check();
    await expect(checkbox).toBeChecked();

    // Visual change: name should have line-through class
    // The line-through is applied to the span containing the item name
    const nameElement = page.getByText('Cucumber', { exact: true });
    await page.waitForTimeout(500);
    const updatedClass = await nameElement.getAttribute('class');
    expect(updatedClass?.includes('line-through')).toBeTruthy();
  });

  test('6 — Delete Item via confirm click', async ({ page }, testInfo) => {
    test.setTimeout(120000);

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

    await createListViaUI(page, 'Delete Item List');
    await openListByName(page, 'Delete Item List', passphrase);

    await addItemViaDialog(page, 'Chips');
    await removeLineViaMenu(page, 'Chips');

    await expect(page.getByText('Chips', { exact: true })).toHaveCount(0, {
      timeout: 30000,
    });
  });

  test('7 — Full CRUD Journey', async ({ page }, testInfo) => {
    test.setTimeout(120000);

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

    await createListViaUI(page, 'Full CRUD List');
    await openListByName(page, 'Full CRUD List', passphrase);

    await addItemViaDialog(page, 'Alpha');

    await editCatalogItemViaMenu(page, 'Alpha', {
      name: 'Alpha v2',
    });
    await expect(page.getByText('Alpha v2')).toBeVisible({ timeout: 30000 });

    const chk = page.getByRole('checkbox', { name: /Toggle Alpha v2/ });
    await expect(chk).toBeVisible({ timeout: 30000 });
    await chk.check();
    await expect(chk).toBeChecked();
    await chk.uncheck();
    await expect(chk).not.toBeChecked();

    await removeLineViaMenu(page, 'Alpha v2');
    await expect(page.getByText('Alpha v2')).toHaveCount(0, {
      timeout: 30000,
    });
  });

  test('8 — Persistence & Reload', async ({ page }, testInfo) => {
    test.setTimeout(120000);

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

    await createListViaUI(page, 'Persistence List');
    await openListByName(page, 'Persistence List', passphrase);

    await addItemViaDialog(page, 'Persistent One');
    await addItemViaDialog(page, 'Persistent Two');

    await page.reload();
    await gotoGroceriesAndUnlock(page, passphrase);
    await expect(tripCard(page, 'Persistence List')).toBeVisible({
      timeout: 60000,
    });
    await openListByName(page, 'Persistence List', passphrase);

    await expect(page.getByText('Persistent One')).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByText('Persistent Two')).toBeVisible({
      timeout: 30000,
    });
  });

  test('9 — Validation Error Handling blocks submit', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120000);

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

    await createListViaUI(page, 'Validation List');
    await openListByName(page, 'Validation List', passphrase);

    await addItemViaDialog(page, 'To Be Invalid');
    await openRowActionsMenu(page, 'To Be Invalid');
    await page.getByRole('menuitem', { name: 'Edit Catalog Item' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 30000 });

    const nameInput = page.getByLabel('Catalog Item Name');
    await expect(nameInput).toBeVisible({ timeout: 10000 });
    await nameInput.fill('');
    await nameInput.blur();

    const saveBtn = dialog.getByRole('button', { name: 'Save Catalog Item' });
    await saveBtn.click({ force: true });

    await expect(dialog.getByText('Item name is required')).toBeVisible({
      timeout: 10000,
    });
    await expect(dialog).toBeVisible();
  });
});
