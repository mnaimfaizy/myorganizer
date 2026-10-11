import { expect, test, type Page, type Response } from '@playwright/test';
import {
  gotoStable,
  routeApi,
  setNetworkDown,
  waitForLoginFormInteractive,
} from './helpers';

/**
 * Offline service worker end-to-end (ADR 0127, PRD #1114).
 *
 * The worker is hand-written in apps/myorganizer/public/sw.js. It holds only
 * the offline page and the static files it needs, and answers a navigation
 * that fails with that page. It never answers an API request. Registration is
 * production-only: the dev server must not register a worker at all.
 *
 * The public pages used here (/login, /) need no auth and no vault. Each test
 * gets a fresh context, so worker registrations and Cache Storage start empty.
 *
 * Going offline goes through `setNetworkDown` (helpers/networkOutage.ts), not
 * `context.setOffline` alone: the worker keeps reaching the network after
 * `setOffline`, so the outage needs a request-level abort as well.
 *
 * Per-browser coverage (production build; Chromium is the required lane,
 * Firefox and WebKit are nightly lanes):
 * - Chromium runs every test, including the three outage tests and the
 *   `fromServiceWorker()` assertions.
 * - Firefox runs every test except the three outage tests. Playwright's Firefox
 *   offline emulation fails the navigation before the worker answers it.
 * - WebKit runs every test except the three outage tests and the API
 *   pass-through test. Playwright's WebKit does not apply the API stub to the
 *   cross-origin request of a worker-controlled page.
 * - `fromServiceWorker()` assertions run on Chromium only.
 * Real-device behaviour, including iOS Safari, is covered by the QA Plan (#1122).
 */

// Mirrors playwright.config.ts: E2E_DEV_SERVER=1 swaps in the dev server.
const useDevServer = Boolean(process.env['E2E_DEV_SERVER']);

// The worker's cache name (CACHE_NAME in sw.js). Bumping it means updating this.
const OFFLINE_CACHE_NAME = 'myorganizer-offline-v1';

const OUTAGE_CHROMIUM_ONLY_REASON =
  'Playwright can only emulate an outage that reaches a service worker in Chromium; Firefox and WebKit fail the navigation before the worker answers. Real-device behaviour is checked by the QA Plan (#1122).';

const PASSTHROUGH_WEBKIT_REASON =
  "Playwright's WebKit does not apply the API stub to a cross-origin request made by a worker-controlled page. Real-device behaviour is checked by the QA Plan (#1122).";

/**
 * Resolve once a worker is active and controls this page. `ready` resolves
 * before `controller` is set, so the controller is polled before any test goes
 * offline. `ready` is awaited inside the browser and returns void, because a
 * ServiceWorkerRegistration cannot be serialised back to the test.
 */
async function waitForWorkerControl(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), {
      timeout: 60000,
    })
    .toBe(true);
}

async function waitForOffline(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
}

/**
 * The offline page listens for `online` only once React has hydrated it, and
 * an `online` event delivered earlier is lost. Each attempt cycles the network
 * (down, then up, so every attempt fires a fresh `online`) and waits for the
 * document to reload. A lost event leaves the offline page in place and the
 * next attempt is tried.
 *
 * A reload is detected by its `load` event, not by polling the page: a reload
 * destroys the execution context, so `page.evaluate` can throw mid-loop, and a
 * retried loop body must not run against the recovered page.
 */
async function recoverWhenOfflinePageHydrated(page: Page): Promise<void> {
  const context = page.context();
  await expect(async () => {
    await setNetworkDown(context, true);
    await waitForOffline(page);
    await Promise.all([
      page.waitForEvent('load', { timeout: 10000 }),
      setNetworkDown(context, false),
    ]);
  }).toPass({ timeout: 60000 });
}

/**
 * Read the worker's cache: its names, and the pathname of every entry in the
 * offline store. Runs in the browser, which can read the same origin's caches.
 */
async function readOfflineStore(page: Page): Promise<{
  names: string[];
  pathnames: string[];
}> {
  return page.evaluate(async (cacheName) => {
    const names = await caches.keys();
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();
    return {
      names,
      pathnames: requests.map((request) => new URL(request.url).pathname),
    };
  }, OFFLINE_CACHE_NAME);
}

test.describe('Offline service worker (E2E)', () => {
  test.afterEach(async ({ page }) => {
    // Restore the network even when an assertion fails, so the context is
    // never left down for teardown. The abort route becomes a pass-through.
    await setNetworkDown(page.context(), false);
  });

  test('should register the worker at scope / and control the page', async ({
    page,
  }) => {
    test.setTimeout(120000);
    test.skip(
      useDevServer,
      'the worker is not registered under the dev server (E2E_DEV_SERVER=1)',
    );

    await gotoStable(page, '/login');
    await waitForLoginFormInteractive(page);
    await waitForWorkerControl(page);

    const worker = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      return {
        origin: location.origin,
        scope: registration?.scope ?? null,
        scriptURL: registration?.active?.scriptURL ?? null,
        controlled: !!navigator.serviceWorker.controller,
      };
    });

    expect(worker.scope).toBe(`${worker.origin}/`);
    expect(worker.scriptURL).toBe(`${worker.origin}/sw.js`);
    expect(worker.controlled).toBe(true);
  });

  test('should register no worker under the dev server', async ({ page }) => {
    test.setTimeout(120000);
    test.skip(
      !useDevServer,
      'the no-registration check applies only under E2E_DEV_SERVER=1',
    );

    await gotoStable(page, '/login');
    await waitForLoginFormInteractive(page);

    const state = await page.evaluate(async () => ({
      registrations: (await navigator.serviceWorker.getRegistrations()).length,
      controlled: !!navigator.serviceWorker.controller,
    }));

    expect(state.registrations).toBe(0);
    expect(state.controlled).toBe(false);
  });

  test('should serve /sw.js uncached as a same-origin script with its CSP', async ({
    page,
  }) => {
    const res = await page.request.get('/sw.js');

    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toBe(
      'application/javascript; charset=utf-8',
    );
    const cacheControl = res.headers()['cache-control'] ?? '';
    expect(cacheControl).toContain('no-cache');
    expect(cacheControl).toContain('no-store');
    expect(cacheControl).toContain('must-revalidate');
    expect(res.headers()['content-security-policy']).toBe(
      "default-src 'self'; script-src 'self'",
    );
  });

  test('should show the offline page at the requested URL when a navigation fails offline', async ({
    page,
    browserName,
  }) => {
    test.setTimeout(120000);
    test.skip(
      useDevServer,
      'the worker is not registered under the dev server (E2E_DEV_SERVER=1)',
    );
    test.skip(browserName !== 'chromium', OUTAGE_CHROMIUM_ONLY_REASON);

    await gotoStable(page, '/login');
    await waitForLoginFormInteractive(page);
    await waitForWorkerControl(page);

    await setNetworkDown(page.context(), true);
    await waitForOffline(page);

    // Plain goto: gotoStable is for online navigations only.
    const response = await page.goto('/login');

    await expect(
      page.getByRole('heading', { name: "You're offline" }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
    await expect(page.getByTestId('offline-page')).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/login');
    await expect(
      page.getByRole('button', { name: 'Login', exact: true }),
    ).toHaveCount(0);
    expect(response?.fromServiceWorker()).toBe(true);

    // Hydration proof: a Retry click dropped before hydration does not reload,
    // so the click is repeated until one reloads the document. The network is
    // still down, so the reloaded document shows the offline page again.
    await expect(async () => {
      await Promise.all([
        page.waitForEvent('load', { timeout: 5000 }),
        page.getByRole('button', { name: 'Retry' }).click(),
      ]);
    }).toPass({ timeout: 60000 });

    await expect(
      page.getByRole('heading', { name: "You're offline" }),
    ).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/login');
  });

  test('should reload the page and show the real login form when the browser reconnects', async ({
    page,
    browserName,
  }) => {
    test.setTimeout(120000);
    test.skip(
      useDevServer,
      'the worker is not registered under the dev server (E2E_DEV_SERVER=1)',
    );
    test.skip(browserName !== 'chromium', OUTAGE_CHROMIUM_ONLY_REASON);

    await gotoStable(page, '/login');
    await waitForLoginFormInteractive(page);
    await waitForWorkerControl(page);

    await setNetworkDown(page.context(), true);
    await waitForOffline(page);
    await page.goto('/login');
    await expect(
      page.getByRole('heading', { name: "You're offline" }),
    ).toBeVisible();

    await recoverWhenOfflinePageHydrated(page);

    await expect(page.getByTestId('offline-page')).toHaveCount(0);
    await waitForLoginFormInteractive(page);
    await expect(
      page.getByRole('button', { name: 'Login', exact: true }),
    ).toBeVisible();
  });

  test('should recover through Retry when the browser is back online', async ({
    page,
    browserName,
  }) => {
    test.setTimeout(120000);
    test.skip(
      useDevServer,
      'the worker is not registered under the dev server (E2E_DEV_SERVER=1)',
    );
    test.skip(browserName !== 'chromium', OUTAGE_CHROMIUM_ONLY_REASON);

    // Stop the offline page's own `online` listener from running, so the
    // automatic reload cannot pre-empt the Retry click. This is kept over the
    // alternative of restoring only the route: setOffline(false) is what fires
    // `online`, and the route-only restore is unverified. Registered before the
    // first navigation, so every document the test loads carries it.
    await page.addInitScript(() => {
      window.addEventListener(
        'online',
        (event) => event.stopImmediatePropagation(),
        true,
      );
    });

    await gotoStable(page, '/login');
    await waitForLoginFormInteractive(page);
    await waitForWorkerControl(page);

    await setNetworkDown(page.context(), true);
    await waitForOffline(page);
    await page.goto('/login');
    await expect(
      page.getByRole('heading', { name: "You're offline" }),
    ).toBeVisible();

    await setNetworkDown(page.context(), false);

    // A Retry click before hydration is dropped, so it is retried. The click
    // is only issued while the offline page is still mounted: once the reload
    // commits, the page is no longer offline and the check passes.
    await expect(async () => {
      if ((await page.getByTestId('offline-page').count()) > 0) {
        await page
          .getByRole('button', { name: 'Retry' })
          .click({ timeout: 2000 });
      }
      await expect(page.getByTestId('offline-page')).toHaveCount(0, {
        timeout: 2000,
      });
    }).toPass({ timeout: 60000 });

    await waitForLoginFormInteractive(page);
    await expect(
      page.getByRole('button', { name: 'Login', exact: true }),
    ).toBeVisible();
  });

  test('should store only the offline page and its static files', async ({
    page,
  }) => {
    test.setTimeout(120000);
    test.skip(
      useDevServer,
      'the worker is not registered under the dev server (E2E_DEV_SERVER=1)',
    );

    await gotoStable(page, '/login');
    await waitForLoginFormInteractive(page);
    await waitForWorkerControl(page);

    const before = await readOfflineStore(page);

    // Visiting online adds nothing to the store: the worker only reads from it
    // when the network has failed.
    await gotoStable(page, '/');
    await waitForWorkerControl(page);
    await gotoStable(page, '/login');
    await waitForLoginFormInteractive(page);
    await waitForWorkerControl(page);

    const after = await readOfflineStore(page);

    for (const store of [before, after]) {
      expect(store.names).toEqual([OFFLINE_CACHE_NAME]);
      expect(store.pathnames).toContain('/offline');
      expect(
        store.pathnames.filter(
          (pathname) =>
            pathname !== '/offline' && !pathname.startsWith('/_next/static/'),
        ),
      ).toEqual([]);
      expect(
        store.pathnames.some((pathname) =>
          pathname.startsWith('/_next/static/'),
        ),
      ).toBe(true);
    }
    expect([...after.pathnames].sort()).toEqual([...before.pathnames].sort());
  });

  test('should leave API requests to the network and never answer them from the worker', async ({
    page,
    browserName,
  }) => {
    test.setTimeout(120000);
    test.skip(
      useDevServer,
      'the worker is not registered under the dev server (E2E_DEV_SERVER=1)',
    );
    test.skip(browserName === 'webkit', PASSTHROUGH_WEBKIT_REASON);

    await gotoStable(page, '/login');
    await waitForLoginFormInteractive(page);
    await waitForWorkerControl(page);

    // The API origin the app itself resolves at runtime. Falls back to the
    // local default when the runtime config carries no value.
    const apiOrigin = await page.evaluate(() => {
      const runtime = (
        window as unknown as {
          __MYORGANIZER_RUNTIME__?: { API_BASE_URL?: string };
        }
      ).__MYORGANIZER_RUNTIME__;
      return new URL(runtime?.API_BASE_URL || 'http://localhost:3000').origin;
    });
    const pageOrigin = new URL(page.url()).origin;
    const probeUrl = `${apiOrigin}/sw-passthrough-probe`;

    let stubHits = 0;
    await routeApi(page, probeUrl, async (route) => {
      const headers = {
        'access-control-allow-origin': pageOrigin,
        'access-control-allow-methods': 'GET,OPTIONS',
        'access-control-allow-headers': 'content-type',
      };
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers });
        return;
      }
      stubHits += 1;
      await route.fulfill({
        status: 200,
        headers,
        contentType: 'application/json',
        body: JSON.stringify({ source: 'stub' }),
      });
    });

    const probeResponses: Response[] = [];
    page.on('response', (response) => {
      if (response.url() === probeUrl) {
        probeResponses.push(response);
      }
    });

    const payload = await page.evaluate(async (url) => {
      const res = await fetch(url);
      return (await res.json()) as { source: string };
    }, probeUrl);

    expect(payload).toEqual({ source: 'stub' });
    expect(stubHits).toBeGreaterThanOrEqual(1);
    await expect.poll(() => probeResponses.length).toBeGreaterThanOrEqual(1);

    if (browserName === 'chromium') {
      expect(probeResponses[0]?.fromServiceWorker()).toBe(false);

      // Non-vacuous: the same worker does answer this page's own navigation,
      // so the false above is not a default for every response.
      const navigation = await page.reload();
      expect(navigation?.fromServiceWorker()).toBe(true);
    }
  });
});
