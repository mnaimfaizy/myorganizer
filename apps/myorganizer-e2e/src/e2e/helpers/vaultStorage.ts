import { Page } from '@playwright/test';

/**
 * The unsuffixed slot. Holds an Unclaimed Local Vault — one written before
 * Local Vaults were owner-bound, or by a signed-out browser. Mirrors
 * `VAULT_STORAGE_KEY` in `libs/web-vault/src/lib/vault/localVaultStorage.ts`.
 */
export const UNCLAIMED_VAULT_KEY = 'myorganizer_vault_v1';

/**
 * The user id every spec's mocked `/auth/login` response returns, and therefore
 * the owner every Local Vault these specs create belongs to. Specs that sign in
 * as more than one User pass their own ids instead.
 */
export const E2E_USER_ID = '1';

/**
 * The key one User's Local Vault lives under, per [ADR 0047]. Mirrors
 * `localVaultStorageKey` in `libs/web-vault/src/lib/vault/localVaultStorage.ts`
 * — keep the two in step.
 *
 * [ADR 0047]: docs/adr/0047-vault-access-is-obtained-through-an-owner-bound-handle.md
 */
export function ownedVaultKey(owner: string): string {
  return `${UNCLAIMED_VAULT_KEY}:${owner}`;
}

/**
 * Wait until `owner`'s Local Vault has been written to localStorage.
 *
 * Vault creation runs PBKDF2 in the browser, so it is slow and its completion
 * is not observable from the click that started it. Treat the stored record as
 * the completion signal, the way every vault spec did before the key became
 * owner-bound.
 */
export async function waitForOwnedVault(
  page: Page,
  owner: string,
  timeout = 60000,
): Promise<void> {
  await page.waitForFunction(
    (key) => Boolean(window.localStorage.getItem(key)),
    ownedVaultKey(owner),
    { timeout },
  );
}

/** Read `owner`'s raw stored Local Vault record, or null when absent. */
export function readOwnedVault(
  page: Page,
  owner: string,
): Promise<string | null> {
  return page.evaluate(
    (key) => window.localStorage.getItem(key),
    ownedVaultKey(owner),
  );
}

/** Remove `owner`'s Local Vault, simulating a device that never held one. */
export async function removeOwnedVault(
  page: Page,
  owner: string,
): Promise<void> {
  await page.evaluate(
    (key) => window.localStorage.removeItem(key),
    ownedVaultKey(owner),
  );
}
