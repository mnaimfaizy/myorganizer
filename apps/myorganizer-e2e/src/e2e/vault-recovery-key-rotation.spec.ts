import { expect, test } from '@playwright/test';
import {
  gotoStable,
  login,
  setupBackend,
  unlockWithPassphrase,
  waitForOwnedVault,
  writeAddressToVault,
  type IdentityEntry,
} from './helpers';

/**
 * Recovery Key Rotation end-to-end (Issue #603)
 *
 * Proves the complete rotation flow: mint → paste-back gate → commit → Local Vault write
 * → survives page reload → old key rejected as wrong-secret (not corruption) → new key
 * accepted → vault contents still readable.
 *
 * Component and hook-level tests are in Jest; this spec is the single tracer proving
 * the whole browser path works.
 */

const EMAIL = 'rotation-owner@example.com';
const PASSWORD = 'rotowner-e2e-pw';
const USER_ID = 'rotation-owner-1';
const VAULT_PASSPHRASE = 'rotate-owner-pw';
const ADDRESS = '55 Baker Street';

const IDENTITIES: IdentityEntry[] = [
  { match: 'rotation-owner', userId: USER_ID, userName: 'Rotation Owner' },
];

function expectNonEmptyKey(key: string) {
  expect(key).toBeTruthy();
  expect(key.length).toBeGreaterThan(0);
}

test.describe('Recovery Key Rotation (E2E)', () => {
  test('Mint → paste-back → commit → reload → old key fails (wrong-secret) → new key unlocks vault', async ({
    page,
  }) => {
    test.setTimeout(180000);

    setupBackend(page, IDENTITIES);

    // 1. Sign in and navigate to addresses (VaultGate route to unlock session)
    await login(page, EMAIL, PASSWORD);
    await gotoStable(page, '/dashboard/addresses');

    let originalRecoveryKey = '';
    let newRecoveryKey = '';

    // 2. Create vault manually to capture the original recovery key
    {
      const setupPassphrase = page.locator('#setup-passphrase');
      await expect(setupPassphrase).toBeVisible({ timeout: 60000 });
      await setupPassphrase.fill(VAULT_PASSPHRASE);

      const setupConfirm = page.locator('#setup-confirm');
      await expect(setupConfirm).toBeVisible();
      await setupConfirm.fill(VAULT_PASSPHRASE);

      const createButton = page.getByRole('button', {
        name: 'Create encrypted vault',
      });
      await expect(createButton).toBeEnabled();
      await createButton.click();

      const savedButton = page.getByRole('button', { name: 'I saved it' });
      await expect(savedButton).toBeVisible({ timeout: 60000 });

      // Capture the original recovery key BEFORE clicking "I saved it".
      // This readonly input has no id/data-testid in vaultGate.tsx, and it is
      // the only readonly input on screen at this step in the setup flow.
      const readonlyInput = page.locator('input[readonly]');
      originalRecoveryKey = await readonlyInput.inputValue();
      expectNonEmptyKey(originalRecoveryKey);

      await savedButton.click();

      // Wait for vault to be stored and unlock session
      await waitForOwnedVault(page, USER_ID);
      await unlockWithPassphrase(page, VAULT_PASSPHRASE);
    }

    // 3. Seed vault with address content (to prove it's still readable after rotation)
    await writeAddressToVault(page, ADDRESS, VAULT_PASSPHRASE);

    // 4. Navigate to /dashboard/vault and rotate the recovery key
    await gotoStable(page, '/dashboard/vault');

    // Fill current passphrase
    await page
      .getByLabel('Passphrase to authorize this rotation')
      .fill(VAULT_PASSPHRASE);

    // Click "Generate recovery key"
    const mintButton = page.getByTestId('recovery-key-rotation-mint');
    await expect(mintButton).toBeEnabled();
    await mintButton.click();

    // Wait for and capture the minted key
    const mintedKeyInput = page.getByTestId('recovery-key-rotation-key');
    await expect(mintedKeyInput).toBeVisible({ timeout: 60000 });
    newRecoveryKey = await mintedKeyInput.inputValue();

    expectNonEmptyKey(newRecoveryKey);
    expect(newRecoveryKey).not.toBe(originalRecoveryKey);

    // Paste back the new key to confirm
    const confirmInput = page.getByTestId('recovery-key-rotation-confirm');
    await confirmInput.fill(newRecoveryKey);

    // Submit the rotation
    const submitButton = page.getByTestId('recovery-key-rotation-submit');
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    // Wait for the card to reset (mintedKey becomes null, so the display disappears)
    await expect(page.getByTestId('recovery-key-rotation-key')).toHaveCount(0, {
      timeout: 60000,
    });

    // 5. Reload and lock the session
    await page.reload();
    await gotoStable(page, '/dashboard/addresses');

    // Locked gate should be visible
    const unlockPassphrase = page.locator('#unlock-passphrase');
    await expect(unlockPassphrase).toBeVisible({ timeout: 60000 });

    // 6. Prove the retired key fails as "wrong secret" (not corruption)
    const forgotPassphraseButton = page.getByRole('button', {
      name: 'Forgot passphrase',
    });
    await forgotPassphraseButton.click();

    const recoveryKeyInput = page.locator('#recovery-key');
    await expect(recoveryKeyInput).toBeVisible({ timeout: 60000 });
    await recoveryKeyInput.fill(originalRecoveryKey);

    const unlockWithRecoveryButton = page.getByRole('button', {
      name: 'Unlock with recovery key',
    });
    await unlockWithRecoveryButton.click();

    // Assert the "wrong secret" toast (not the "corruption" toast)
    await expect(
      page.getByText("That recovery key didn't unlock this vault"),
    ).toBeVisible({ timeout: 30000 });

    // Assert the generic/corruption toast is NOT shown
    await expect(
      page.getByText('Recovery failed', { exact: true }),
    ).toHaveCount(0);

    // Vault should still be locked (address not visible)
    await expect(page.getByText(ADDRESS).first()).not.toBeVisible();

    // 7. Prove the new key unlocks and contents are intact
    // Clear the old key and fill with the new one
    await recoveryKeyInput.clear();
    await recoveryKeyInput.fill(newRecoveryKey);

    // Click unlock again
    await unlockWithRecoveryButton.click();

    // Assert success toast
    await expect(page.getByText('Recovered')).toBeVisible({ timeout: 30000 });

    // Assert address is visible (vault contents are still readable)
    await expect(page.getByText(ADDRESS).first()).toBeVisible({
      timeout: 60000,
    });
  });
});
