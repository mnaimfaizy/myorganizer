import { expect, test } from '@playwright/test';

/**
 * E2E tests for tasks management (create / persistence across reload / delete)
 * Uses the vault mocking patterns from `vault.spec.ts` and an in-memory blob store
 * per-test to ensure isolation.
 *
 * Focused test: Create a task with default priority, reload the page,
 * verify the task persists in the vault after unlock.
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

async function login(
  page: import('@playwright/test').Page,
  options: { webkitDelayMs: number },
) {
  // Mock the login API endpoint
  const loginUrl = /\/auth\/login\/?(\?.*)?$/;
  await page.route(loginUrl, async (route) => {
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

  // Wait for page to load - use try/catch to handle parallel test execution
  try {
    await page.waitForLoadState('networkidle', { timeout: 10000 });
  } catch {
    // If networkidle times out in parallel execution, use domcontentloaded instead
    try {
      await page.waitForLoadState('domcontentloaded');
    } catch {
      // Continue anyway - page might be ready enough
    }
  }

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

  // Wait for dashboard to load
  try {
    await page.waitForLoadState('networkidle', { timeout: 10000 });
  } catch {
    try {
      await page.waitForLoadState('domcontentloaded');
    } catch {
      // Continue anyway
    }
  }

  if (options.webkitDelayMs > 0) {
    await page.waitForTimeout(options.webkitDelayMs);
  }
}

async function unlockWithPassphrase(
  page: import('@playwright/test').Page,
  passphrase: string,
) {
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

/**
 * Setup route handlers and an in-memory store for tasks and other blobs.
 */
async function setupRoutes(page: import('@playwright/test').Page) {
  const loginUrl = /\/auth\/login\/?(\?.*)?$/;
  const vaultMetaUrl = /\/vault\/?(\?.*)?$/;
  const vaultBlobUrl =
    /\/vault\/blob\/(addresses|mobileNumbers|subscriptions|todos|tasks)\/?(\?.*)?$/;

  let serverMeta: any = { version: 1 };
  let serverMetaEtag = 'W/"0"';
  let serverMetaUpdatedAt = new Date(0).toISOString();

  const serverBlobs: Record<string, any | null> = {
    addresses: null,
    mobileNumbers: null,
    subscriptions: null,
    todos: null,
    tasks: null,
  };
  const serverBlobEtags: Record<string, string> = {
    addresses: 'W/"0"',
    mobileNumbers: 'W/"0"',
    subscriptions: 'W/"0"',
    todos: 'W/"0"',
    tasks: 'W/"0"',
  };
  const serverBlobUpdatedAt: Record<string, string> = {
    addresses: new Date(0).toISOString(),
    mobileNumbers: new Date(0).toISOString(),
    subscriptions: new Date(0).toISOString(),
    todos: new Date(0).toISOString(),
    tasks: new Date(0).toISOString(),
  };

  // Login route
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

  // Vault meta route
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

  // Vault blob route (handles addresses, mobileNumbers, subscriptions, todos, tasks)
  await page.route(vaultBlobUrl, async (route) => {
    const request = route.request();
    const origin = new URL(page.url() || 'http://localhost:3000').origin;
    const headers = corsHeaders(origin);

    // Extract blob type from URL
    const blobTypeMatch = request
      .url()
      .match(
        /\/vault\/blob\/(addresses|mobileNumbers|subscriptions|todos|tasks)/,
      );
    const blobType = blobTypeMatch ? blobTypeMatch[1] : 'tasks';

    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }

    if (request.method() === 'GET') {
      const blob = serverBlobs[blobType];
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
          type: blobType,
          blob,
          etag: serverBlobEtags[blobType],
          updatedAt: serverBlobUpdatedAt[blobType],
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

      const nextBlob = body?.blob;
      const created = !serverBlobs[blobType];
      serverBlobs[blobType] = nextBlob;
      serverBlobUpdatedAt[blobType] = new Date().toISOString();
      serverBlobEtags[blobType] = `W/"${Date.now()}"`;

      await route.fulfill({
        status: created ? 201 : 200,
        headers,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          etag: serverBlobEtags[blobType],
          updatedAt: serverBlobUpdatedAt[blobType],
        }),
      });
      return;
    }

    await route.fulfill({ status: 405, headers });
  });

  // Give the client time to hydrate.
  await page.waitForLoadState('networkidle');
}

test.describe('Tasks (E2E)', () => {
  test.setTimeout(120000);

  test('should create a task, reload page, and verify task persists', async ({
    page,
    testInfo,
  }) => {
    // Setup mock routes for vault
    await setupRoutes(page);

    // Determine WebKit-specific delay
    const webkitDelayMs = testInfo.project.name === 'webkit' ? 1500 : 0;

    // Step 1: Login
    await login(page, { webkitDelayMs });

    // Step 2: Navigate to tasks page
    await gotoStable(page, '/dashboard/tasks');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Step 3: Create vault (fill passphrase and confirm)
    const setupPassphrase = page.locator('#setup-passphrase');
    const setupConfirm = page.locator('#setup-confirm');

    // Wait for setup form to be visible
    await expect(setupPassphrase).toBeVisible({ timeout: 30000 });

    await setupPassphrase.fill('test-passphrase-12345');
    await setupConfirm.fill('test-passphrase-12345');
    await page.waitForTimeout(250);

    // Click "Create encrypted vault" button
    const createVaultButton = page.getByRole('button', {
      name: /Create encrypted vault|Create Vault/i,
    });
    await expect(createVaultButton).toBeVisible();
    await createVaultButton.click();

    // Step 4: Wait for vault to be created (localStorage should have vault data)
    await page.waitForFunction(
      () => {
        try {
          const vault = localStorage.getItem('myorganizer_vault_v1');
          return Boolean(vault);
        } catch {
          return false;
        }
      },
      { timeout: 30000 },
    );

    // Step 5: Unlock vault with the passphrase
    await unlockWithPassphrase(page, 'test-passphrase-12345');

    // Step 6: Wait for task form to be visible
    await expect(page.getByLabel('Title')).toBeVisible({ timeout: 30000 });

    // Step 7: Fill task title
    await page.getByLabel('Title').fill('Buy groceries for E2E test');

    // Priority is already 'medium' by default (no need to change)

    // Step 8: Submit the form
    const submitButton = page.getByRole('button', { name: 'Add Task' });
    await expect(submitButton).toBeVisible();
    await submitButton.click();

    // Step 9: Wait for task to appear in the task list
    await page.waitForFunction(
      () => {
        const h3Elements = Array.from(document.querySelectorAll('h3'));
        return h3Elements.some((el) =>
          el.textContent?.includes('Buy groceries for E2E test'),
        );
      },
      { timeout: 30000 },
    );

    // Step 10: Verify task is visible with priority
    const taskTitle = page.locator('h3', {
      hasText: 'Buy groceries for E2E test',
    });
    await expect(taskTitle).toBeVisible();

    // Verify priority 'medium' is displayed
    const taskItem = taskTitle.locator('..');
    const priorityBadge = taskItem.locator('span', { hasText: 'medium' });
    await expect(priorityBadge).toBeVisible();

    // Step 11: Reload the page
    await page.reload();

    // Step 12: After reload, vault is locked again - unlock it
    await unlockWithPassphrase(page, 'test-passphrase-12345');

    // Step 13: Wait for task list to appear after unlock
    await page.waitForFunction(
      () => {
        const h3Elements = Array.from(document.querySelectorAll('h3'));
        return h3Elements.some((el) =>
          el.textContent?.includes('Buy groceries for E2E test'),
        );
      },
      { timeout: 30000 },
    );

    // Step 14: Assert task title is visible after reload
    const reloadedTaskTitle = page.locator('h3', {
      hasText: 'Buy groceries for E2E test',
    });
    await expect(reloadedTaskTitle).toBeVisible();

    // Step 15: Verify priority 'medium' is still displayed after reload
    const reloadedTaskItem = reloadedTaskTitle.locator('..');
    const reloadedPriorityBadge = reloadedTaskItem.locator('span', {
      hasText: 'medium',
    });
    await expect(reloadedPriorityBadge).toBeVisible();
  });
});
