import { Page, expect } from '@playwright/test';

import { E2E_USER_ID, waitForOwnedVault } from './vaultStorage';

/**
 * Budget for anything gated on a PBKDF2 derivation — vault creation, unlock,
 * and the renders either one blocks. Slow by design, and slower again on
 * WebKit under CI load. Generous on purpose: a timeout is not a sleep, and
 * the assertions below still resolve as soon as the state lands.
 */
const PBKDF2_BUDGET_MS = 60000;

/**
 * The phrase specs use to create and unlock a Local Vault.
 *
 * It guards nothing: every spec that uses it runs against a fully stubbed
 * backend and creates the vault it then opens. Named and worded so a scanner
 * does not read a test input as a leaked credential — a literal assigned to a
 * credential-shaped identifier is the exact pattern those tools match, and it
 * is what tripped GitGuardian on this branch.
 */
export const E2E_VAULT_PHRASE = 'e2e-fixture-phrase-01';

/**
 * Create a Local Vault from `VaultGate`'s setup card, leaving the gate on its
 * unlock panel.
 *
 * `handle.initialize()` writes the stored vault record and *then* resolves, so
 * React commits the recovery-key step strictly after the record exists. That
 * ordering is why `waitForOwnedVault` is not a signal about the screen: it can
 * resolve while the setup card is still the only thing rendered. Specs that
 * treated it as one went on to probe for the recovery-key step with
 * `isVisible({ timeout })` — which samples once and never waits — and skipped
 * it whenever WebKit had not committed the render yet, stranding the run on a
 * card that never advances (issue #597).
 *
 * The "I saved it" button appearing is the render signal, so wait for that.
 * `VaultGate` deliberately does not auto-unlock afterwards: the button advances
 * the gate to `owned`, which renders the unlock panel.
 */
export async function createOwnedVault(
  page: Page,
  { passphrase, owner = E2E_USER_ID }: { passphrase: string; owner?: string },
): Promise<void> {
  const setupPassphrase = page.locator('#setup-passphrase');
  await expect(setupPassphrase).toBeVisible({ timeout: PBKDF2_BUDGET_MS });

  await setupPassphrase.fill(passphrase);
  await page.locator('#setup-confirm').fill(passphrase);

  const createButton = page.getByRole('button', {
    name: 'Create encrypted vault',
  });
  await expect(createButton).toBeEnabled();
  await createButton.click();

  const savedRecoveryKey = page.getByRole('button', { name: 'I saved it' });
  await expect(savedRecoveryKey).toBeVisible({ timeout: PBKDF2_BUDGET_MS });
  await savedRecoveryKey.click();

  // Cheap once the button has been seen, and it pins the owner-bound storage
  // key this suite depends on (ADR 0047).
  await waitForOwnedVault(page, owner);
}

/**
 * Unlock `VaultGate` on the current page with `passphrase`.
 *
 * Requires the unlock panel to be reachable. It has no "already unlocked"
 * branch on purpose: the version this replaces returned early when
 * `#unlock-passphrase` had count 0, which reads "React has not rendered the
 * panel yet" as "the vault is open" and hands the rest of the spec a gate that
 * never opens. The failure surfaces far from its cause — as a 2-minute test
 * timeout clicking a button the locked route was never going to render
 * (issue #597).
 *
 * `masterKeyBytes` lives only in React state, so every full page load re-locks
 * the vault and every landing on a gated route has to unlock again.
 */
export async function unlockWithPassphrase(
  page: Page,
  passphrase: string,
): Promise<void> {
  // Both modes of the unlock panel render this toggle, so it appearing is the
  // panel's readiness signal, and clicking it is idempotent — it forces
  // passphrase mode whichever mode the gate settled into.
  const usePassphrase = page.getByRole('button', { name: 'Use passphrase' });
  await expect(usePassphrase).toBeVisible({ timeout: PBKDF2_BUDGET_MS });
  await usePassphrase.click();

  const input = page.locator('#unlock-passphrase');
  await expect(input).toBeVisible({ timeout: PBKDF2_BUDGET_MS });
  await input.fill(passphrase);

  // Click the button; Firefox does not reliably submit on Enter.
  await page.getByRole('button', { name: /^Unlock$/ }).click();

  // The field disappearing is the unlock landing — not the click resolving.
  // PBKDF2 is slow by design, and slower again on WebKit.
  await expect(input).toHaveCount(0, { timeout: PBKDF2_BUDGET_MS });
}
