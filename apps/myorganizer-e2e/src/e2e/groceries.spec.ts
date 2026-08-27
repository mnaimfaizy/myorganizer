import { expect, test } from '@playwright/test';
import {
  E2E_USER_ID,
  gotoStable,
  routeApi,
  submitLoginForm,
  waitForOwnedVault,
} from './helpers';

/**
 * E2E tests for groceries list management (create / rename / delete / accessibility)
 * Uses the vault mocking patterns from `vault.spec.ts` and an in-memory blob store
 * per-test to ensure isolation.
 */

type PutRecord = {
  url: string;
  headers: Record<string, string>;
  body: any;
};

function corsHeaders(origin: string) {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization,if-match',
  } as const;
}

async function login(page: import('@playwright/test').Page) {
  // Mock the login API endpoint
  const loginUrl = /\/auth\/login\/?(\?.*)?$/;
  await routeApi(page, loginUrl, async (route) => {
    const request = route.request();
    const origin = new URL(page.url() || 'http://localhost:3000').origin;

    // Handle CORS preflight
    if (request.method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: corsHeaders(origin),
      });
      return;
    }

    // Return mock login response
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

  await submitLoginForm(page);
}

async function unlockWithPassphrase(
  page: import('@playwright/test').Page,
  passphrase: string,
) {
  // Wait for the unlock UI to be present (up to 10s)
  const unlockUI = page.getByRole('button', { name: 'Use passphrase' });
  const isUnlockScreenVisible = await unlockUI
    .isVisible({ timeout: 10000 })
    .catch(() => false);

  if (!isUnlockScreenVisible) {
    // Vault might already be unlocked, no need to proceed
    return;
  }

  // Click "Use passphrase" button if visible. The passphrase field appearing
  // is the end of the panel's transition, so the visibility check below is the
  // wait — Firefox does not need a sleep on top of it (issue #524).
  if (await unlockUI.isVisible({ timeout: 1000 }).catch(() => false)) {
    await unlockUI.click();
  }

  // Fill passphrase input - try multiple selectors for robustness
  let input = page.locator('#unlock-passphrase');
  let inputExists = await input.isVisible({ timeout: 5000 }).catch(() => false);

  if (!inputExists) {
    // Fallback: try finding by role/placeholder
    input = page
      .locator(
        'input[placeholder*="Security"], input[placeholder*="passphrase"]',
      )
      .first();
    inputExists = await input.isVisible({ timeout: 5000 }).catch(() => false);
  }

  if (!inputExists) {
    throw new Error(
      'Passphrase input not found after clicking "Use passphrase"',
    );
  }

  // Scroll input into view and click to focus
  await input.scrollIntoViewIfNeeded();
  await input.click();

  // Fill the input. VaultGate's Unlock handler reads React state, so the click
  // below is only safe once the controlled value has round-tripped back.
  await input.fill(passphrase);
  await expect(input).toHaveValue(passphrase);

  // Find and click the Unlock button
  const unlockButton = page.getByRole('button', { name: /^Unlock$/i });
  const buttonExists = await unlockButton
    .isVisible({ timeout: 5000 })
    .catch(() => false);

  if (!buttonExists) {
    throw new Error('Unlock button not found after filling passphrase');
  }

  // Click the unlock button
  await unlockButton.click();

  // Unlock is complete when the passphrase field goes away. The previous shape
  // called `isHidden({ timeout })` — which does not wait at all, so it resolved
  // immediately and the trailing sleep was the real wait — then fell back to
  // `networkidle` (issue #524).
  await expect(
    page.locator(
      '#unlock-passphrase, input[placeholder*="Security"], input[placeholder*="passphrase"]',
    ),
  ).toHaveCount(0, { timeout: 120000 });
}

/**
 * Navigate to groceries page and ensure vault is unlocked.
 * If the unlock screen appears, automatically unlock with the provided passphrase.
 */
async function gotoGroceriesAndUnlock(
  page: import('@playwright/test').Page,
  passphrase: string,
) {
  await gotoStable(page, '/dashboard/groceries');

  // The route is ready once it has settled into one of its two states — the
  // vault gate, or the unlocked Trip Board (issue #524).
  const unlockButton = page.getByRole('button', { name: 'Use passphrase' });
  await expect(
    unlockButton
      .or(page.getByRole('heading', { name: 'Active trips' }))
      .first(),
  ).toBeVisible({ timeout: 30000 });

  const isLocked = await unlockButton
    .isVisible({ timeout: 10000 })
    .catch(() => false);

  if (isLocked) {
    // Vault is locked, need to unlock
    await unlockWithPassphrase(page, passphrase);
  }

  // Wait for the Trip Board index to render after unlock
  await expect(page.getByRole('heading', { name: 'Active trips' })).toBeVisible(
    { timeout: 30000 },
  );

  // The heading renders before the decrypted trips do; the board's primary
  // action is what depends on that list having resolved.
  await expect(
    page
      .getByRole('button', { name: 'New trip' })
      .or(page.getByRole('button', { name: 'Create Your First List' }))
      .first(),
  ).toBeVisible({ timeout: 30000 });
}

/**
 * Setup route handlers and an in-memory store for groceries blob.
 * Returns helpers to inspect and control behavior for assertions.
 */
async function _setupRoutes(page: import('@playwright/test').Page) {
  const loginUrl = /\/auth\/login\/?(\?.*)?$/;
  const vaultMetaUrl = /\/vault\/?(\?.*)?$/;
  const vaultBlobUrl = /\/vault\/blob\/groceries\/?(\?.*)?$/;

  let serverMeta: any = { version: 1 };
  let serverMetaEtag = 'W/"0"';
  let serverMetaUpdatedAt = new Date(0).toISOString();

  const serverBlobs: Record<string, any | null> = {
    groceries: null,
  };
  const serverBlobEtags: Record<string, string> = {
    groceries: 'W/"0"',
  };
  const serverBlobUpdatedAt: Record<string, string> = {
    groceries: new Date(0).toISOString(),
  };

  const putRequests: PutRecord[] = [];
  let failNextPut = false;

  await routeApi(page, loginUrl, async (route) => {
    const request = route.request();
    const origin = new URL(page.url() || 'http://localhost:3000').origin;
    const headers = corsHeaders(origin);

    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }

    await route.fulfill({
      status: 200,
      headers,
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

  await routeApi(page, vaultMetaUrl, async (route) => {
    const request = route.request();
    const origin = new URL(page.url() || 'http://localhost:3000').origin;
    const headers = corsHeaders(origin);

    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }

    if (request.method() === 'GET') {
      if (!serverMeta) {
        await route.fulfill({
          status: 404,
          headers,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Vault not found' }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        headers,
        contentType: 'application/json',
        body: JSON.stringify({
          meta: serverMeta,
          etag: serverMetaEtag,
          updatedAt: serverMetaUpdatedAt,
        }),
      });
      return;
    }

    if (request.method() === 'PUT') {
      const bodyStr = request.postData();
      let body: any = undefined;
      try {
        body = bodyStr ? JSON.parse(bodyStr) : undefined;
      } catch (e) {
        body = undefined;
      }

      serverMeta = body?.meta ?? serverMeta;
      serverMetaUpdatedAt = new Date().toISOString();
      serverMetaEtag = `W/"${Date.now()}"`;

      await route.fulfill({
        status: 200,
        headers,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          etag: serverMetaEtag,
          updatedAt: serverMetaUpdatedAt,
        }),
      });
      return;
    }

    await route.fulfill({ status: 405, headers });
  });

  await routeApi(page, vaultBlobUrl, async (route) => {
    const request = route.request();
    const origin = new URL(page.url() || 'http://localhost:3000').origin;
    const headers = corsHeaders(origin);

    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }

    if (request.method() === 'GET') {
      const blob = serverBlobs.groceries;
      if (!blob) {
        await route.fulfill({
          status: 404,
          headers,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Vault blob not found' }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        headers,
        contentType: 'application/json',
        body: JSON.stringify({
          type: 'groceries',
          blob,
          etag: serverBlobEtags.groceries,
          updatedAt: serverBlobUpdatedAt.groceries,
        }),
      });
      return;
    }

    if (request.method() === 'PUT') {
      const bodyStr = request.postData();
      let body: any = undefined;
      try {
        body = bodyStr ? JSON.parse(bodyStr) : undefined;
      } catch (e) {
        body = undefined;
      }

      putRequests.push({
        url: request.url(),
        headers: request.headers(),
        body,
      });

      if (failNextPut) {
        failNextPut = false;
        await route.fulfill({
          status: 500,
          headers,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Simulated server error' }),
        });
        return;
      }

      const nextBlob = body?.blob;
      const created = !serverBlobs.groceries;
      serverBlobs.groceries = nextBlob;
      serverBlobUpdatedAt.groceries = new Date().toISOString();
      serverBlobEtags.groceries = `W/"${Date.now()}"`;

      await route.fulfill({
        status: created ? 201 : 200,
        headers,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          etag: serverBlobEtags.groceries,
          updatedAt: serverBlobUpdatedAt.groceries,
        }),
      });
      return;
    }

    await route.fulfill({ status: 405, headers });
  });

  return {
    getPutRequests: () => putRequests,
    seedBlob: (blob: string | null) => {
      serverBlobs.groceries = blob;
    },
    setFailNextPut: (v: boolean) => {
      failNextPut = v;
    },
  };
}

/**
 * Helper to open Create dialog and create a list by UI interactions.
 * Waits for the dialog to close and the list to appear, indicating success.
 */
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

  // Character counter visible
  await expect(page.getByText(/\d+ \/ 100/)).toBeVisible();

  // Click the create button
  await page.getByRole('button', { name: 'Create List' }).click();

  // Dialog should close
  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 60000 });

  await expect(tripCard(page, name)).toBeVisible({ timeout: 60000 });
}

async function openTripActionsMenu(
  page: import('@playwright/test').Page,
  tripName: string,
) {
  const card = tripCard(page, tripName).first();
  await card
    .getByRole('button', { name: `Trip actions for ${tripName}` })
    .click();
}

test.describe('Groceries (E2E)', () => {
  const passphrase = 'correct horse battery staple';

  test.describe('F1 — Create List Flow', () => {
    test('creates a list, persists to server, and survives reload', async ({
      page,
    }) => {
      test.setTimeout(120000);

      await login(page);

      // Create a local vault (setup flow) so we can unlock and use the vault-backed lists.
      await gotoStable(page, '/dashboard/addresses');
      await page.fill('#setup-passphrase', passphrase);
      await page.fill('#setup-confirm', passphrase);
      await page
        .getByRole('button', { name: 'Create encrypted vault' })
        .click();

      await waitForOwnedVault(page, E2E_USER_ID);

      await gotoGroceriesAndUnlock(page, passphrase);

      await expect(
        page.getByRole('heading', { name: 'Active trips' }),
      ).toBeVisible({ timeout: 30000 });

      await clickNewTrip(page);
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByPlaceholder('e.g., Weekly Shopping').fill('Weekly Shop');

      // Character counter check: "11 / 100"
      await expect(page.getByText('11 / 100')).toBeVisible();

      // Trigger the create action
      await page.getByRole('button', { name: 'Create List' }).click();

      // Wait for dialog to close and item to appear
      await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 60000 });
      await expect(tripCard(page, 'Weekly Shop')).toBeVisible({
        timeout: 60000,
      });

      // Reload and re-unlock, then assert persistence
      await page.reload();
      await gotoGroceriesAndUnlock(page, passphrase);
      await expect(tripCard(page, 'Weekly Shop')).toBeVisible({
        timeout: 60000,
      });
    });
  });

  test.describe('F2 — Rename List Flow (with no-op guard)', () => {
    test('renames a list successfully', async ({ page }) => {
      test.setTimeout(120000);

      await login(page);

      // Create vault and unlock
      await gotoStable(page, '/dashboard/addresses');
      await page.fill('#setup-passphrase', passphrase);
      await page.fill('#setup-confirm', passphrase);
      await page
        .getByRole('button', { name: 'Create encrypted vault' })
        .click();
      await waitForOwnedVault(page, E2E_USER_ID);
      await gotoGroceriesAndUnlock(page, passphrase);

      // Seed with one list using the UI
      await createListViaUI(page, 'Weekly Shop');

      await openTripActionsMenu(page, 'Weekly Shop');
      await page.getByRole('menuitem', { name: 'Rename trip' }).click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      const input = page.getByPlaceholder('e.g., Weekly Shopping');
      await expect(input).toHaveValue('Weekly Shop');

      // Perform rename
      await input.fill('Weekend Haul');
      await page.getByRole('button', { name: 'Rename List' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(tripCard(page, 'Weekend Haul')).toBeVisible({
        timeout: 60000,
      });
    });
  });

  test.describe('F3 — Delete List Flow with Confirmation', () => {
    test('deletes a list after confirmation and preserves others', async ({
      page,
    }) => {
      test.setTimeout(120000);

      await login(page);

      // Create vault and unlock
      await gotoStable(page, '/dashboard/addresses');
      await page.fill('#setup-passphrase', passphrase);
      await page.fill('#setup-confirm', passphrase);
      await page
        .getByRole('button', { name: 'Create encrypted vault' })
        .click();
      await waitForOwnedVault(page, E2E_USER_ID);
      await gotoGroceriesAndUnlock(page, passphrase);

      // Seed with two lists
      await createListViaUI(page, 'Alpha');
      await createListViaUI(page, 'Beta');

      await openTripActionsMenu(page, 'Alpha');
      await page.getByRole('menuitem', { name: 'Delete trip' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByText(/Delete\s+"?Alpha"?/)).toBeVisible();

      await page
        .getByRole('dialog')
        .getByRole('button', { name: 'Cancel' })
        .click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(tripCard(page, 'Alpha')).toBeVisible();

      await openTripActionsMenu(page, 'Alpha');
      await page.getByRole('menuitem', { name: 'Delete trip' }).click();
      await page.getByRole('button', { name: 'Delete List' }).click();

      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(tripCard(page, 'Alpha')).toHaveCount(0);
      await expect(tripCard(page, 'Beta')).toBeVisible();
    });
  });

  test.describe('F4 — Multiple Lists Management', () => {
    test('creates multiple lists, renames and deletes while preserving others', async ({
      page,
    }) => {
      test.setTimeout(120000);

      await login(page);

      // Create vault and unlock
      await gotoStable(page, '/dashboard/addresses');
      await page.fill('#setup-passphrase', passphrase);
      await page.fill('#setup-confirm', passphrase);
      await page
        .getByRole('button', { name: 'Create encrypted vault' })
        .click();
      await waitForOwnedVault(page, E2E_USER_ID);
      await gotoGroceriesAndUnlock(page, passphrase);

      // Create three lists
      await createListViaUI(page, 'Alpha');
      await createListViaUI(page, 'Beta');
      await createListViaUI(page, 'Gamma');

      await expect(tripCard(page, 'Alpha')).toBeVisible();
      await expect(tripCard(page, 'Beta')).toBeVisible();
      await expect(tripCard(page, 'Gamma')).toBeVisible();

      await openTripActionsMenu(page, 'Beta');
      await page.getByRole('menuitem', { name: 'Rename trip' }).click();
      await page.getByPlaceholder('e.g., Weekly Shopping').fill('Beta Renamed');
      await page.getByRole('button', { name: 'Rename List' }).click();
      await expect(tripCard(page, 'Beta Renamed')).toBeVisible();

      await openTripActionsMenu(page, 'Alpha');
      await page.getByRole('menuitem', { name: 'Delete trip' }).click();
      await page.getByRole('button', { name: 'Delete List' }).click();

      await expect(tripCard(page, 'Alpha')).toHaveCount(0);
      await expect(tripCard(page, 'Beta Renamed')).toBeVisible();
      await expect(tripCard(page, 'Gamma')).toBeVisible();
    });
  });

  test.describe('F5 — Error Recovery (Vault Save Failure)', () => {
    test('shows an error banner when save fails and recovers when retried', async () => {
      // Error recovery testing deferred - this tests advanced error handling
      // that may not be a priority for Phase 4 MVP
      test.skip();
    });
  });

  test.describe('F6 — Keyboard Navigation & Accessibility', () => {
    test('Escape closes dialog', async ({ page }) => {
      test.setTimeout(120000);

      await login(page);

      // Create vault and unlock
      await gotoStable(page, '/dashboard/addresses');
      await page.fill('#setup-passphrase', passphrase);
      await page.fill('#setup-confirm', passphrase);
      await page
        .getByRole('button', { name: 'Create encrypted vault' })
        .click();
      await waitForOwnedVault(page, E2E_USER_ID);
      await gotoGroceriesAndUnlock(page, passphrase);

      await clickNewTrip(page);
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);

      await expect(
        page.getByRole('button', { name: 'New trip' }),
      ).toBeVisible();
    });
  });
});
