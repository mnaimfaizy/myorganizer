import { Page, expect } from '@playwright/test';

/**
 * The credentials every stubbed `/auth/login` route in this suite accepts.
 * Not re-exported from `./helpers`: specs get them as `submitLoginForm`'s
 * default rather than restating them.
 */
const E2E_EMAIL = 'testuser@example.com';
const E2E_PASSWORD = 'password123';

/**
 * Resolve once the login form's React handlers are attached.
 *
 * The form is fully controlled — `value={email}` plus `onChange` — so a value
 * typed before hydration lands in the DOM but never reaches React state, and
 * submitting posts empty credentials. The suite used to cover that with
 * `waitForLoadState('networkidle')` plus a 1.5s WebKit sleep. Neither observes
 * hydration: `networkidle` is DISCOURAGED by Playwright and hangs against a
 * production build, and a sleep is a guess (ADR 0050, issue #524).
 *
 * Password visibility is pure client state, so the field only unmasks once
 * `onClick` is bound. The click is retried because a pre-hydration click is
 * dropped, then reversed so the caller starts from the masked field a user
 * sees — and so `input[type="password"]` still selects it.
 */
export async function waitForLoginFormInteractive(page: Page): Promise<void> {
  const toggle = page.getByRole('button', { name: /^(Show|Hide) password$/ });
  const password = page.locator('#password');

  await expect(toggle).toBeVisible({ timeout: 30000 });

  await expect(async () => {
    await toggle.click();
    await expect(password).toHaveAttribute('type', 'text', { timeout: 1000 });
  }).toPass({ timeout: 30000 });

  await expect(async () => {
    await toggle.click();
    await expect(password).toHaveAttribute('type', 'password', {
      timeout: 1000,
    });
  }).toPass({ timeout: 10000 });
}

/**
 * Fill and submit the login form, leaving the browser on the dashboard.
 *
 * Assumes the caller has already navigated to `/login` and stubbed the
 * `/auth/login` route.
 */
export async function submitLoginForm(
  page: Page,
  credentials: { email: string; password: string } = {
    email: E2E_EMAIL,
    password: E2E_PASSWORD,
  },
): Promise<void> {
  await waitForLoginFormInteractive(page);

  await page.fill('input[type="email"]', credentials.email);
  await page.fill('input[type="password"]', credentials.password);

  const submitButton = page.locator('button[type="submit"]');
  await expect(submitButton).toBeVisible();
  await expect(submitButton).toBeEnabled();
  await submitButton.click();

  await expect(page).toHaveURL(/.*dashboard/, { timeout: 60000 });
  await waitForDashboardReady(page);
}

/**
 * Resolve once the dashboard shell is live on the current page.
 *
 * `DashboardGuard` renders `null` until its client-side auth check resolves,
 * so any part of the dashboard shell being on screen proves the shell mounted
 * and the route's own content is rendering — which is what the callers were
 * reaching for when they waited for network quiet after landing on
 * `/dashboard`. The layout renders two sidebar toggles, hence `.first()`.
 */
export async function waitForDashboardReady(page: Page): Promise<void> {
  await expect(
    page.getByRole('button', { name: 'Toggle Sidebar' }).first(),
  ).toBeVisible({ timeout: 60000 });
}

/**
 * Wait for a full page reload triggered by a callback, then resolve once the
 * dashboard shell is live.
 *
 * A same-document `waitFor()` cannot distinguish a pre-reload document from
 * a post-reload one. This helper stamps a marker on the current `window`,
 * runs the callback (which triggers the reload), then waits for the marker
 * to vanish via `waitForFunction()`. `waitForFunction()` is resilient to
 * navigation and re-evaluates in the new execution context, so the absence
 * of the marker proves the reload committed. Then `waitForDashboardReady()`
 * ensures the new document's shell has mounted (issue #557).
 */
export async function waitForReload(
  page: Page,
  callback: () => Promise<void>,
): Promise<void> {
  const marker = `__e2e_reload_marker_${Date.now()}`;
  await page.evaluate((m) => {
    (window as unknown as Record<string, boolean>)[m] = true;
  }, marker);

  await callback();

  await page.waitForFunction(
    (m) => !(window as unknown as Record<string, boolean>)[m],
    marker,
    { timeout: 60000 },
  );

  await waitForDashboardReady(page);
}
