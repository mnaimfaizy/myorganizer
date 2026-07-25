import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Platform Admin console — access control + user directory smoke (issue #204).
 *
 * Hermetic stubs:
 * - `/auth/refresh` returns the seeded persona or 401 for guests (OPTIONS + GET/POST).
 * - `GET /admin/users` returns mock AdminUserIdentity rows (OPTIONS + GET).
 *
 * No live third-party services or admin mutation endpoints.
 */

interface PersonaUser {
  id: string;
  name: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'user' | 'platform_admin';
  disabled: boolean;
}

interface AdminUserIdentityRow {
  id: string;
  name: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'user' | 'platform_admin';
  disabled: boolean;
  emailVerified: boolean;
}

function corsHeaders(origin: string) {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization',
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

async function seedSession(page: Page, user: PersonaUser) {
  await page.addInitScript((seedUser: PersonaUser) => {
    window.localStorage.setItem('myorganizer_access_token', 'fake-jwt-token');
    window.localStorage.setItem('myorganizer_token_storage', 'local');
    window.localStorage.setItem('myorganizer_user', JSON.stringify(seedUser));
  }, user);
}

async function stubAuthRefresh(page: Page, user: PersonaUser) {
  const refreshUrl = /\/auth\/refresh\/?(\?.*)?$/;

  await page.route(refreshUrl, async (route) => {
    const origin = new URL(page.url() || 'http://localhost:4200').origin;
    const headers = corsHeaders(origin);

    if (route.request().method() === 'OPTIONS') {
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
        user,
      }),
    });
  });
}

async function stubAuthRefreshUnauthorized(page: Page) {
  const refreshUrl = /\/auth\/refresh\/?(\?.*)?$/;

  await page.route(refreshUrl, async (route) => {
    const origin = new URL(page.url() || 'http://localhost:4200').origin;
    const headers = corsHeaders(origin);

    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }

    await route.fulfill({
      status: 401,
      headers,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Unauthorized' }),
    });
  });
}

function filterDirectoryUsers(
  users: AdminUserIdentityRow[],
  query: string | null,
): AdminUserIdentityRow[] {
  const q = query?.trim().toLowerCase();
  if (!q) {
    return users;
  }

  return users.filter((user) => {
    const haystack = [
      user.name,
      user.email,
      user.firstName,
      user.lastName,
      `${user.firstName} ${user.lastName}`,
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(q);
  });
}

async function stubAdminUsersList(page: Page, users: AdminUserIdentityRow[]) {
  const adminUsersUrl = /\/admin\/users\/?(\?.*)?$/;

  await page.route(adminUsersUrl, async (route) => {
    const origin = new URL(page.url() || 'http://localhost:4200').origin;
    const headers = corsHeaders(origin);
    const request = route.request();

    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }

    if (request.method() !== 'GET') {
      await route.continue();
      return;
    }

    const url = new URL(request.url());
    const payload = filterDirectoryUsers(users, url.searchParams.get('q'));

    await route.fulfill({
      status: 200,
      headers,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    });
  });
}

function getUsersDirectoryTable(page: Page): Locator {
  return page.getByRole('table');
}

async function expectDirectoryRow(
  table: Locator,
  displayName: string,
  expected: {
    email: string;
    roleLabel: string;
    disabledLabel: string;
    emailVerifiedLabel: string;
  },
) {
  const row = table.getByRole('row').filter({ hasText: displayName });
  await expect(row).toBeVisible();
  await expect(row).toContainText(expected.email);
  await expect(row).toContainText(expected.roleLabel);
  await expect(row).toContainText(expected.disabledLabel);
  await expect(row).toContainText(expected.emailVerifiedLabel);
}

const NORMAL_USER: PersonaUser = {
  id: 'u-normal',
  name: 'Normal User',
  email: 'user@example.com',
  firstName: 'Normal',
  lastName: 'User',
  role: 'user',
  disabled: false,
};

const PLATFORM_ADMIN: PersonaUser = {
  id: 'a-session',
  name: 'Session Admin',
  email: 'session-admin@example.com',
  firstName: 'Session',
  lastName: 'Admin',
  role: 'platform_admin',
  disabled: false,
};

const MOCK_DIRECTORY_USERS: AdminUserIdentityRow[] = [
  {
    id: 'u-1',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    role: 'user',
    disabled: false,
    emailVerified: true,
  },
  {
    id: 'a-1',
    name: 'Admin One',
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'One',
    role: 'platform_admin',
    disabled: false,
    emailVerified: true,
  },
];

test.describe('Platform Admin console', () => {
  test('guest cannot access /admin', async ({ page }) => {
    test.setTimeout(60000);

    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await stubAuthRefreshUnauthorized(page);

    await gotoStable(page, '/admin');

    await expect(page).toHaveURL(/.*login/, { timeout: 60000 });
    await expect(page.locator('h1')).toContainText('Login');
  });

  test('normal user is redirected away from /admin', async ({ page }) => {
    test.setTimeout(60000);

    await seedSession(page, NORMAL_USER);
    await stubAuthRefresh(page, NORMAL_USER);

    await gotoStable(page, '/admin');

    await expect(page).toHaveURL(/.*dashboard/, { timeout: 60000 });
    await expect(page).not.toHaveURL(/.*\/admin/);
  });

  test('platform admin reaches user directory smoke', async ({ page }) => {
    test.setTimeout(60000);

    await seedSession(page, PLATFORM_ADMIN);
    await stubAuthRefresh(page, PLATFORM_ADMIN);
    await stubAdminUsersList(page, MOCK_DIRECTORY_USERS);

    await gotoStable(page, '/admin');

    await expect(page).toHaveURL(/.*\/admin\/users(?:\/|$|\?)/, {
      timeout: 60000,
    });

    await expect(
      page.getByRole('heading', { name: 'Users', level: 1 }),
    ).toBeVisible({ timeout: 60000 });

    const table = getUsersDirectoryTable(page);
    await expect(table).toBeVisible();

    for (const column of [
      'Name',
      'Email',
      'Role',
      'Disabled',
      'Email verified',
    ]) {
      await expect(
        table.getByRole('columnheader', { name: column }),
      ).toBeVisible();
    }

    await expectDirectoryRow(table, 'Ada Lovelace', {
      email: 'ada@example.com',
      roleLabel: 'User',
      disabledLabel: 'No',
      emailVerifiedLabel: 'Yes',
    });
    await expectDirectoryRow(table, 'Admin One', {
      email: 'admin@example.com',
      roleLabel: 'Platform Admin',
      disabledLabel: 'No',
      emailVerifiedLabel: 'Yes',
    });

    await expect(table.getByRole('link', { name: 'View' })).toHaveCount(2);

    await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Users' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Audit Log' })).toBeVisible();
  });

  test('directory search keeps the user on the users page', async ({
    page,
  }) => {
    test.setTimeout(60000);

    await seedSession(page, PLATFORM_ADMIN);
    await stubAuthRefresh(page, PLATFORM_ADMIN);
    await stubAdminUsersList(page, MOCK_DIRECTORY_USERS);

    await gotoStable(page, '/admin/users');

    await expect(
      page.getByRole('heading', { name: 'Users', level: 1 }),
    ).toBeVisible({ timeout: 60000 });

    const searchInput = page.getByRole('textbox', { name: 'Search users' });
    await searchInput.fill('Ada');
    await page.getByRole('button', { name: 'Search' }).click();

    await expect(page).toHaveURL(/.*\/admin\/users(?:\/|$|\?)/, {
      timeout: 60000,
    });
    await expect(
      page.getByRole('heading', { name: 'Users', level: 1 }),
    ).toBeVisible();

    const table = getUsersDirectoryTable(page);
    await expect(table).toBeVisible({ timeout: 60000 });
    await expectDirectoryRow(table, 'Ada Lovelace', {
      email: 'ada@example.com',
      roleLabel: 'User',
      disabledLabel: 'No',
      emailVerifiedLabel: 'Yes',
    });
    await expect(
      table.getByRole('row').filter({ hasText: 'Admin One' }),
    ).toHaveCount(0, { timeout: 60000 });
  });
});
