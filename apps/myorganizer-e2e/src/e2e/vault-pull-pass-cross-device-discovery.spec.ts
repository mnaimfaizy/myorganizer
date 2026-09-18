import { expect, test } from '@playwright/test';
import {
  createOwnedVault,
  gotoStable,
  E2E_USER_ID,
  routeApi,
  routeVaultBlobInventory,
  submitLoginForm,
  unlockWithPassphrase,
  vaultBlobRouteRelative,
  vaultBlobTypeExtractor,
  vaultBlobInventoryRouteRelative,
  waitForOwnedVault,
  writeAddressToVault,
} from './helpers';

/**
 * Vault Pull Pass discovery test (issue #839, ADR 0087).
 *
 * Proves a Vault Pull Pass reads the Vault Blob Inventory first and asks about
 * a Vault Blob Type only when the inventory says its Ciphertext differs from
 * this device's Sync Bookmark. A device that has never held a type is asked
 * about it only once the inventory names it (i.e. once some device pushed it),
 * avoiding wasteful 404s and silent discovery failures.
 *
 * One identity, two devices. Device A starts with no addresses; Device B writes
 * one via the real form. On focus dispatch to Device A, the address converges
 * via the pull pass without any per-type 404s. A second focus on Device A
 * produces a single inventory 304 and zero per-type reads.
 *
 * Test-only passphrase against fully stubbed backend — no real credential applies.
 */

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await expect(page).toHaveURL(/.*login/);
  await expect(page.locator('h1')).toContainText('Login');

  await submitLoginForm(page);
}

function corsHeaders(origin: string) {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers':
      'content-type,authorization,if-match,if-none-match',
  } as const;
}

test.describe('Vault Pull Pass Cross-Device Discovery (ADR 0087)', () => {
  test('should discover addresses written on another device via pull pass without 404s', async ({
    browser,
  }, testInfo) => {
    // Spec timeout: 150s on Chromium/Firefox, 240s on WebKit (PBKDF2 slow).
    test.setTimeout(testInfo.project.name === 'webkit' ? 240000 : 150000);

    // In-memory "server" backing store shared across both sessions.
    let serverMeta: any | null = null;
    let serverMetaEtag = 'W/"0"';
    let serverMetaUpdatedAt = new Date(0).toISOString();

    const serverBlobs: Record<string, any | null> = {
      addresses: null,
      groceries: null,
      mobileNumbers: null,
      subscriptions: null,
      tasks: null,
      todos: null,
    };
    const serverBlobEtags: Record<string, string> = {
      addresses: 'W/"0"',
      groceries: 'W/"0"',
      mobileNumbers: 'W/"0"',
      subscriptions: 'W/"0"',
      tasks: 'W/"0"',
      todos: 'W/"0"',
    };
    const serverBlobUpdatedAt: Record<string, string> = {
      addresses: new Date(0).toISOString(),
      groceries: new Date(0).toISOString(),
      mobileNumbers: new Date(0).toISOString(),
      subscriptions: new Date(0).toISOString(),
      tasks: new Date(0).toISOString(),
      todos: new Date(0).toISOString(),
    };

    // Route matchers for response tracking
    const loginUrl = /\/auth\/login\/?(\?.*)?$/;
    const vaultMetaUrl = /\/vault\/?(\?.*)?$/;
    const vaultBlobUrl = vaultBlobRouteRelative();
    const inventoryUrl = vaultBlobInventoryRouteRelative();

    async function setupRoutes(page: import('@playwright/test').Page) {
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
          const ifMatch = request.headers()['if-match'];
          if (ifMatch) {
            if (!serverMeta || ifMatch !== serverMetaEtag) {
              await route.fulfill({
                status: 409,
                headers,
                contentType: 'application/json',
                body: JSON.stringify({ message: 'ETag mismatch' }),
              });
              return;
            }
          }

          const body = request.postDataJSON?.() as any;
          const nextMeta = body?.meta;

          serverMeta = nextMeta;
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

        const match = request.url().match(vaultBlobTypeExtractor());
        const type = match?.[1];

        if (!type) {
          await route.fulfill({ status: 400, headers });
          return;
        }

        if (request.method() === 'OPTIONS') {
          await route.fulfill({ status: 204, headers });
          return;
        }

        if (request.method() === 'GET') {
          const blob = serverBlobs[type];
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
              type,
              blob,
              etag: serverBlobEtags[type],
              updatedAt: serverBlobUpdatedAt[type],
            }),
          });
          return;
        }

        if (request.method() === 'PUT') {
          const ifMatch = request.headers()['if-match'];
          if (ifMatch) {
            if (!serverBlobs[type] || ifMatch !== serverBlobEtags[type]) {
              await route.fulfill({
                status: 409,
                headers,
                contentType: 'application/json',
                body: JSON.stringify({ message: 'ETag mismatch' }),
              });
              return;
            }
          }

          const body = request.postDataJSON?.() as any;
          const nextBlob = body?.blob;

          serverBlobs[type] = nextBlob;
          serverBlobUpdatedAt[type] = new Date().toISOString();
          serverBlobEtags[type] = `W/"${Date.now()}"`;

          await route.fulfill({
            status: 200,
            headers,
            contentType: 'application/json',
            body: JSON.stringify({
              ok: true,
              etag: serverBlobEtags[type],
              updatedAt: serverBlobUpdatedAt[type],
            }),
          });
          return;
        }

        await route.fulfill({ status: 405, headers });
      });

      await routeVaultBlobInventory(page, {
        headers: () =>
          corsHeaders(new URL(page.url() || 'http://localhost:3000').origin),
        state: () => ({
          blobs: serverBlobs,
          etags: serverBlobEtags,
          updatedAt: serverBlobUpdatedAt,
        }),
      });
    }

    // Test-only passphrase — no real credential applies.
    const passphrase = 'TestPass1234';
    const uniqueAddress = `123 Test Street ${Date.now()}`;

    // Phase 0: Setup both contexts (Device A and Device B)
    const deviceA = await browser.newContext();
    const pageA = await deviceA.newPage();

    // Attach response listener immediately to observe entire run on Device A
    let currentPhase: 'setup' | 'discovery' | 'steady-state' = 'setup';
    const allResponses: Array<{
      url: string;
      status: number;
      phase: 'setup' | 'discovery' | 'steady-state';
    }> = [];

    pageA.on('response', (response) => {
      const url = response.url();
      const status = response.status();

      if (inventoryUrl.test(url) || vaultBlobUrl.test(url)) {
        allResponses.push({ url, status, phase: currentPhase });
      }
    });

    await setupRoutes(pageA);

    const deviceB = await browser.newContext();
    const pageB = await deviceB.newPage();
    await setupRoutes(pageB);

    // Phase 1: Device A — login, create vault, unlock, reconcile
    await login(pageA);

    await gotoStable(pageA, '/dashboard/addresses');
    await createOwnedVault(pageA, { passphrase });

    // VaultGate does not auto-unlock after creation
    await unlockWithPassphrase(pageA, passphrase);

    // Force reconcile upload by re-navigating
    await gotoStable(pageA, '/dashboard/addresses');
    await unlockWithPassphrase(pageA, passphrase);

    // Wait for Meta upload to server
    await expect
      .poll(() => Boolean(serverMeta), { timeout: 60000 })
      .toBeTruthy();

    // Assert no whole-Vault conflict
    await expect(pageA.getByTestId('vault-standoff-dialog')).toHaveCount(0);

    // Phase 2: Device B — login, download vault, unlock
    await login(pageB);

    await waitForOwnedVault(pageB, E2E_USER_ID);

    await gotoStable(pageB, '/dashboard/addresses');
    await unlockWithPassphrase(pageB, passphrase);

    // Assert no whole-Vault conflict
    await expect(pageB.getByTestId('vault-standoff-dialog')).toHaveCount(0);

    // Phase 3: Device B writes an address
    await writeAddressToVault(pageB, uniqueAddress, passphrase);

    // Phase 4: Device A — trigger discovery pull
    // Switch to discovery phase before first focus dispatch
    currentPhase = 'discovery';

    // Dispatch focus on Device A to trigger the pull pass
    // (page.bringToFront() is unreliable in headless; use window.dispatchEvent)
    await pageA.evaluate(() => window.dispatchEvent(new Event('focus')));

    // Wait for the address to appear in Device A's DOM after converge
    // (useLocalVaultRevision makes the page reactive to convergeVaultBlob writes)
    await expect(pageA.getByText(uniqueAddress).first()).toBeVisible({
      timeout: 60000,
    });

    // Phase 5: Assert discovery pass results
    // The discovery pass should make exactly one inventory request
    const discoveryInventoryResponses = allResponses.filter(
      (r) => inventoryUrl.test(r.url) && r.phase === 'discovery',
    );
    expect(discoveryInventoryResponses).toHaveLength(1);

    // No per-type reads in the discovery pass should have status 404
    const discoveryBlobResponses = allResponses.filter(
      (r) => vaultBlobUrl.test(r.url) && r.phase === 'discovery',
    );
    for (const response of discoveryBlobResponses) {
      expect(response.status).not.toBe(404);
    }

    // Phase 6: Device A — steady-state pull (second focus)
    // Switch to steady-state phase before second focus dispatch
    currentPhase = 'steady-state';

    // Use waitForResponse to deterministically capture the inventory response
    const inventoryResponsePromise = pageA.waitForResponse((response) =>
      inventoryUrl.test(response.url()),
    );

    // Dispatch second focus
    await pageA.evaluate(() => window.dispatchEvent(new Event('focus')));

    // Wait for the inventory response
    const inventoryResponse = await inventoryResponsePromise;

    // Phase 7: Assert steady-state pass results
    // The inventory should return 304 (nothing changed)
    expect(inventoryResponse.status()).toBe(304);

    // ADR 0087 rule 8: After the pass inspects a 304 response,
    // leftNothingToDo() prevents any per-type reads. The per-type
    // reads are strictly sequential and only initiated after the
    // pass inspects the inventory, so there is no in-flight follow-up
    // request to race — a synchronous check is valid.
    const steadyStateBlobResponses = allResponses.filter(
      (r) => vaultBlobUrl.test(r.url) && r.phase === 'steady-state',
    );
    expect(steadyStateBlobResponses).toHaveLength(0);

    // Assert exactly one inventory request was made in the steady-state pass.
    // A regression firing two inventory requests would pass the test unnoticed
    // without this assertion, because waitForResponse resolves on the first
    // and the listener still active adds the second to the array.
    const steadyStateInventoryResponses = allResponses.filter(
      (r) => inventoryUrl.test(r.url) && r.phase === 'steady-state',
    );
    expect(steadyStateInventoryResponses).toHaveLength(1);

    // Phase 8: Final assertions
    // Across the whole run (all phases), no per-type blob read should have status 404
    const allBlobResponses = allResponses.filter((r) =>
      vaultBlobUrl.test(r.url),
    );
    for (const response of allBlobResponses) {
      expect(response.status).not.toBe(404);
    }

    // No whole-Vault conflict anywhere
    await expect(pageA.getByTestId('vault-standoff-dialog')).toHaveCount(0);
    await expect(pageB.getByTestId('vault-standoff-dialog')).toHaveCount(0);

    await deviceA.close();
    await deviceB.close();
  });
});
