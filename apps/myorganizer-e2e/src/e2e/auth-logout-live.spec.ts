import { expect, test } from '@playwright/test';
import {
  LIVE_AUTH_EMAIL,
  LIVE_AUTH_PASSWORD,
  signOut,
  submitLoginForm,
} from './helpers';

test('logs out against the real backend', async ({ page }) => {
  test.skip(
    process.env.E2E_LIVE_BACKEND !== '1',
    'requires E2E_LIVE_BACKEND=1',
  );

  test.setTimeout(60000);

  await page.goto('/login');

  await submitLoginForm(page, {
    email: LIVE_AUTH_EMAIL,
    password: LIVE_AUTH_PASSWORD,
  });

  const cookiesBeforeLogout = await page.context().cookies();
  const refreshBefore = cookiesBeforeLogout.find(
    (cookie) => cookie.name === 'refresh_cookie',
  );
  expect(refreshBefore?.value ?? '').not.toBe('');

  const logoutResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      /\/auth\/logout\//.test(response.url()),
  );

  await signOut(page);

  const logoutResponse = await logoutResponsePromise;
  expect(logoutResponse.status()).toBe(200);
  expect(await logoutResponse.json()).toEqual({
    message: 'Logged out successfully',
  });

  const cookiesAfterLogout = await page.context().cookies();
  expect(
    cookiesAfterLogout.some((cookie) => cookie.name === 'refresh_cookie'),
  ).toBe(false);

  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
});
