import { expect, test, type Page } from '@playwright/test';

/**
 * Section 4 — End-to-end tests for cloud-vault backup via Google Drive.
 *
 * The tests stub:
 * - Backend `/auth/login`, `/vault/*`, and `/vault/backups[/latest]` routes.
 * - The Google Identity Services script load (`accounts.google.com/gsi/client`).
 * - The Google Drive REST endpoints used by `GoogleDriveCloudBackupProvider`.
 *
 * A full GIS namespace is injected into the browser via `addInitScript` so the
 * page-level `useGoogleIdentityScript` hook resolves immediately and the
 * provider can acquire access tokens through the test-controlled mock.
 *
 * The vault settings page reads the Google Client ID from
 * `window.__MYORG_GOOGLE_CLIENT_ID__` as a runtime fallback, which makes it
 * trivial to enable the cloud-backup section in tests without changing the
 * dev-server environment.
 */

const TEST_CLIENT_ID = 'e2e-google-client-id';

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
  const savedRecoveryKey = page.getByRole('button', { name: 'I saved it' });
  if (await savedRecoveryKey.isVisible({ timeout: 1000 }).catch(() => false)) {
    await savedRecoveryKey.click();
  }
  const usePassphrase = page.getByRole('button', { name: 'Use passphrase' });
  if (await usePassphrase.isVisible({ timeout: 1000 }).catch(() => false)) {
    await usePassphrase.click();
  }
  const input = page.locator('#unlock-passphrase');
  if ((await input.count()) === 0) return;
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

/**
 * Wires up backend mocks and returns a handle to the in-memory state. The
 * `backupRecords` array is mutated directly by the route handlers.
 */
function setupBackend(page: Page) {
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
  // The vault settings ROUTE is `/dashboard/account/vault` and would
  // otherwise match `/\/vault\/?$/`. Anchor these regexes to the API host
  // (anything other than the dev server on port 4200) to avoid intercepting
  // the page navigation itself.
  const vaultMetaUrl = /:\/\/[^/]+\/(?:api\/v\d+\/)?vault\/?(\?.*)?$/;
  const vaultBlobUrl =
    /:\/\/[^/]+\/(?:api\/v\d+\/)?vault\/blob\/(addresses|mobileNumbers|subscriptions|todos)\/?(\?.*)?$/;
  const backupsRecordUrl =
    /:\/\/[^/]+\/(?:api\/v\d+\/)?vault\/backups\/?(\?.*)?$/;
  const backupsLatestUrl =
    /:\/\/[^/]+\/(?:api\/v\d+\/)?vault\/backups\/latest\/?(\?.*)?$/;

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
    const wantSource = url.searchParams.get('source');
    const matching = backupRecords
      .filter((r) =>
        wantStatus ? r.status === wantStatus : r.status === 'success',
      )
      .filter((r) => (wantSource ? r.source === wantSource : true))
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

/**
 * Inject a deterministic Google Identity Services namespace and a fake
 * `appDataFolder` REST surface into the browser BEFORE any page script runs.
 *
 * `tokenFailures` controls the first N silent token attempts. Each entry is
 * either a string error code (e.g. `'consent_required'`) which causes the
 * token client to invoke its callback with `{error}`, or `'ok'` which yields
 * a fresh access token. Interactive (`prompt=consent`) requests always
 * succeed.
 */
async function installGoogleMocks(
  page: Page,
  options?: { tokenFailures?: ReadonlyArray<'ok' | string> },
) {
  // Mock the GIS script load — the loader script itself is irrelevant because
  // we pre-populate `window.google.accounts.oauth2`. We just need the request
  // to resolve so the script tag's `load` event fires.
  await page.route(/accounts\.google\.com\/gsi\/client/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/javascript',
      body: '/* gis stub */',
    });
  });

  // Intercept Drive REST endpoints. State lives in the browser context
  // (via init script) — Playwright cannot share state with `page.route`,
  // so we keep the appDataFolder state inside the browser instead and use
  // route handlers to dispatch into a small worker below. To keep things
  // self-contained, we route into the same in-page handler via window.
  await page.route(
    /^https:\/\/(www\.)?googleapis\.com\/(upload\/)?drive\/v3\/.*/,
    async (route) => {
      const request = route.request();
      const url = request.url();
      const method = request.method();
      const postData = request.postData() ?? null;
      // Marshal the request into the page so the in-browser drive mock
      // (installed via addInitScript) handles it with full state.
      const result = await page.evaluate(
        async ({ url, method, postData }) => {
          const w = window as unknown as {
            __driveMock: (input: {
              url: string;
              method: string;
              postData: string | null;
            }) => Promise<{
              status: number;
              body: string;
              contentType: string;
            }>;
          };
          return await w.__driveMock({ url, method, postData });
        },
        { url, method, postData },
      );
      await route.fulfill({
        status: result.status,
        contentType: result.contentType,
        body: result.body,
      });
    },
  );

  await page.addInitScript(
    ({ clientId, tokenFailures }) => {
      const w = window as unknown as Record<string, unknown>;
      w.__MYORG_GOOGLE_CLIENT_ID__ = clientId;

      // ---- Drive appDataFolder state ----
      type FakeFile = {
        id: string;
        name: string;
        createdTime: string;
        size: number;
        appProperties: Record<string, string>;
        text: string;
      };
      const files = new Map<string, FakeFile>();
      let nextId = 1;

      function json(obj: unknown, status = 200) {
        return {
          status,
          contentType: 'application/json',
          body: JSON.stringify(obj),
        };
      }

      function metadata(file: FakeFile) {
        return {
          id: file.id,
          name: file.name,
          createdTime: file.createdTime,
          modifiedTime: file.createdTime,
          size: String(file.size),
          appProperties: { ...file.appProperties },
        };
      }

      w.__driveMock = async ({
        url,
        method,
        postData,
      }: {
        url: string;
        method: string;
        postData: string | null;
      }) => {
        const u = new URL(url);
        const path = u.pathname;
        // POST /drive/v3/files — create metadata
        if (method === 'POST' && /\/drive\/v3\/files\/?$/.test(path)) {
          const body = postData
            ? (JSON.parse(postData) as Partial<FakeFile> & {
                appProperties?: Record<string, string>;
              })
            : {};
          const id = `file-${nextId++}`;
          const file: FakeFile = {
            id,
            name: String(body.name ?? id),
            createdTime: new Date().toISOString(),
            size: 0,
            appProperties: { ...(body.appProperties ?? {}) },
            text: '',
          };
          files.set(id, file);
          return json({ id });
        }
        // PATCH /upload/drive/v3/files/{id}?uploadType=media — upload body
        const uploadMatch = path.match(/^\/upload\/drive\/v3\/files\/([^/]+)$/);
        if (method === 'PATCH' && uploadMatch) {
          const id = decodeURIComponent(uploadMatch[1]);
          const file = files.get(id);
          if (!file) return json({ error: 'not found' }, 404);
          file.text = postData ?? '';
          file.size = file.text.length;
          return json({ id });
        }
        // PATCH /drive/v3/files/{id}?fields=... — finalize metadata
        const patchMatch = path.match(/^\/drive\/v3\/files\/([^/]+)$/);
        if (method === 'PATCH' && patchMatch) {
          const id = decodeURIComponent(patchMatch[1]);
          const file = files.get(id);
          if (!file) return json({ error: 'not found' }, 404);
          const body = postData
            ? (JSON.parse(postData) as {
                appProperties?: Record<string, string>;
              })
            : {};
          if (body.appProperties) {
            file.appProperties = {
              ...file.appProperties,
              ...body.appProperties,
            };
          }
          return json(metadata(file));
        }
        // GET /drive/v3/files/{id}?alt=media — download text
        if (
          method === 'GET' &&
          patchMatch &&
          u.searchParams.get('alt') === 'media'
        ) {
          const id = decodeURIComponent(patchMatch[1]);
          const file = files.get(id);
          if (!file) return json({ error: 'not found' }, 404);
          return {
            status: 200,
            contentType: 'application/json',
            body: file.text,
          };
        }
        // GET /drive/v3/files?spaces=appDataFolder&q=... — list
        if (
          method === 'GET' &&
          /\/drive\/v3\/files\/?$/.test(path) &&
          u.searchParams.get('spaces') === 'appDataFolder'
        ) {
          const list = Array.from(files.values())
            .filter((f) => f.appProperties.kind === 'myorganizer-vault-backup')
            .sort((a, b) => b.createdTime.localeCompare(a.createdTime))
            .map(metadata);
          return json({ files: list });
        }
        // DELETE /drive/v3/files/{id}
        if (method === 'DELETE' && patchMatch) {
          const id = decodeURIComponent(patchMatch[1]);
          files.delete(id);
          return { status: 204, contentType: 'application/json', body: '' };
        }
        return json({ error: 'unsupported' }, 400);
      };

      // ---- GIS namespace ----
      const failures: Array<'ok' | string> = [...(tokenFailures ?? [])];
      let revoked = false;
      // Test-controlled flag to force the *next* silent token attempt to
      // return `consent_required`, simulating a revoked grant.
      let forceNextSilentFailure = false;
      (w as { __myorgRevokeNext?: () => void }).__myorgRevokeNext = () => {
        forceNextSilentFailure = true;
      };

      type TokenCallback = (resp: {
        access_token?: string;
        expires_in?: number;
        scope?: string;
        token_type?: string;
        error?: string;
        error_description?: string;
      }) => void;

      const accounts = {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string;
            scope: string;
            callback: TokenCallback;
          }) => {
            const client = {
              client_id: cfg.client_id,
              scope: cfg.scope,
              callback: cfg.callback,
              requestAccessToken: (req?: { prompt?: string }) => {
                const interactive =
                  (req?.prompt ?? '') === 'consent' ||
                  (req?.prompt ?? '') === 'select_account';
                queueMicrotask(() => {
                  if (interactive) {
                    revoked = false;
                    forceNextSilentFailure = false;
                    client.callback({
                      access_token: `token-${Math.random().toString(36).slice(2)}`,
                      // Use a tiny TTL so the provider always reacquires on
                      // the silent path, making test-driven failures
                      // deterministic without mocking time.
                      expires_in: 1,
                      scope: cfg.scope,
                      token_type: 'Bearer',
                    });
                    return;
                  }
                  if (forceNextSilentFailure) {
                    forceNextSilentFailure = false;
                    client.callback({ error: 'consent_required' });
                    return;
                  }
                  // Silent path. Honor configured failures (FIFO).
                  const next = failures.shift();
                  if (next && next !== 'ok') {
                    client.callback({ error: next });
                    return;
                  }
                  if (revoked) {
                    client.callback({ error: 'consent_required' });
                    return;
                  }
                  client.callback({
                    access_token: `token-${Math.random().toString(36).slice(2)}`,
                    expires_in: 1,
                    scope: cfg.scope,
                    token_type: 'Bearer',
                  });
                });
              },
            };
            return client;
          },
          revoke: (_token: string, done: () => void) => {
            revoked = true;
            queueMicrotask(done);
          },
        },
      };

      (w as { google?: unknown }).google = { accounts };
    },
    { clientId: TEST_CLIENT_ID, tokenFailures: options?.tokenFailures ?? [] },
  );
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
  await page.getByRole('button', { name: 'Add address' }).first().click();
  await expect(page.getByLabel('Label')).toBeVisible({ timeout: 60000 });
  await page.getByLabel('Label').fill('Home');
  await page.fill('#addr-property', '221B');
  await page.fill('#addr-street', 'Baker Street');
  await page.fill('#addr-suburb', 'London');
  await page.fill('#addr-state', 'Greater London');
  await page.fill('#addr-zipcode', 'NW1');
  await page.locator('#addr-country').click();
  await page.getByText('United Kingdom (GB)').click();
  const addAddress = page.getByRole('button', { name: 'Save address' });
  await expect(addAddress).toBeEnabled({ timeout: 60000 });
  await addAddress.click();
  await expect(page.getByText('221B Baker Street').first()).toBeVisible({
    timeout: 60000,
  });
  return passphrase;
}

async function gotoVaultSettings(page: Page) {
  await gotoStable(page, '/dashboard/account/vault');
  if (
    await page
      .locator('#unlock-passphrase')
      .isVisible({ timeout: 1000 })
      .catch(() => false)
  ) {
    await unlockWithPassphrase(page, 'correct horse battery staple');
  }
}

test.describe('Vault cloud backup via Google Drive (E2E)', () => {
  test('connect + manual backup updates the cloud last-backup record', async ({
    browser,
  }, testInfo) => {
    test.setTimeout(180000);
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    setupBackend(page);
    await installGoogleMocks(page);

    await login(page, {
      webkitDelayMs: testInfo.project.name === 'webkit' ? 1500 : 0,
    });
    await setupVaultWithSampleData(page);

    await gotoVaultSettings(page);

    // Initially disconnected, latest cloud backup empty.
    await expect(page.getByTestId('cloud-backup-card')).toBeVisible({
      timeout: 60000,
    });
    await expect(
      page.getByTestId('cloud-backup-connection-disconnected'),
    ).toBeVisible();
    await expect(page.getByTestId('cloud-backup-latest-empty')).toBeVisible();

    // Connect.
    await page.getByTestId('cloud-backup-connect-button').click();
    await expect(
      page.getByTestId('cloud-backup-connection-connected'),
    ).toBeVisible({ timeout: 30000 });

    // Manual backup.
    const backupNow = page.getByTestId('cloud-backup-now-button');
    await expect(backupNow).toBeEnabled({ timeout: 30000 });
    await backupNow.click();

    // Latest cloud-backup record should appear.
    await expect(page.getByTestId('cloud-backup-latest-recorded')).toBeVisible({
      timeout: 60000,
    });

    await ctx.close();
  });

  test('automatic backup runs when interval is due, then surfaces needs-reconnect on silent token failure', async ({
    browser,
  }, testInfo) => {
    test.setTimeout(180000);
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    setupBackend(page);
    await installGoogleMocks(page);

    await login(page, {
      webkitDelayMs: testInfo.project.name === 'webkit' ? 1500 : 0,
    });
    await setupVaultWithSampleData(page);
    await gotoVaultSettings(page);

    await page.getByTestId('cloud-backup-connect-button').click();
    await expect(
      page.getByTestId('cloud-backup-connection-connected'),
    ).toBeVisible({ timeout: 30000 });

    // Configure a daily interval. With no prior cloud backup, the scheduler
    // treats the next online tick as due.
    await page.getByTestId('cloud-backup-interval-trigger').click();
    await page.getByTestId('cloud-backup-interval-daily').click();

    // Trigger the scheduler immediately rather than waiting for its 15min
    // poll. The scheduler listens for `online` events, so dispatching one
    // forces a `checkOnce`.
    await page.evaluate(() => {
      window.dispatchEvent(new Event('online'));
    });

    // Auto-backup must produce a `cloud-backup-latest-recorded` entry.
    await expect(page.getByTestId('cloud-backup-latest-recorded')).toBeVisible({
      timeout: 60000,
    });

    // Now flip the GIS mock so the next silent token request fails with
    // `consent_required`, then trigger a manual backup. The provider's silent
    // token acquisition should fail and surface `needs-reconnect` in the UI.
    await page.evaluate(() => {
      (
        window as unknown as { __myorgRevokeNext?: () => void }
      ).__myorgRevokeNext?.();
    });

    await page.getByTestId('cloud-backup-now-button').click();

    await expect(
      page.getByTestId('cloud-backup-connection-needs-reconnect'),
    ).toBeVisible({ timeout: 60000 });

    await ctx.close();
  });

  test('restore from cloud after fresh local state, then disconnect', async ({
    browser,
  }, testInfo) => {
    test.setTimeout(180000);
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    setupBackend(page);
    await installGoogleMocks(page);

    await login(page, {
      webkitDelayMs: testInfo.project.name === 'webkit' ? 1500 : 0,
    });
    await setupVaultWithSampleData(page);
    await gotoVaultSettings(page);

    // Connect + backup so something exists in Drive.
    await page.getByTestId('cloud-backup-connect-button').click();
    await expect(
      page.getByTestId('cloud-backup-connection-connected'),
    ).toBeVisible({ timeout: 30000 });
    const backupNow = page.getByTestId('cloud-backup-now-button');
    await expect(backupNow).toBeEnabled({ timeout: 30000 });
    await backupNow.click();
    await expect(page.getByTestId('cloud-backup-latest-recorded')).toBeVisible({
      timeout: 60000,
    });

    // Simulate fresh local state by clearing the local vault.
    await page.evaluate(() => {
      window.localStorage.removeItem('myorganizer_vault_v1');
    });

    // Restore.
    page.once('dialog', (d) => d.accept());
    const restore = page.getByTestId('cloud-backup-restore-button');
    await expect(restore).toBeEnabled({ timeout: 30000 });
    await restore.click();

    // Local vault should be re-materialized from the restore.
    await page.waitForFunction(
      () => Boolean(window.localStorage.getItem('myorganizer_vault_v1')),
      undefined,
      { timeout: 60000 },
    );

    // Disconnect.
    await page.getByTestId('cloud-backup-disconnect-button').click();
    await expect(
      page.getByTestId('cloud-backup-connection-disconnected'),
    ).toBeVisible({ timeout: 30000 });

    await ctx.close();
  });
});
