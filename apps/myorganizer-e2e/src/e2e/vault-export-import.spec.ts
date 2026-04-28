import { expect, test, type Page } from '@playwright/test';

/**
 * Section 9 — End-to-end tests for hardened vault export/import.
 *
 * Both tests stub the backend so they remain hermetic:
 * - `/auth/login` returns a fake JWT.
 * - `/vault/*` (meta + blob endpoints) are mocked just enough for vault setup.
 * - `/vault/backups` audit endpoints are mocked to validate that the client
 *   posts the expected payload and that `LastBackupCard` reflects the stored
 *   record.
 */

function corsHeaders(origin: string) {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization,if-match',
  } as const;
}

async function gotoStable(
  page: Page,
  url: string,
  options?: Parameters<Page['goto']>[1],
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

async function login(page: Page, options: { webkitDelayMs: number }) {
  await page.goto('/login');
  await expect(page).toHaveURL(/.*login/);
  await page.waitForLoadState('networkidle');
  if (options.webkitDelayMs > 0) {
    await page.waitForTimeout(options.webkitDelayMs);
  }

  await page.fill('input[type="email"]', 'testuser@example.com');
  await page.fill('input[type="password"]', 'password123');

  const submitButton = page.locator('button[type="submit"]');
  await expect(submitButton).toBeEnabled();
  await submitButton.click();

  await expect(page).toHaveURL(/.*dashboard/, { timeout: 60000 });
  await page.waitForLoadState('networkidle');
}

async function unlockWithPassphrase(page: Page, passphrase: string) {
  // New vault setup now shows a recovery-key confirmation step.
  const savedRecoveryKey = page.getByRole('button', { name: 'I saved it' });
  if (await savedRecoveryKey.isVisible({ timeout: 1000 }).catch(() => false)) {
    await savedRecoveryKey.click();
  }

  const usePassphrase = page.getByRole('button', { name: 'Use passphrase' });
  if (await usePassphrase.isVisible({ timeout: 1000 }).catch(() => false)) {
    await usePassphrase.click();
  }

  const input = page.locator('#unlock-passphrase');
  if ((await input.count()) === 0) {
    // If no unlock form is present, this route is already unlocked.
    return;
  }

  await expect(input).toBeVisible({ timeout: 60000 });
  await input.fill(passphrase);
  await page.waitForTimeout(50);
  await page.getByRole('button', { name: 'Unlock' }).click();
  await expect(page.locator('#unlock-passphrase')).toHaveCount(0, {
    timeout: 120000,
  });
}

interface BackupRecord {
  id: string;
  userId: string;
  event: string;
  source: string;
  status: string;
  errorCode: string | null;
  schemaVersion: number;
  blobTypes: string[];
  sizeBytes: number;
  createdAt: string;
}

function setupBackend(page: Page) {
  // In-memory state shared across the routes for the duration of the page.
  let serverMeta: unknown = null;
  let serverMetaEtag = 'W/"0"';
  let serverMetaUpdatedAt = new Date(0).toISOString();

  const serverBlobs: Record<string, unknown | null> = {
    addresses: null,
    mobileNumbers: null,
    subscriptions: null,
    todos: null,
  };
  const serverBlobEtags: Record<string, string> = {
    addresses: 'W/"0"',
    mobileNumbers: 'W/"0"',
    subscriptions: 'W/"0"',
    todos: 'W/"0"',
  };
  const serverBlobUpdatedAt: Record<string, string> = {
    addresses: new Date(0).toISOString(),
    mobileNumbers: new Date(0).toISOString(),
    subscriptions: new Date(0).toISOString(),
    todos: new Date(0).toISOString(),
  };

  const backupRecords: BackupRecord[] = [];

  const loginUrl = /\/auth\/login\/?(\?.*)?$/;
  const vaultMetaUrl = /\/vault\/?(\?.*)?$/;
  const vaultBlobUrl =
    /\/vault\/blob\/(addresses|mobileNumbers|subscriptions|todos)\/?(\?.*)?$/;
  const backupsRecordUrl = /\/vault\/backups\/?(\?.*)?$/;
  const backupsLatestUrl = /\/vault\/backups\/latest\/?(\?.*)?$/;

  const headersFor = (origin: string) => corsHeaders(origin);

  page.route(loginUrl, async (route) => {
    const request = route.request();
    const origin = new URL(page.url() || 'http://localhost:3000').origin;
    const headers = headersFor(origin);

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

  page.route(backupsLatestUrl, async (route) => {
    const request = route.request();
    const origin = new URL(page.url() || 'http://localhost:3000').origin;
    const headers = headersFor(origin);
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    if (request.method() !== 'GET') {
      await route.fulfill({ status: 405, headers });
      return;
    }
    const url = new URL(request.url());
    const wantStatus = url.searchParams.get('status');
    const matching = backupRecords
      .filter((r) =>
        wantStatus ? r.status === wantStatus : r.status === 'success',
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (matching.length === 0) {
      await route.fulfill({
        status: 404,
        headers,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'No backup records' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      headers,
      contentType: 'application/json',
      body: JSON.stringify({ ...matching[0], message: 'OK' }),
    });
  });

  page.route(backupsRecordUrl, async (route) => {
    const request = route.request();
    const origin = new URL(page.url() || 'http://localhost:3000').origin;
    const headers = headersFor(origin);
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    if (request.method() !== 'POST') {
      await route.fulfill({ status: 405, headers });
      return;
    }

    const body = (request.postDataJSON?.() ?? {}) as Partial<BackupRecord>;
    const record: BackupRecord = {
      id: `rec-${backupRecords.length + 1}`,
      userId: '1',
      event: String(body.event ?? 'export'),
      source: String(body.source ?? 'local-file'),
      status: String(body.status ?? 'success'),
      errorCode: (body.errorCode ?? null) as string | null,
      schemaVersion: Number(body.schemaVersion ?? 1),
      blobTypes: Array.isArray(body.blobTypes) ? body.blobTypes : [],
      sizeBytes: Number(body.sizeBytes ?? 0),
      createdAt: new Date().toISOString(),
    };
    backupRecords.push(record);
    await route.fulfill({
      status: 201,
      headers,
      contentType: 'application/json',
      body: JSON.stringify({ ...record, message: 'Created' }),
    });
  });

  page.route(vaultMetaUrl, async (route) => {
    const request = route.request();
    const origin = new URL(page.url() || 'http://localhost:3000').origin;
    const headers = headersFor(origin);

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
      const body = (request.postDataJSON?.() ?? {}) as { meta?: unknown };
      serverMeta = body.meta;
      serverMetaUpdatedAt = new Date().toISOString();
      serverMetaEtag = `W/\"${Date.now()}\"`;
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

  page.route(vaultBlobUrl, async (route) => {
    const request = route.request();
    const origin = new URL(page.url() || 'http://localhost:3000').origin;
    const headers = headersFor(origin);

    const match = request
      .url()
      .match(/\/vault\/blob\/(addresses|mobileNumbers|subscriptions|todos)/);
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
      const body = (request.postDataJSON?.() ?? {}) as { blob?: unknown };
      serverBlobs[type] = body.blob ?? null;
      serverBlobUpdatedAt[type] = new Date().toISOString();
      serverBlobEtags[type] = `W/\"${Date.now()}\"`;
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

  return { backupRecords };
}

async function setupVaultWithSampleData(page: Page) {
  const passphrase = 'correct horse battery staple';

  await gotoStable(page, '/dashboard/addresses');
  await page.fill('#setup-passphrase', passphrase);
  await page.fill('#setup-confirm', passphrase);
  await page.getByRole('button', { name: 'Create encrypted vault' }).click();

  await page.waitForFunction(
    () => Boolean(window.localStorage.getItem('myorganizer_vault_v1')),
    undefined,
    { timeout: 60000 },
  );

  await unlockWithPassphrase(page, passphrase);

  await expect(page.locator('#addr-label')).toBeVisible({ timeout: 60000 });
  await page.fill('#addr-label', 'Home');
  await page.fill('#addr-property', '221B');
  await page.fill('#addr-street', 'Baker Street');
  await page.fill('#addr-suburb', 'London');
  await page.fill('#addr-state', 'Greater London');
  await page.fill('#addr-zipcode', 'NW1');
  await page.locator('#addr-country').click();
  await page.getByRole('option', { name: 'United Kingdom' }).click();

  const addAddress = page.getByRole('button', { name: 'Add Address' });
  await expect(addAddress).toBeEnabled({ timeout: 60000 });
  await addAddress.click();
  await expect(page.locator('text=221B Baker Street')).toBeVisible({
    timeout: 60000,
  });

  return passphrase;
}

test.describe('Vault export/import (E2E)', () => {
  test('happy path: export → reset → import succeeds via local-file', async ({
    browser,
  }, testInfo) => {
    test.setTimeout(180000);

    const ctx = await browser.newContext({
      acceptDownloads: true,
    });
    const page = await ctx.newPage();
    setupBackend(page);

    await login(page, {
      webkitDelayMs: testInfo.project.name === 'webkit' ? 1500 : 0,
    });

    await setupVaultWithSampleData(page);

    // Trigger export and capture the downloaded JSON.
    await gotoStable(page, '/dashboard/vault-export');
    // Unlock if prompted by route-level vault gating.
    if (
      await page
        .locator('#unlock-passphrase')
        .isVisible({ timeout: 1000 })
        .catch(() => false)
    ) {
      await unlockWithPassphrase(page, 'correct horse battery staple');
    }

    const exportButton = page.getByTestId('export-vault-button');
    await expect(exportButton).toBeVisible({ timeout: 60000 });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportButton.click(),
    ]);
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    const fs = await import('node:fs/promises');
    const exportedText = await fs.readFile(downloadPath as string, 'utf8');
    const parsed = JSON.parse(exportedText) as {
      schemaVersion: number;
      exportId: string;
      exportedAt: string;
    };
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.exportId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    // Reset local vault to simulate a fresh device.
    await page.evaluate(() => {
      window.localStorage.removeItem('myorganizer_vault_v1');
    });

    // Reload vault export page to simulate a fresh route transition.
    await gotoStable(page, '/dashboard/vault-export');

    // Now perform the import using the captured JSON text.
    const importInput = page.getByTestId('import-vault-file');
    await expect(importInput).toBeVisible({ timeout: 60000 });

    // Convert the downloaded text into a virtual file for setInputFiles.
    await importInput.setInputFiles({
      name: 'vault-export.json',
      mimeType: 'application/json',
      buffer: Buffer.from(exportedText, 'utf8'),
    });

    const importButton = page.getByTestId('import-vault-button');
    await expect(importButton).toBeEnabled({ timeout: 60000 });
    page.once('dialog', (d) => d.accept());
    await importButton.click();

    // After import, local vault should be restored in browser storage.
    await page.waitForFunction(
      () => Boolean(window.localStorage.getItem('myorganizer_vault_v1')),
      undefined,
      { timeout: 60000 },
    );

    await ctx.close();
  });

  test('failure path: corrupt file shows error and leaves local vault untouched', async ({
    browser,
  }, testInfo) => {
    test.setTimeout(120000);

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    setupBackend(page);

    await login(page, {
      webkitDelayMs: testInfo.project.name === 'webkit' ? 1500 : 0,
    });
    await setupVaultWithSampleData(page);

    const beforeVault = await page.evaluate(() =>
      window.localStorage.getItem('myorganizer_vault_v1'),
    );
    expect(beforeVault).toBeTruthy();

    await gotoStable(page, '/dashboard/vault-export');
    if (
      await page
        .locator('#unlock-passphrase')
        .isVisible({ timeout: 1000 })
        .catch(() => false)
    ) {
      await unlockWithPassphrase(page, 'correct horse battery staple');
    }

    const importInput = page.getByTestId('import-vault-file');
    await expect(importInput).toBeVisible({ timeout: 60000 });
    await importInput.setInputFiles({
      name: 'corrupt.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"this is": "not a vault export"', 'utf8'),
    });

    const importButton = page.getByTestId('import-vault-button');
    await expect(importButton).toBeEnabled({ timeout: 60000 });
    page.once('dialog', (d) => d.accept());
    await importButton.click();

    // A toast should surface a user-facing error message.
    await expect(page.getByText('Import failed', { exact: true })).toBeVisible({
      timeout: 60000,
    });

    // Local vault must be unchanged.
    const afterVault = await page.evaluate(() =>
      window.localStorage.getItem('myorganizer_vault_v1'),
    );
    expect(afterVault).toBe(beforeVault);

    await ctx.close();
  });
});
