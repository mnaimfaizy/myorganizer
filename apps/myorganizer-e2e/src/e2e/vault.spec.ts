import { expect, test } from '@playwright/test';

async function unlockWithPassphrase(
  page: import('@playwright/test').Page,
  passphrase: string
) {
  // Ensure we are in passphrase mode (VaultGate has a toggle).
  const usePassphrase = page.getByRole('button', { name: 'Use passphrase' });
  if (await usePassphrase.isVisible()) {
    await usePassphrase.click();
  }

  const input = page.locator('#unlock-passphrase');
  await expect(input).toBeVisible({ timeout: 60000 });

  // VaultGate's Unlock handler reads React state; give React a beat to
  // reconcile the controlled input value before clicking Unlock.
  await input.fill(passphrase);
  await page.waitForTimeout(50);

  await page.getByRole('button', { name: 'Unlock' }).click();
  await expect(page.locator('#unlock-passphrase')).toHaveCount(0, {
    timeout: 120000,
  });
}

async function login(
  page: import('@playwright/test').Page,
  options: { webkitDelayMs: number }
) {
  await page.goto('/login');
  await expect(page).toHaveURL(/.*login/);
  await expect(page.locator('h1')).toContainText('Login');

  // Give the app time to hydrate and attach event handlers.
  await page.waitForLoadState('networkidle');
  if (options.webkitDelayMs > 0) {
    await page.waitForTimeout(options.webkitDelayMs);
  }

  await page.fill('input[type="email"]', 'testuser@example.com');
  await page.fill('input[type="password"]', 'password123');

  const submitButton = page.locator('button[type="submit"]');
  await expect(submitButton).toBeVisible();
  await expect(submitButton).toBeEnabled();
  await submitButton.click();

  await expect(page).toHaveURL(/.*dashboard/, { timeout: 60000 });

  // Wait for any post-login client-side redirects/effects to settle before
  // we navigate away (WebKit can be particularly sensitive here).
  await page.waitForLoadState('networkidle');
  if (options.webkitDelayMs > 0) {
    await page.waitForTimeout(options.webkitDelayMs);
  }
}

async function gotoStable(
  page: import('@playwright/test').Page,
  url: string,
  options?: Parameters<import('@playwright/test').Page['goto']>[1]
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

test.describe('Vault (E2E)', () => {
  test('should create vault, sync to server, then load on a new session', async ({
    browser,
  }, testInfo) => {
    test.setTimeout(120000);

    // In-memory "server" backing store shared across both sessions.
    let serverMeta: any | null = null;
    let serverMetaEtag = 'W/"0"';
    let serverMetaUpdatedAt = new Date(0).toISOString();

    const serverBlobs: Record<string, any | null> = {
      addresses: null,
      mobileNumbers: null,
    };
    const serverBlobEtags: Record<string, string> = {
      addresses: 'W/"0"',
      mobileNumbers: 'W/"0"',
    };
    const serverBlobUpdatedAt: Record<string, string> = {
      addresses: new Date(0).toISOString(),
      mobileNumbers: new Date(0).toISOString(),
    };

    async function setupRoutes(page: import('@playwright/test').Page) {
      const loginUrl = /\/auth\/login\/?(\?.*)?$/;
      const vaultMetaUrl = /\/vault\/?(\?.*)?$/;
      const vaultBlobUrl =
        /\/vault\/blob\/(addresses|mobileNumbers)\/?(\?.*)?$/;

      await page.route(loginUrl, async (route) => {
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

      await page.route(vaultMetaUrl, async (route) => {
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
          const created = !serverMeta;

          serverMeta = nextMeta;
          serverMetaUpdatedAt = new Date().toISOString();
          serverMetaEtag = `W/\"${Date.now()}\"`;

          await route.fulfill({
            status: created ? 201 : 200,
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

      await page.route(vaultBlobUrl, async (route) => {
        const request = route.request();
        const origin = new URL(page.url() || 'http://localhost:3000').origin;
        const headers = corsHeaders(origin);

        const match = request
          .url()
          .match(/\/vault\/blob\/(addresses|mobileNumbers)/);
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

          const created = !serverBlobs[type];
          serverBlobs[type] = nextBlob;
          serverBlobUpdatedAt[type] = new Date().toISOString();
          serverBlobEtags[type] = `W/\"${Date.now()}\"`;

          await route.fulfill({
            status: created ? 201 : 200,
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

      // Give the client time to hydrate (mirrors existing auth test behavior).
      await page.waitForLoadState('networkidle');
      if (testInfo.project.name === 'webkit') {
        await page.waitForTimeout(1500);
      }
    }

    // Session 1: create local vault + data
    const ctx1 = await browser.newContext();
    const page1 = await ctx1.newPage();
    await setupRoutes(page1);

    await login(page1, {
      webkitDelayMs: testInfo.project.name === 'webkit' ? 1500 : 0,
    });

    const passphrase = 'correct horse battery staple';

    await gotoStable(page1, '/dashboard/addresses');
    await page1.fill('#setup-passphrase', passphrase);
    await page1.fill('#setup-confirm', passphrase);
    await page1.getByRole('button', { name: 'Create encrypted vault' }).click();

    // PBKDF2 can take a while; treat vault creation as complete when
    // local storage contains the vault payload.
    await page1.waitForFunction(
      () => Boolean(window.localStorage.getItem('myorganizer_vault_v1')),
      undefined,
      { timeout: 60000 }
    );

    // VaultGate does not auto-unlock after creation.
    await unlockWithPassphrase(page1, passphrase);

    await expect(page1.locator('#addr-label')).toBeVisible({ timeout: 60000 });

    await page1.fill('#addr-label', 'Home');
    await page1.fill('#addr-address', '221B Baker Street, London');
    const addAddress = page1.getByRole('button', { name: 'Add' });
    await expect(addAddress).toBeEnabled({ timeout: 60000 });
    await addAddress.click();
    await expect(page1.locator('text=221B Baker Street, London')).toBeVisible({
      timeout: 60000,
    });

    await gotoStable(page1, '/dashboard/mobile-numbers');
    await unlockWithPassphrase(page1, passphrase);

    await page1.fill('#mn-label', 'Personal');
    await page1.fill('#mn-number', '+1 555 123 4567');
    const addMobile = page1.getByRole('button', { name: 'Add' });
    await expect(addMobile).toBeEnabled({ timeout: 60000 });
    await addMobile.click();
    await expect(page1.locator('text=+1 555 123 4567')).toBeVisible({
      timeout: 60000,
    });

    // Force the migration runner to re-run now that we have a local vault.
    await page1.evaluate(() => {
      window.sessionStorage.removeItem('myorganizer_vault_migration_ran_v1');
    });
    await gotoStable(page1, '/dashboard');

    // The runner should upload to server (our in-memory store should now be populated).
    await expect
      .poll(() => Boolean(serverMeta), { timeout: 60000 })
      .toBeTruthy();
    await expect
      .poll(() => Boolean(serverBlobs.addresses), { timeout: 60000 })
      .toBeTruthy();
    await expect
      .poll(() => Boolean(serverBlobs.mobileNumbers), { timeout: 60000 })
      .toBeTruthy();

    await ctx1.close();

    // Session 2: new device/session should download from server and show data after unlock.
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    await setupRoutes(page2);

    await login(page2, {
      webkitDelayMs: testInfo.project.name === 'webkit' ? 1500 : 0,
    });

    // Migration runner should download the server vault into local storage.
    await page2.waitForFunction(
      () => Boolean(window.localStorage.getItem('myorganizer_vault_v1')),
      undefined,
      { timeout: 60000 }
    );

    await gotoStable(page2, '/dashboard/addresses');
    await unlockWithPassphrase(page2, passphrase);
    await expect(page2.locator('text=221B Baker Street, London')).toBeVisible({
      timeout: 60000,
    });

    await gotoStable(page2, '/dashboard/mobile-numbers');
    await unlockWithPassphrase(page2, passphrase);
    await expect(page2.locator('text=+1 555 123 4567')).toBeVisible({
      timeout: 60000,
    });

    await ctx2.close();
  });
});
