import { expect, test } from '@playwright/test';
import {
  gotoStable,
  LIVE_DELETION_EMAIL,
  LIVE_DELETION_PASSWORD,
  submitLoginForm,
  waitForDashboardReady,
  waitForLoginFormInteractive,
  waitForVaultMountSettled,
} from './helpers';

/** Deliberately wrong; kept inside the 10-15 character fixture window. */
const WRONG_PASSWORD = 'not-the-pw';

test('deletes the account against the real backend and refuses a second sign-in', async ({
  page,
}) => {
  test.skip(
    process.env.E2E_LIVE_BACKEND !== '1',
    'requires E2E_LIVE_BACKEND=1',
  );

  test.setTimeout(60000);

  // 1. Sign in as the dedicated deletion user; the dashboard is the landing page.
  await page.goto('/login');
  await submitLoginForm(page, {
    email: LIVE_DELETION_EMAIL,
    password: LIVE_DELETION_PASSWORD,
  });

  // 2. Hard navigation to the account page; wait for the shell and the vault mount to settle.
  await gotoStable(page, '/dashboard/account');
  await waitForDashboardReady(page);
  await waitForVaultMountSettled(page);

  await expect(page.getByTestId('delete-account-button')).toBeVisible();
  await page.getByTestId('delete-account-button').click();

  // 3. The dialog opens on the Escape Copy step.
  const dialog = page.getByTestId('delete-account-dialog');
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole('heading', { name: 'Delete account' }),
  ).toBeVisible();

  // 4. The Escape Copy is offered; it is not taken in this flow.
  await expect(dialog.getByTestId('escape-copy-button')).toBeVisible();
  await expect(dialog.getByTestId('escape-copy-button')).toBeEnabled();
  const continueButton = dialog.getByTestId('delete-account-continue');
  await expect(continueButton).toHaveText('Continue without a copy');

  // 5. Continue to the confirm step.
  await continueButton.click();
  await expect(dialog.getByTestId('delete-account-password')).toBeVisible();

  // 6. A wrong password is refused with a 403 and the dialog stays open.
  await dialog.getByTestId('delete-account-password').fill(WRONG_PASSWORD);
  await dialog.getByTestId('delete-account-confirmation').fill('DELETE');

  const refusedResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'DELETE' &&
      /\/users\/me$/.test(response.url()),
  );
  await dialog.getByTestId('delete-account-submit').click();

  const refusedResponse = await refusedResponsePromise;
  expect(refusedResponse.status()).toBe(403);
  await expect(dialog.getByText('Incorrect password.')).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard\/account$/);

  // 7. The refusal leaves the user signed in: the dialog is still open and the refresh cookie remains.
  await expect(dialog).toBeVisible();
  const cookiesAfterRefusal = await page.context().cookies();
  expect(
    cookiesAfterRefusal.some((cookie) => cookie.name === 'refresh_cookie'),
  ).toBe(true);

  // 8. The correct password deletes the account and lands on the confirmation page.
  await dialog
    .getByTestId('delete-account-password')
    .fill(LIVE_DELETION_PASSWORD);

  const deletedResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'DELETE' &&
      /\/users\/me$/.test(response.url()),
  );
  await dialog.getByTestId('delete-account-submit').click();

  const deletedResponse = await deletedResponsePromise;
  expect(deletedResponse.ok()).toBe(true);

  await expect(page).toHaveURL(/\/account-deleted/, { timeout: 30000 });
  await expect(page.getByTestId('account-deleted')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Your account has been deleted' }),
  ).toBeVisible();

  // 9. The backend clears the refresh cookie on deletion.
  const cookiesAfterDeletion = await page.context().cookies();
  expect(
    cookiesAfterDeletion.some((cookie) => cookie.name === 'refresh_cookie'),
  ).toBe(false);

  // 10. The dashboard is no longer reachable without a session.
  await gotoStable(page, '/dashboard');
  await expect(page).toHaveURL(/\/login/);

  // 11. Signing in with the deleted account's credentials is refused.
  await waitForLoginFormInteractive(page);
  await page.fill('input[type="email"]', LIVE_DELETION_EMAIL);
  await page.fill('input[type="password"]', LIVE_DELETION_PASSWORD);

  const submitButton = page.locator('button[type="submit"]');
  await expect(submitButton).toBeEnabled();
  await submitButton.click();

  await expect(page.getByText('Login failed', { exact: true })).toBeVisible({
    timeout: 30000,
  });
  await expect(page).toHaveURL(/\/login/);
});
