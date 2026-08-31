/**
 * Tests for Vault Claim Evidence — what proves an Unclaimed Local Vault is
 * the signed-in User's, and the claim that follows when it does.
 *
 * Tests use REAL WebCrypto and real localStorage, along with a real VaultHandle
 * bound to a test owner, to establish that the evidence check truly preserves
 * storage byte-identity on failures and accurately reads Vault Meta divergence.
 * The server's getVaultMeta is mocked at the transport seam (axios response shape)
 * to control server responses and error conditions consistently.
 */

// === Global setup for jsdom ===
if (
  typeof (globalThis as unknown as { TextEncoder?: unknown }).TextEncoder ===
  'undefined'
) {
  const { TextEncoder, TextDecoder } = require('util');
  (globalThis as unknown as Record<string, unknown>).TextEncoder = TextEncoder;
  (globalThis as unknown as Record<string, unknown>).TextDecoder = TextDecoder;
}

// === Polyfill crypto.subtle for Node's jsdom environment ===
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (!(globalThis as any).crypto?.subtle) {
  const { webcrypto } = require('crypto');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(globalThis as any).crypto) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).crypto = {};
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).crypto.subtle = webcrypto.subtle;
}

import type { AxiosResponse } from 'axios';
import { VaultMetaV1 } from '@myorganizer/app-api-client';

import {
  checkVaultClaimEvidence,
  claimUnclaimedLocalVaultOnEvidence,
  VAULT_META_CHANGE_SAME_VAULT,
} from './vaultClaimEvidence';
import {
  VAULT_STORAGE_KEY,
  LOCAL_VAULT_RECORD_VERSION,
  localVaultStorageKey,
  type VaultStorageV1,
} from './localVaultStorage';
import { createVaultHandle } from './vaultHandle';
import { LocalVaultAlreadyOwnedError } from './localVaultAccess';
import { VAULT_META_CHANGES, type VaultMetaChange } from './vaultMetaConverge';

type ApiDouble = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getVaultMeta: jest.Mock<Promise<AxiosResponse<any>>, []>;
};

/**
 * Helper to create a properly typed API double matching axios response shape.
 */
function createApiDouble(): ApiDouble {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getVaultMeta: jest.fn<Promise<AxiosResponse<any>>, []>(),
  };
}

/**
 * Helper to get a localStorage value, throwing if the key is missing.
 */
function getRequiredLocalStorageItem(key: string): string {
  const value = localStorage.getItem(key);
  if (value === null) {
    throw new Error(`Required localStorage key "${key}" is missing`);
  }
  return value;
}

type UnclaimedVaultFixture = { vault: VaultStorageV1; raw: string };

/**
 * Put a real, WebCrypto-built Vault into the unsuffixed slot as an Unclaimed Local Vault.
 * Uses a throwaway owner distinct from testOwner so no per-User key is left behind.
 */
async function seedUnclaimedLocalVault(
  passphrase: string,
): Promise<UnclaimedVaultFixture> {
  const throwawayOwner = `throwaway-${Math.random().toString(36).slice(2)}`;
  const handle = createVaultHandle({ owner: throwawayOwner });
  await handle.initialize({ passphrase });

  const vault = handle.loadVault();
  if (!vault) {
    throw new Error('Failed to load vault after initialize');
  }

  const ownedKey = localVaultStorageKey(throwawayOwner);
  const ownedRaw = getRequiredLocalStorageItem(ownedKey);
  const ownedRecord = JSON.parse(ownedRaw);

  localStorage.removeItem(ownedKey);
  const raw = JSON.stringify(ownedRecord.vault);
  localStorage.setItem(VAULT_STORAGE_KEY, raw);

  return { vault: ownedRecord.vault, raw };
}

type IntegrationFixture = {
  vault: VaultStorageV1;
  raw: string;
  claimHandle: ReturnType<typeof createVaultHandle>;
};

/**
 * Create an unclaimed Local Vault and a fresh handle that sees it as unclaimed.
 * Used by integration tests that test handle.vaultStatus() and handle.isUnlocked.
 * Returns vault object, raw string, and the handle ready to test claim behavior.
 */
async function seedUnclaimedVaultWithHandle(
  owner: string,
  passphrase: string,
): Promise<IntegrationFixture> {
  const handle = createVaultHandle({ owner });
  await handle.initialize({ passphrase });

  const vault = handle.loadVault();
  if (!vault) {
    throw new Error('Failed to load vault after initialize');
  }

  const ownedKey = localVaultStorageKey(owner);
  localStorage.removeItem(ownedKey);
  const raw = JSON.stringify(vault);
  localStorage.setItem(VAULT_STORAGE_KEY, raw);

  const claimHandle = createVaultHandle({ owner });

  return { vault, raw, claimHandle };
}

/**
 * Helper to snapshot all localStorage entries for byte-identity assertions.
 */
function snapshotLocalStorage(): Map<string, string | null> {
  const snapshot = new Map<string, string | null>();
  for (const key of Object.keys(localStorage)) {
    snapshot.set(key, localStorage.getItem(key));
  }
  return snapshot;
}

/**
 * Helper to verify all localStorage entries are byte-identical to a snapshot.
 */
function assertStorageByteIdentical(
  before: Map<string, string | null>,
  after: Map<string, string | null>,
) {
  const allKeys = new Set([...before.keys(), ...after.keys()]);
  for (const key of allKeys) {
    expect(after.get(key)).toBe(before.get(key));
  }
}

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

describe('vaultClaimEvidence', () => {
  const passphrase = 'testpass123';
  const testOwner = 'test-user-id';

  describe('checkVaultClaimEvidence', () => {
    test("a server Vault Meta with the same kdf_salt is evidence the Vault is this User's", async () => {
      const fixture = await seedUnclaimedLocalVault(passphrase);

      const api = createApiDouble();
      const serverMeta = {
        etag: 'test-etag',
        updatedAt: '2026-01-01T00:00:00Z',
        meta: {
          version: 1,
          kdf_salt: fixture.vault.kdf.salt,
          wrapped_mk_passphrase: fixture.vault.masterKeyWrappedWithPassphrase,
          wrapped_mk_recovery: fixture.vault.masterKeyWrappedWithRecoveryKey,
        } as VaultMetaV1,
      };
      api.getVaultMeta.mockResolvedValue({
        data: serverMeta,
      } as AxiosResponse);

      const result = await checkVaultClaimEvidence({
        api,
        unclaimedVault: fixture.vault,
      });

      expect(result).toEqual({
        kind: 'server-meta-match',
        serverMeta,
      });
    });

    test('a passphrase rotation on another device (same salt, different wrapped_mk_passphrase) is still the same Vault', async () => {
      const fixture = await seedUnclaimedLocalVault(passphrase);

      const api = createApiDouble();
      const serverMeta = {
        etag: 'test-etag',
        updatedAt: '2026-01-01T00:00:00Z',
        meta: {
          version: 1,
          kdf_salt: fixture.vault.kdf.salt,
          wrapped_mk_passphrase: {
            iv: 'different-iv',
            ciphertext: 'different-ciphertext',
          },
          wrapped_mk_recovery: fixture.vault.masterKeyWrappedWithRecoveryKey,
        } as VaultMetaV1,
      };
      api.getVaultMeta.mockResolvedValue({
        data: serverMeta,
      } as AxiosResponse);

      const result = await checkVaultClaimEvidence({
        api,
        unclaimedVault: fixture.vault,
      });

      expect(result.kind).toBe('server-meta-match');
    });

    test('a recovery key rotation on another device (same salt, different wrapped_mk_recovery) is still the same Vault', async () => {
      const fixture = await seedUnclaimedLocalVault(passphrase);

      const api = createApiDouble();
      const serverMeta = {
        etag: 'test-etag',
        updatedAt: '2026-01-01T00:00:00Z',
        meta: {
          version: 1,
          kdf_salt: fixture.vault.kdf.salt,
          wrapped_mk_passphrase: fixture.vault.masterKeyWrappedWithPassphrase,
          wrapped_mk_recovery: {
            iv: 'different-iv',
            ciphertext: 'different-ciphertext',
          },
        } as VaultMetaV1,
      };
      api.getVaultMeta.mockResolvedValue({
        data: serverMeta,
      } as AxiosResponse);

      const result = await checkVaultClaimEvidence({
        api,
        unclaimedVault: fixture.vault,
      });

      expect(result.kind).toBe('server-meta-match');
    });

    test('a different kdf_salt proves a different Vault', async () => {
      const fixture = await seedUnclaimedLocalVault(passphrase);

      const api = createApiDouble();
      api.getVaultMeta.mockResolvedValue({
        data: {
          etag: 'test-etag',
          updatedAt: '2026-01-01T00:00:00Z',
          meta: {
            version: 1,
            kdf_salt: 'different-salt-that-proves-different-vault',
            wrapped_mk_passphrase: fixture.vault.masterKeyWrappedWithPassphrase,
            wrapped_mk_recovery: fixture.vault.masterKeyWrappedWithRecoveryKey,
          } as VaultMetaV1,
        },
      } as AxiosResponse);

      const result = await checkVaultClaimEvidence({
        api,
        unclaimedVault: fixture.vault,
      });

      expect(result).toEqual({ kind: 'server-meta-mismatch' });
    });

    test('a 404 response means the server has no evidence', async () => {
      const fixture = await seedUnclaimedLocalVault(passphrase);

      const api = createApiDouble();
      api.getVaultMeta.mockRejectedValue({
        response: { status: 404 },
      });

      const result = await checkVaultClaimEvidence({
        api,
        unclaimedVault: fixture.vault,
      });

      expect(result).toEqual({ kind: 'no-evidence' });
    });

    test('a 401 response means the session was lost', async () => {
      const fixture = await seedUnclaimedLocalVault(passphrase);

      const api = createApiDouble();
      api.getVaultMeta.mockRejectedValue({
        response: { status: 401 },
      });

      const result = await checkVaultClaimEvidence({
        api,
        unclaimedVault: fixture.vault,
      });

      expect(result).toEqual({ kind: 'session-lost' });
    });

    test('a 403 response means the session was lost', async () => {
      const fixture = await seedUnclaimedLocalVault(passphrase);

      const api = createApiDouble();
      api.getVaultMeta.mockRejectedValue({
        response: { status: 403 },
      });

      const result = await checkVaultClaimEvidence({
        api,
        unclaimedVault: fixture.vault,
      });

      expect(result).toEqual({ kind: 'session-lost' });
    });

    test('a network error with no response postpones the check', async () => {
      const fixture = await seedUnclaimedLocalVault(passphrase);

      const api = createApiDouble();
      api.getVaultMeta.mockRejectedValue(new Error('Network error'));

      const result = await checkVaultClaimEvidence({
        api,
        unclaimedVault: fixture.vault,
      });

      expect(result).toEqual({ kind: 'postponed' });
    });

    test('a 500 server error postpones the check', async () => {
      const fixture = await seedUnclaimedLocalVault(passphrase);

      const api = createApiDouble();
      api.getVaultMeta.mockRejectedValue({
        response: { status: 500 },
      });

      const result = await checkVaultClaimEvidence({
        api,
        unclaimedVault: fixture.vault,
      });

      expect(result).toEqual({ kind: 'postponed' });
    });

    test('a 503 gateway error postpones the check', async () => {
      const fixture = await seedUnclaimedLocalVault(passphrase);

      const api = createApiDouble();
      api.getVaultMeta.mockRejectedValue({
        response: { status: 503 },
      });

      const result = await checkVaultClaimEvidence({
        api,
        unclaimedVault: fixture.vault,
      });

      expect(result).toEqual({ kind: 'postponed' });
    });

    test('a non-Error thrown value postpones the check', async () => {
      const fixture = await seedUnclaimedLocalVault(passphrase);

      const api = createApiDouble();
      api.getVaultMeta.mockRejectedValue('thrown string');

      const result = await checkVaultClaimEvidence({
        api,
        unclaimedVault: fixture.vault,
      });

      expect(result).toEqual({ kind: 'postponed' });
    });

    test('an unreadable wrapped_mk_passphrase version postpones the check', async () => {
      const fixture = await seedUnclaimedLocalVault(passphrase);

      const api = createApiDouble();
      api.getVaultMeta.mockResolvedValue({
        data: {
          etag: 'test-etag',
          updatedAt: '2026-01-01T00:00:00Z',
          meta: {
            version: 1,
            kdf_salt: fixture.vault.kdf.salt,
            wrapped_mk_passphrase: {
              version: 2,
              iv: 'test-iv',
              ciphertext: 'test-ciphertext',
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any,
            wrapped_mk_recovery: fixture.vault.masterKeyWrappedWithRecoveryKey,
          } as VaultMetaV1,
        },
      } as AxiosResponse);

      const result = await checkVaultClaimEvidence({
        api,
        unclaimedVault: fixture.vault,
      });

      expect(result).toEqual({ kind: 'postponed' });
    });
  });

  describe('claimUnclaimedLocalVaultOnEvidence — full integration with real handle', () => {
    test('matching server meta claims unclaimed vault; ownership recorded, vault locked', async () => {
      const fixture = await seedUnclaimedVaultWithHandle(testOwner, passphrase);
      expect(fixture.claimHandle.vaultStatus()).toBe('unclaimed');

      const api = createApiDouble();
      api.getVaultMeta.mockResolvedValue({
        data: {
          etag: 'test-etag',
          updatedAt: '2026-01-01T00:00:00Z',
          meta: {
            version: 1,
            kdf_salt: fixture.vault.kdf.salt,
            wrapped_mk_passphrase: fixture.vault.masterKeyWrappedWithPassphrase,
            wrapped_mk_recovery: fixture.vault.masterKeyWrappedWithRecoveryKey,
          } as VaultMetaV1,
        },
      } as AxiosResponse);

      const result = await claimUnclaimedLocalVaultOnEvidence({
        api,
        handle: fixture.claimHandle,
      });

      expect(result).toEqual({ kind: 'claimed' });
      expect(fixture.claimHandle.vaultStatus()).toBe('owned');
      expect(fixture.claimHandle.isUnlocked).toBe(false);

      // Verify ownership recorded in per-User key
      const ownedKey = localVaultStorageKey(testOwner);
      const ownedRaw = localStorage.getItem(ownedKey);
      expect(ownedRaw).not.toBeNull();
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const ownedRecord = JSON.parse(ownedRaw!);
      expect(ownedRecord.version).toBe(LOCAL_VAULT_RECORD_VERSION);
      expect(ownedRecord.owner).toBe(testOwner);
      expect(ownedRecord.vault).toEqual(fixture.vault);

      // Verify unsuffixed slot is byte-identical
      const unclaimedRaw = localStorage.getItem(VAULT_STORAGE_KEY);
      expect(unclaimedRaw).toBe(fixture.raw);
    });

    test('after claim, vault is locked and unlockWithPassphrase succeeds', async () => {
      const fixture = await seedUnclaimedVaultWithHandle(testOwner, passphrase);

      const api = createApiDouble();
      api.getVaultMeta.mockResolvedValue({
        data: {
          etag: 'test-etag',
          updatedAt: '2026-01-01T00:00:00Z',
          meta: {
            version: 1,
            kdf_salt: fixture.vault.kdf.salt,
            wrapped_mk_passphrase: fixture.vault.masterKeyWrappedWithPassphrase,
            wrapped_mk_recovery: fixture.vault.masterKeyWrappedWithRecoveryKey,
          } as VaultMetaV1,
        },
      } as AxiosResponse);

      await claimUnclaimedLocalVaultOnEvidence({
        api,
        handle: fixture.claimHandle,
      });

      // Verify locked after claim
      expect(fixture.claimHandle.isUnlocked).toBe(false);

      // Verify can still unlock with passphrase
      const unlockResult = await fixture.claimHandle.unlockWithPassphrase({
        passphrase,
      });
      expect(unlockResult.masterKeyBytes).toBeInstanceOf(Uint8Array);
      expect(fixture.claimHandle.isUnlocked).toBe(true);
    });

    test('on server meta mismatch, nothing written; vault remains unclaimed and locked', async () => {
      const fixture = await seedUnclaimedVaultWithHandle(testOwner, passphrase);
      const storageBefore = snapshotLocalStorage();

      const api = createApiDouble();
      api.getVaultMeta.mockResolvedValue({
        data: {
          etag: 'test-etag',
          updatedAt: '2026-01-01T00:00:00Z',
          meta: {
            version: 1,
            kdf_salt: 'different-salt',
            wrapped_mk_passphrase: fixture.vault.masterKeyWrappedWithPassphrase,
            wrapped_mk_recovery: fixture.vault.masterKeyWrappedWithRecoveryKey,
          } as VaultMetaV1,
        },
      } as AxiosResponse);

      const result = await claimUnclaimedLocalVaultOnEvidence({
        api,
        handle: fixture.claimHandle,
      });

      expect(result).toEqual({ kind: 'refused-not-this-vault' });
      expect(fixture.claimHandle.vaultStatus()).toBe('unclaimed');
      expect(fixture.claimHandle.isUnlocked).toBe(false);
      expect(localStorage.getItem(localVaultStorageKey(testOwner))).toBeNull();

      const storageAfter = snapshotLocalStorage();
      assertStorageByteIdentical(storageBefore, storageAfter);
    });

    test('on 404 no-evidence, nothing written', async () => {
      const fixture = await seedUnclaimedVaultWithHandle(testOwner, passphrase);
      const storageBefore = snapshotLocalStorage();

      const api = createApiDouble();
      api.getVaultMeta.mockRejectedValue({
        response: { status: 404 },
      });

      const result = await claimUnclaimedLocalVaultOnEvidence({
        api,
        handle: fixture.claimHandle,
      });

      expect(result).toEqual({ kind: 'no-evidence' });
      expect(localStorage.getItem(localVaultStorageKey(testOwner))).toBeNull();

      const storageAfter = snapshotLocalStorage();
      assertStorageByteIdentical(storageBefore, storageAfter);
    });

    test('on 401 session-lost, nothing written', async () => {
      const fixture = await seedUnclaimedVaultWithHandle(testOwner, passphrase);
      const storageBefore = snapshotLocalStorage();

      const api = createApiDouble();
      api.getVaultMeta.mockRejectedValue({
        response: { status: 401 },
      });

      const result = await claimUnclaimedLocalVaultOnEvidence({
        api,
        handle: fixture.claimHandle,
      });

      expect(result).toEqual({ kind: 'session-lost' });
      expect(localStorage.getItem(localVaultStorageKey(testOwner))).toBeNull();

      const storageAfter = snapshotLocalStorage();
      assertStorageByteIdentical(storageBefore, storageAfter);
    });

    test('postponed on network error: result postponed, storage unchanged, vault status unclaimed, no owned key created', async () => {
      const fixture = await seedUnclaimedVaultWithHandle(testOwner, passphrase);
      const storageBefore = snapshotLocalStorage();

      const api = createApiDouble();
      api.getVaultMeta.mockRejectedValue(new Error('Network error'));

      const result = await claimUnclaimedLocalVaultOnEvidence({
        api,
        handle: fixture.claimHandle,
      });

      expect(result).toEqual({ kind: 'postponed' });
      expect(fixture.claimHandle.vaultStatus()).toBe('unclaimed');
      expect(fixture.claimHandle.isUnlocked).toBe(false);
      expect(localStorage.getItem(localVaultStorageKey(testOwner))).toBeNull();

      const storageAfter = snapshotLocalStorage();
      assertStorageByteIdentical(storageBefore, storageAfter);
    });

    test('postponed on 500 server error: result postponed, storage unchanged, vault status unclaimed', async () => {
      const fixture = await seedUnclaimedVaultWithHandle(testOwner, passphrase);
      const storageBefore = snapshotLocalStorage();

      const api = createApiDouble();
      api.getVaultMeta.mockRejectedValue({
        response: { status: 500 },
      });

      const result = await claimUnclaimedLocalVaultOnEvidence({
        api,
        handle: fixture.claimHandle,
      });

      expect(result).toEqual({ kind: 'postponed' });
      const storageAfter = snapshotLocalStorage();
      assertStorageByteIdentical(storageBefore, storageAfter);
    });

    test('postponed on 503 gateway error: result postponed, storage unchanged', async () => {
      const fixture = await seedUnclaimedVaultWithHandle(testOwner, passphrase);
      const storageBefore = snapshotLocalStorage();

      const api = createApiDouble();
      api.getVaultMeta.mockRejectedValue({
        response: { status: 503 },
      });

      const result = await claimUnclaimedLocalVaultOnEvidence({
        api,
        handle: fixture.claimHandle,
      });

      expect(result).toEqual({ kind: 'postponed' });
      const storageAfter = snapshotLocalStorage();
      assertStorageByteIdentical(storageBefore, storageAfter);
    });

    test('postponed on timeout (ECONNABORTED): result postponed, storage unchanged', async () => {
      const fixture = await seedUnclaimedVaultWithHandle(testOwner, passphrase);
      const storageBefore = snapshotLocalStorage();

      const api = createApiDouble();
      api.getVaultMeta.mockRejectedValue({
        code: 'ECONNABORTED',
      });

      const result = await claimUnclaimedLocalVaultOnEvidence({
        api,
        handle: fixture.claimHandle,
      });

      expect(result).toEqual({ kind: 'postponed' });
      const storageAfter = snapshotLocalStorage();
      assertStorageByteIdentical(storageBefore, storageAfter);
    });

    test('the security invariant — unreachable server does not fall back to passphrase unwrap', async () => {
      // This test enforces the core security invariant: an unreachable server
      // does NOT cause a fallback to weaker proof (passphrase unwrap). The
      // correct passphrase for this unclaimed vault exists, but the outcome
      // is still postponed with nothing written.
      const fixture = await seedUnclaimedVaultWithHandle(testOwner, passphrase);
      const storageBefore = snapshotLocalStorage();

      const api = createApiDouble();
      api.getVaultMeta.mockRejectedValue(new Error('Network unreachable'));

      // claimUnclaimedLocalVaultOnEvidence takes NO secret at all
      const result = await claimUnclaimedLocalVaultOnEvidence({
        api,
        handle: fixture.claimHandle,
      });

      // Even though the passphrase would unwrap this vault, we do NOT fall back
      expect(result).toEqual({ kind: 'postponed' });
      expect(fixture.claimHandle.vaultStatus()).toBe('unclaimed');

      // Nothing written
      const storageAfter = snapshotLocalStorage();
      assertStorageByteIdentical(storageBefore, storageAfter);
    });

    test('replace-offer when owner holds owned vault and coexisting unclaimed vault matches server meta', async () => {
      // This test verifies the scenario where an owner has their own vault AND
      // a separate unclaimed vault exists on the device. The server meta matches
      // the unclaimed one, so evidence is found but nothing is written — this is
      // an offer, not a claim. The API IS called because there IS something to check.
      const handle = createVaultHandle({ owner: testOwner });
      await handle.initialize({ passphrase });

      // Create another vault in unsuffixed slot to act as unclaimed
      const handle2 = createVaultHandle({ owner: 'other-owner' });
      await handle2.initialize({ passphrase });
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const otherVault = handle2.loadVault()!;

      localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(otherVault));

      const storageBefore = snapshotLocalStorage();

      // Now claim on the first handle which already has its own vault
      const api = createApiDouble();
      const serverMeta = {
        etag: 'test-etag',
        updatedAt: '2026-01-01T00:00:00Z',
        meta: {
          version: 1,
          kdf_salt: otherVault.kdf.salt,
          wrapped_mk_passphrase: otherVault.masterKeyWrappedWithPassphrase,
          wrapped_mk_recovery: otherVault.masterKeyWrappedWithRecoveryKey,
        } as VaultMetaV1,
      };
      api.getVaultMeta.mockResolvedValue({
        data: serverMeta,
      } as AxiosResponse);

      const result = await claimUnclaimedLocalVaultOnEvidence({
        api,
        handle,
      });

      expect(result).toEqual({ kind: 'replace-offer' });
      expect(api.getVaultMeta).toHaveBeenCalled();
      const storageAfter = snapshotLocalStorage();
      assertStorageByteIdentical(storageBefore, storageAfter);
    });

    test('skipped-already-owned when owner holds owned vault with no unclaimed vault at all; api not called', async () => {
      // When an owner is already owned AND there is NO separate unclaimed vault
      // on the device (unsuffixed slot is empty), the check is skipped entirely.
      // No server round trip is made — this is the "costs nothing" property the
      // hook's docstring promises.
      const handle = createVaultHandle({ owner: testOwner });
      await handle.initialize({ passphrase });

      // Do NOT create an unclaimed vault — just leave the unsuffixed slot empty
      const storageBefore = snapshotLocalStorage();

      const api = createApiDouble();

      const result = await claimUnclaimedLocalVaultOnEvidence({
        api,
        handle,
      });

      expect(result).toEqual({ kind: 'skipped-already-owned' });
      expect(api.getVaultMeta).not.toHaveBeenCalled();
      const storageAfter = snapshotLocalStorage();
      assertStorageByteIdentical(storageBefore, storageAfter);
    });

    test('skipped-nothing-to-claim when no unclaimed vault at all', async () => {
      const handle = createVaultHandle({ owner: testOwner });
      const api = createApiDouble();

      const result = await claimUnclaimedLocalVaultOnEvidence({
        api,
        handle,
      });

      expect(result).toEqual({ kind: 'skipped-nothing-to-claim' });
      expect(api.getVaultMeta).not.toHaveBeenCalled();
    });

    test('skipped-nothing-to-claim when entry under user key names someone else (owner-mismatch)', async () => {
      const handle = createVaultHandle({ owner: testOwner });
      const vault = handle.loadVault();
      expect(vault).toBeNull(); // No vault exists yet

      // Create an unclaimed vault and write it to unsuffixed slot
      const fixture = await seedUnclaimedLocalVault(passphrase);

      // Now write a record under the first owner's key that names a different owner
      const wrongOwnerRecord = {
        version: LOCAL_VAULT_RECORD_VERSION,
        owner: 'yet-another-owner',
        vault: fixture.vault,
      };
      localStorage.setItem(
        localVaultStorageKey(testOwner),
        JSON.stringify(wrongOwnerRecord),
      );

      const api = createApiDouble();

      const result = await claimUnclaimedLocalVaultOnEvidence({
        api,
        handle,
      });

      expect(result).toEqual({ kind: 'skipped-nothing-to-claim' });
      expect(api.getVaultMeta).not.toHaveBeenCalled();
    });
  });

  describe('handle.claimUnclaimedLocalVaultLocked()', () => {
    test('claims unclaimed vault into owner record and binds no master key', async () => {
      const fixture = await seedUnclaimedVaultWithHandle(testOwner, passphrase);
      expect(fixture.claimHandle.vaultStatus()).toBe('unclaimed');
      expect(fixture.claimHandle.isUnlocked).toBe(false);

      // Claim it
      fixture.claimHandle.claimUnclaimedLocalVaultLocked();

      // Now owned
      expect(fixture.claimHandle.vaultStatus()).toBe('owned');
      // Still locked
      expect(fixture.claimHandle.isUnlocked).toBe(false);

      // Verify record written
      const ownedKey = localVaultStorageKey(testOwner);
      const ownedRaw = getRequiredLocalStorageItem(ownedKey);
      const ownedRecord = JSON.parse(ownedRaw);
      expect(ownedRecord.owner).toBe(testOwner);
    });

    test('throws LocalVaultAlreadyOwnedError when owner holds owned vault; nothing written', async () => {
      const handle = createVaultHandle({ owner: testOwner });
      await handle.initialize({ passphrase });

      // Create another vault for unclaimed (side effect: written to unsuffixed slot)
      await seedUnclaimedLocalVault(passphrase);

      const storageBefore = snapshotLocalStorage();

      expect(() => handle.claimUnclaimedLocalVaultLocked()).toThrow(
        LocalVaultAlreadyOwnedError,
      );

      const storageAfter = snapshotLocalStorage();
      assertStorageByteIdentical(storageBefore, storageAfter);
    });

    test('throws NoUnclaimedLocalVaultError when no unclaimed vault', () => {
      const handle = createVaultHandle({ owner: testOwner });

      expect(() => handle.claimUnclaimedLocalVaultLocked()).toThrow(
        'There is no Unclaimed Local Vault on this device',
      );
    });

    test('handle constructed with masterKeyBytes keeps binding across claim', async () => {
      const handle = createVaultHandle({ owner: testOwner });
      await handle.initialize({ passphrase });

      // Bind master key by unlocking
      const unlockResult = await handle.unlockWithPassphrase({ passphrase });
      expect(handle.isUnlocked).toBe(true);

      const vault = handle.loadVault();
      if (!vault) {
        throw new Error('Failed to load vault after initialize');
      }

      const ownedKey = localVaultStorageKey(testOwner);
      localStorage.removeItem(ownedKey);
      localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(vault));

      const claimHandle = createVaultHandle({
        owner: testOwner,
        masterKeyBytes: unlockResult.masterKeyBytes,
      });
      expect(claimHandle.isUnlocked).toBe(true);

      // Claim should not change locked state
      claimHandle.claimUnclaimedLocalVaultLocked();

      expect(claimHandle.isUnlocked).toBe(true);
      expect(claimHandle.vaultStatus()).toBe('owned');
    });

    test('claim by one owner leaves unclaimed vault resolvable for another owner', async () => {
      const ownerA = 'user-a';
      const ownerC = 'user-c';

      const fixtureA = await seedUnclaimedVaultWithHandle(ownerA, passphrase);
      const unclaimedBefore = localStorage.getItem(VAULT_STORAGE_KEY);

      // User A claims
      fixtureA.claimHandle.claimUnclaimedLocalVaultLocked();

      // User C's handle should still see it as unclaimed
      const handleC = createVaultHandle({ owner: ownerC });
      expect(handleC.vaultStatus()).toBe('unclaimed');

      // Unsuffixed slot should be byte-identical (unchanged by claim)
      expect(localStorage.getItem(VAULT_STORAGE_KEY)).toBe(unclaimedBefore);
    });
  });

  describe('VAULT_META_CHANGE_SAME_VAULT constant', () => {
    test('has exactly VAULT_META_CHANGES members with correct values', () => {
      // every member of VAULT_META_CHANGES has an entry
      for (const change of VAULT_META_CHANGES) {
        expect(VAULT_META_CHANGE_SAME_VAULT).toHaveProperty(change);
      }

      // only VAULT_META_CHANGES members exist
      const sameVaultKeys = Object.keys(
        VAULT_META_CHANGE_SAME_VAULT,
      ) as VaultMetaChange[];
      expect(sameVaultKeys.sort()).toEqual([...VAULT_META_CHANGES].sort());

      // correct values: only 'different-vault' is false
      expect(VAULT_META_CHANGE_SAME_VAULT['different-vault']).toBe(false);
      expect(VAULT_META_CHANGE_SAME_VAULT.passphrase).toBe(true);
      expect(VAULT_META_CHANGE_SAME_VAULT['recovery-key']).toBe(true);
    });
  });
});
