import { expect, test } from '@playwright/test';
import {
  createAndUnlockVault,
  gotoStable,
  login,
  readOwnedVault,
  removeOwnedVault,
  setupBackend,
  signOut,
  UNCLAIMED_VAULT_KEY,
  waitForOwnedVault,
  unlockWithPassphrase,
  writeAddressToVault,
  type IdentityEntry,
} from './helpers';

/**
 * Vault Claim Evidence (ADR 0061): Unclaimed Local Vault access gates
 *
 * An Unclaimed Local Vault (pre-#584 unsuffixed `myorganizer_vault_v1` slot) is
 * never offered to a signed-in User without proof it is theirs. Two flows:
 * (1) User with no evidence reaches create-vault, never unlock/claim
 * (2) Rightful owner (server Vault Meta match) reaches their own Vault silently and locked
 */

// Test credentials (10–15 char passphrases for hook compliance, MIN_PASSPHRASE_LENGTH = 10)
const OWNER_EMAIL = 'owner@example.com';
const OWNER_PASSWORD = 'owner-e2e-pw';
const OWNER_VAULT_PASSPHRASE = 'owner-pass-12'; // 12 chars, meets MIN_PASSPHRASE_LENGTH
const OWNER_ADDRESS = '789 Oak St';

const STRANGER_EMAIL = 'stranger@example.com';
const STRANGER_PASSWORD = 'stranger-e2epw';

const OWNER_ID = 'owner-1';
const STRANGER_ID = 'stranger-2';

/**
 * Identity entries for this spec's users. Passed to setupBackend to map
 * emails to userId/userName pairs. Used in both Flow 1 and Flow 2.
 */
const IDENTITIES: IdentityEntry[] = [
  { match: 'owner', userId: OWNER_ID, userName: 'Owner' },
  { match: 'stranger', userId: STRANGER_ID, userName: 'Stranger' },
];

test.describe('Vault Claim Evidence (E2E)', () => {
  test('FLOW 1: No evidence -> create-vault, never unlock/claim', async ({
    browser,
  }) => {
    test.setTimeout(180000);

    let capturedVaultString: string | null = null;

    // Step 1: Throwaway context — create vault as Owner, capture vault, close
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      setupBackend(page, IDENTITIES);

      await login(page, OWNER_EMAIL, OWNER_PASSWORD);
      await gotoStable(page, '/dashboard/addresses');
      await createAndUnlockVault(page, OWNER_ID, OWNER_VAULT_PASSPHRASE);
      await writeAddressToVault(page, OWNER_ADDRESS, OWNER_VAULT_PASSPHRASE);

      // Capture the owned vault record for seeding into unclaimed slot
      await waitForOwnedVault(page, OWNER_ID);
      const ownedRecord = await readOwnedVault(page, OWNER_ID);
      expect(ownedRecord).toBeTruthy();

      // Extract vault object from owned record
      capturedVaultString = await page.evaluate(
        ({ ownedData }) => {
          const parsed = JSON.parse(ownedData);
          // The stored structure is { version: 2, owner, vault }
          return JSON.stringify(parsed.vault);
        },
        { ownedData: ownedRecord },
      );

      // Assert that the captured vault is a real Local Vault before seeding it.
      // If vault extraction failed or the structure changed, this must fail loudly.
      expect(capturedVaultString).toBeTruthy();
      expect(capturedVaultString.length).toBeGreaterThan(0);

      // Validate that the vault has the required structure of a Local Vault:
      // kdf params (at minimum kdf.salt) and both wrapped-key blobs.
      // This ensures we seeded a real vault belonging to someone else, not a degraded fixture.
      const capturedVault = JSON.parse(capturedVaultString);
      expect(capturedVault).toHaveProperty('kdf.salt');
      expect(capturedVault).toHaveProperty('masterKeyWrappedWithPassphrase');
      expect(capturedVault).toHaveProperty('masterKeyWrappedWithRecoveryKey');

      await ctx.close();
    }

    // Step 2: Fresh context for Stranger (Bob, with no server meta)
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    setupBackend(page, IDENTITIES);

    // Assert that capturedVaultString is a valid vault before seeding it.
    // If the fixture setup in Step 1 failed to capture, this must fail loudly.
    expect(capturedVaultString).toBeTruthy();
    expect(capturedVaultString.length).toBeGreaterThan(0);

    // Seed the unclaimed vault in localStorage BEFORE signing in
    await gotoStable(page, '/login');
    await page.evaluate(
      ({ unclaimedKey, vaultData }) => {
        window.localStorage.setItem(unclaimedKey, vaultData);
      },
      {
        unclaimedKey: UNCLAIMED_VAULT_KEY,
        vaultData: capturedVaultString,
      },
    );

    // Sign in as Stranger
    await login(page, STRANGER_EMAIL, STRANGER_PASSWORD);
    await gotoStable(page, '/dashboard/addresses');

    // POSITIVE: Setup passphrase input is visible (gate status is 'absent')
    const setupPassphrase = page.locator('#setup-passphrase');
    await expect(setupPassphrase).toBeVisible({ timeout: 60000 });

    // POSITIVE (pins same state): "Create encrypted vault" button is visible
    const createVaultButton = page.getByRole('button', {
      name: 'Create encrypted vault',
    });
    await expect(createVaultButton).toBeVisible();

    // NEGATIVE (paired with setup-passphrase positive): No unlock passphrase input
    const unlockPassphrase = page.locator('#unlock-passphrase');
    await expect(unlockPassphrase).toHaveCount(0);

    // NEGATIVE-GUARD: Recovery key claim offer IS visible (it's unconditional)
    const claimRecoveryKeyButton = page.getByRole('button', {
      name: 'I have a recovery key for a vault on this device',
    });
    await expect(claimRecoveryKeyButton).toBeVisible();

    // SIDE EFFECTS: Stranger has no owned vault
    const strangerVault = await readOwnedVault(page, STRANGER_ID);
    expect(strangerVault).toBeNull();

    // Unclaimed slot is byte-identical to what was seeded
    const unclaimedAfter = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      UNCLAIMED_VAULT_KEY,
    );
    expect(unclaimedAfter).toBe(capturedVaultString);

    await ctx.close();
  });

  test('FLOW 2: Rightful owner is not locked out (server-meta match, silent claim)', async ({
    browser,
  }) => {
    test.setTimeout(180000);

    // Step 1: Sign in as Owner, create + unlock vault, write address
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const serverState = setupBackend(page, IDENTITIES);

    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    await gotoStable(page, '/dashboard/addresses');
    await createAndUnlockVault(page, OWNER_ID, OWNER_VAULT_PASSPHRASE);
    await writeAddressToVault(page, OWNER_ADDRESS, OWNER_VAULT_PASSPHRASE);

    // Step 2: Seed server Vault Meta directly
    // Newly created Vaults never push meta through VaultMetaConvergeRunner (they have no
    // bookmark with the server). Derive the meta from the local vault and seed it so the
    // evidence gate can match it on sign-back-in and trigger silent claim.
    const ownedRecord = await readOwnedVault(page, OWNER_ID);
    expect(ownedRecord).toBeTruthy();

    // Derive server Vault Meta from the stored vault record
    // ownedRecord is JSON stringified { version: 2, owner, vault }
    // We need to extract vault (which is VaultStorageV1) and convert it to server meta.
    // The shape is defined in libs/web-vault/src/lib/vault/vaultShapes.ts (VaultMetaV1)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const storedOwned = JSON.parse(ownedRecord || '{}') as unknown as {
      vault: any;
    };
    const vault = storedOwned.vault;

    // Inline version of localToServerMeta from vaultShapes.ts
    // This converts VaultStorageV1 to VaultMetaV1 (server-side representation)
    const derivedMeta = {
      version: 1,
      kdf_name: vault.kdf.name,
      kdf_salt: vault.kdf.salt,
      kdf_params: {
        hash: vault.kdf.hash,
        iterations: vault.kdf.iterations,
      },
      wrapped_mk_passphrase: {
        version: 1,
        iv: vault.masterKeyWrappedWithPassphrase.iv,
        ciphertext: vault.masterKeyWrappedWithPassphrase.ciphertext,
      },
      wrapped_mk_recovery: {
        version: 1,
        iv: vault.masterKeyWrappedWithRecoveryKey.iv,
        ciphertext: vault.masterKeyWrappedWithRecoveryKey.ciphertext,
      },
    };

    // Seed the server state with this meta, mimicking what PUT /vault would do
    serverState.meta[OWNER_ID] = derivedMeta;
    serverState.metaEtag[OWNER_ID] = `W/"${Date.now()}"`;
    serverState.metaUpdatedAt[OWNER_ID] = new Date().toISOString();

    // Step 3: Remove from owned slot and seed unclaimed
    const unclaimedBefore = await page.evaluate(
      ({ unclaimedKey, ownedData }) => {
        const parsed = JSON.parse(ownedData);
        const vaultObject = parsed.vault;
        // Write to unclaimed slot
        const vaultString = JSON.stringify(vaultObject);
        window.localStorage.setItem(unclaimedKey, vaultString);
        return vaultString;
      },
      {
        unclaimedKey: UNCLAIMED_VAULT_KEY,
        ownedData: ownedRecord || '{}',
      },
    );

    // Remove owned vault record
    await removeOwnedVault(page, OWNER_ID);

    // Step 4: Sign out, sign back in as same Owner
    await signOut(page);
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    await gotoStable(page, '/dashboard/addresses');

    // POSITIVE: Unlock passphrase input is visible (silent claim succeeded)
    const unlockPassphrase = page.locator('#unlock-passphrase');
    await expect(unlockPassphrase).toBeVisible({ timeout: 60000 });

    // NEGATIVE (paired with unlock-passphrase positive): No setup passphrase input
    const setupPassphrase = page.locator('#setup-passphrase');
    await expect(setupPassphrase).toHaveCount(0);

    // Step 5: Unlock with owner's passphrase
    await unlockWithPassphrase(page, OWNER_VAULT_PASSPHRASE);

    // Assert address reappears (proves real unlock, not just status flip)
    await expect(page.getByText(OWNER_ADDRESS).first()).toBeVisible({
      timeout: 60000,
    });

    // Step 6: Owned vault is now present again (claimed from unclaimed)
    await waitForOwnedVault(page, OWNER_ID);
    const ownedAfter = await readOwnedVault(page, OWNER_ID);
    expect(ownedAfter).toBeTruthy();

    // Step 7: Unclaimed slot is unchanged (claim copies, does not move)
    const unclaimedAfter = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      UNCLAIMED_VAULT_KEY,
    );
    expect(unclaimedAfter).toBe(unclaimedBefore);

    await ctx.close();
  });
});
