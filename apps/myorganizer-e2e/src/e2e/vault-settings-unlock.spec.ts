import { expect, test } from '@playwright/test';
import {
  createAndUnlockVault,
  gotoStable,
  login,
  setupBackend,
  waitForDashboardReady,
  type IdentityEntry,
} from './helpers';

/**
 * Vault Settings Unlock end-to-end (Issue #626)
 *
 * Proves the fix for the hard-load regression: navigating directly to
 * `/dashboard/vault` (full page reload, not sidebar link) leaves the vault
 * locked with a functioning unlock card. The regression was: the unlock card
 * never rendered after a hard navigation, stranding the user on a page with no
 * way to unlock.
 *
 * This spec deliberately hard-navigates (via gotoStable/page.goto), unlike
 * vault-recovery-key-rotation.spec.ts which soft-navigates via the sidebar link
 * to avoid this exact bug. That design difference is the regression being tested.
 */

const EMAIL = 'vault-unlock-owner@example.com';
const PASSWORD = 'vaultunlock-e2e';
const USER_ID = 'vault-unlock-owner-1';
const VAULT_PASSPHRASE = 'unlock-owner-pw';

const IDENTITIES: IdentityEntry[] = [
  {
    match: 'vault-unlock-owner',
    userId: USER_ID,
    userName: 'Vault Unlock Owner',
  },
];

test.describe('Vault Settings Unlock after Hard Navigation (E2E)', () => {
  test('Hard load of /dashboard/vault renders unlock card; wrong passphrase shows error; correct passphrase unlocks', async ({
    page,
  }) => {
    test.setTimeout(180000);

    setupBackend(page, IDENTITIES);

    // 1. Sign in
    await login(page, EMAIL, PASSWORD);
    await expect(page).toHaveURL(/.*dashboard/, { timeout: 60000 });

    // 2. Create and unlock vault via /dashboard/addresses route
    await gotoStable(page, '/dashboard/addresses');
    await createAndUnlockVault(page, USER_ID, VAULT_PASSPHRASE);

    // 3. Hard navigation to /dashboard/vault (the regression trigger)
    // This is page.goto(), not a sidebar link, so the vault is locked on arrival
    await gotoStable(page, '/dashboard/vault');
    await waitForDashboardReady(page);

    // 4. Assert locked state: VaultUnlockCard rendered, ChangePassphraseCard's input disabled
    await expect(
      page.getByText('Unlock your vault', { exact: true }),
    ).toBeVisible({ timeout: 60000 });

    const currentPassphraseInput = page.getByLabel('Current passphrase', {
      exact: true,
    });
    await expect(currentPassphraseInput).toBeDisabled();

    // 5. Attempt unlock with WRONG passphrase
    const passphraseInput = page.getByLabel('Passphrase', { exact: true });
    await expect(passphraseInput).toBeVisible({ timeout: 60000 });

    await passphraseInput.fill('wrong-passphrase');
    const submitButton = page.getByTestId('vault-unlock-submit');
    await submitButton.click();

    // Assert error message appears
    await expect(
      page.getByText('That is not your current passphrase.', { exact: true }),
    ).toBeVisible({ timeout: 30000 });

    // Assert the input still contains the wrong value (NOT cleared on error)
    const wrongValue = await passphraseInput.inputValue();
    expect(wrongValue).toBe('wrong-passphrase');

    // Assert VaultUnlockCard is still rendered (not unmounted on error)
    await expect(
      page.getByText('Unlock your vault', { exact: true }),
    ).toBeVisible({ timeout: 60000 });

    // 6. Assert ChangePassphraseCard's input is STILL disabled after failed unlock attempt
    await expect(currentPassphraseInput).toBeDisabled();

    // 7. Clear the wrong passphrase and fill the CORRECT one
    await passphraseInput.clear();
    await passphraseInput.fill(VAULT_PASSPHRASE);
    await submitButton.click();

    // Assert success toast
    // `exact` is required: the toaster also renders an `aria-live` announcer
    // whose text embeds this string, so a substring match resolves to two
    // elements and trips strict mode.
    await expect(
      page.getByText('Vault unlocked for this session.', { exact: true }),
    ).toBeVisible({ timeout: 60000 });

    // 8. Assert unlocked state: VaultUnlockCard unmounted, ChangePassphraseCard's input enabled
    await expect(
      page.getByText('Unlock your vault', { exact: true }),
    ).toHaveCount(0, { timeout: 60000 });

    await expect(currentPassphraseInput).toBeEnabled({ timeout: 60000 });
  });
});
