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
  const refreshToken =
    cookiesBeforeLogout.find((cookie) => cookie.name === 'refresh_cookie')
      ?.value ?? '';
  expect(refreshToken).not.toBe('');

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

  const revoked = await page.request.post(
    'http://localhost:3000/api/v1/auth/refresh',
    {
      headers: { Cookie: `refresh_cookie=${refreshToken}` },
      data: {},
    },
  );
  expect(revoked.status()).toBe(401);

  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
});
