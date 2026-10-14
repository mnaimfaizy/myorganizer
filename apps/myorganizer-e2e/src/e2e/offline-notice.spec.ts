import { expect, test, type Page } from '@playwright/test';
import {
  gotoStable,
  login,
  setupBackend,
  waitForLoginFormInteractive,
  type IdentityEntry,
} from './helpers';

/**
 * Offline notice end-to-end.
 *
 * The dashboard layout mounts OfflineNotice between the header and the route
 * content. It shows while the browser reports no connection and goes away when
 * the browser reconnects. It is a browser signal, not a server reachability
 * check, and it is not mounted outside /dashboard. Component behaviour is
 * covered in Jest; this spec drives the browser's own offline state through
 * the browser context.
 */

const OFFLINE_COPY =
  "You're offline. Vault changes are saved on this device and sync when you reconnect. Other changes need a connection.";

const EMAIL = 'offline-notice-01@example.com';
const LOGIN_FIXTURE = 'offline-e2e-01';

const IDENTITIES: IdentityEntry[] = [
  {
    match: 'offline-notice-01',
    userId: 'offline-notice-1',
    userName: 'Offline Notice Owner',
  },
];

/**
 * Sign in and land on the dashboard. `login()` waits for the dashboard shell
 * and the mount-time vault work to settle. The spec deliberately does not
 * `gotoStable` to a deeper dashboard route afterwards: that remounts
 * VaultSessionProvider after login and is a known race.
 */
async function signInToDashboard(page: Page) {
  setupBackend(page, IDENTITIES);
  await login(page, EMAIL, LOGIN_FIXTURE);
  await expect(page).toHaveURL(/.*dashboard/);
}

test.describe('Offline notice (E2E)', () => {
  test.afterEach(async ({ page }) => {
    // Restore the connection even when an assertion fails, so the context
    // is never left offline for the teardown.
    await page.context().setOffline(false);
  });

  test('is absent on a dashboard route while the browser is online', async ({
    page,
  }) => {
    test.setTimeout(120000);

    await signInToDashboard(page);

    await expect(page.getByTestId('offline-notice')).toHaveCount(0);
  });

  test('appears with the copy when the browser goes offline', async ({
    page,
  }) => {
    test.setTimeout(120000);

    await signInToDashboard(page);

    // No navigation or reload while offline: the notice reacts to the
    // browser's offline event on the page the user is already on.
    await page.context().setOffline(true);

    const notice = page.getByTestId('offline-notice');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText(OFFLINE_COPY);
    await expect(page.getByTestId('offline-notice-status')).toHaveText(
      OFFLINE_COPY,
    );
  });

  test('disappears and empties the live region when the browser comes back online', async ({
    page,
  }) => {
    test.setTimeout(120000);

    await signInToDashboard(page);

    await page.context().setOffline(true);
    await expect(page.getByTestId('offline-notice')).toBeVisible();

    await page.context().setOffline(false);

    await expect(page.getByTestId('offline-notice')).toHaveCount(0);
    await expect(page.getByTestId('offline-notice-status')).toBeEmpty();
  });

  test('is not mounted on the sign-in page', async ({ page }) => {
    test.setTimeout(120000);

    setupBackend(page, IDENTITIES);
    await gotoStable(page, '/login');
    await waitForLoginFormInteractive(page);

    await page.context().setOffline(true);
    // Count 0 only means something if the browser really went offline, so
    // prove that before asserting the notice stayed away.
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);

    await expect(page.getByTestId('offline-notice')).toHaveCount(0);
    await expect(page.getByTestId('offline-notice-status')).toHaveCount(0);
  });
});
