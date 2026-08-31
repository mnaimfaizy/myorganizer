/**
 * Tests for Vault Claim Replace — replacing an owned Local Vault with an
 * Unclaimed Local Vault via evidence (server meta or recovery key), and export
 * escape (exporting a locked owned vault before replacement).
 *
 * This is the acceptance-test suite for ADR 0033 (the claim copies, never moves,
 * and the Unclaimed Local Vault slot is left byte-identical) and ADR 0061 (a
 * correct recovery key while owned proves evidence but must NOT write).
 *
 * Tests use REAL WebCrypto and real localStorage, along with a real VaultHandle
 * bound to a test owner, to establish that replace operations leave storage
 * byte-identical on failures, accurately write on success, and that the export
 * path works on a locked vault before replacement.
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
  claimUnclaimedLocalVaultOnEvidence,
  claimUnclaimedLocalVaultWithRecoveryKey,
  replaceOwnedLocalVaultOnEvidence,
  replaceOwnedLocalVaultWithRecoveryKey,
} from './vaultClaimEvidence';
import {
  VAULT_STORAGE_KEY,
  localVaultStorageKey,
  type VaultStorageV1,
} from './localVaultStorage';
import { createVaultHandle } from './vaultHandle';
import { exportVault } from './vaultExportImport';

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

type UnclaimedVaultFixture = {
  vault: VaultStorageV1;
  raw: string;
  recoveryKey: string;
};

/**
 * Put a real, WebCrypto-built Vault into the unsuffixed slot as an Unclaimed Local Vault,
 * and return the recovery key that can unwrap it.
 * Uses a throwaway owner distinct from the test owner so no per-User key is left behind.
 */
async function seedUnclaimedLocalVaultWithRecoveryKey(
  passphrase: string,
): Promise<UnclaimedVaultFixture> {
  const throwawayOwner = `throwaway-${Math.random().toString(36).slice(2)}`;
  const handle = createVaultHandle({ owner: throwawayOwner });
  const { recoveryKey } = await handle.initialize({ passphrase });

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

  return { vault: ownedRecord.vault, raw, recoveryKey };
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

describe('vaultClaimEvidenceReplace', () => {
  const passphrase = 'testpass123';
  const testOwner = 'test-user-id';

  describe('claimUnclaimedLocalVaultOnEvidence — owned + coexisting Unclaimed Local Vault', () => {
    test('1. returns replace-offer when server Vault Meta matches the Unclaimed Local Vault', async () => {
      // Owned user has their own vault
      const ownHandle = createVaultHandle({ owner: testOwner });
      await ownHandle.initialize({ passphrase });

      // Coexisting unclaimed vault
      const unclaimedFixture =
        await seedUnclaimedLocalVaultWithRecoveryKey(passphrase);

      const claimHandle = createVaultHandle({ owner: testOwner });
      const storageBefore = snapshotLocalStorage();

      const api = createApiDouble();
      const serverMeta = {
        etag: 'test-etag',
        updatedAt: '2026-01-01T00:00:00Z',
        meta: {
          version: 1,
          kdf_salt: unclaimedFixture.vault.kdf.salt,
          wrapped_mk_passphrase:
            unclaimedFixture.vault.masterKeyWrappedWithPassphrase,
          wrapped_mk_recovery: unclaimedFixture.vault.masterKeyWrappedWithRecoveryKey,
        } as VaultMetaV1,
      };
      api.getVaultMeta.mockResolvedValue({
        data: serverMeta,
      } as AxiosResponse);

      const result = await claimUnclaimedLocalVaultOnEvidence({
        api,
        handle: claimHandle,
      });

      expect(result).toEqual({ kind: 'replace-offer' });
      const storageAfter = snapshotLocalStorage();
      assertStorageByteIdentical(storageBefore, storageAfter);
    });

    test('2. returns refused-not-this-vault when server Vault Meta names a different Vault', async () => {
      // Owned user has their own vault
      const ownHandle = createVaultHandle({ owner: testOwner });
      await ownHandle.initialize({ passphrase });

      // Coexisting unclaimed vault
      const unclaimedFixture =
        await seedUnclaimedLocalVaultWithRecoveryKey(passphrase);

      const claimHandle = createVaultHandle({ owner: testOwner });
      const storageBefore = snapshotLocalStorage();

      const api = createApiDouble();
      const serverMeta = {
        etag: 'test-etag',
        updatedAt: '2026-01-01T00:00:00Z',
        meta: {
          version: 1,
          kdf_salt: 'different-salt-base64-string',
          wrapped_mk_passphrase: {
            iv: 'different-iv',
            ciphertext: 'different-ciphertext',
          },
          wrapped_mk_recovery: {
            iv: 'different-iv',
            ciphertext: 'different-ciphertext',
          },
        } as VaultMetaV1,
      };
      api.getVaultMeta.mockResolvedValue({
        data: serverMeta,
      } as AxiosResponse);

      const result = await claimUnclaimedLocalVaultOnEvidence({
        api,
        handle: claimHandle,
      });

      expect(result).toEqual({ kind: 'refused-not-this-vault' });
      const storageAfter = snapshotLocalStorage();
      assertStorageByteIdentical(storageBefore, storageAfter);
    });

    test('3. returns no-evidence when server holds no Vault Meta', async () => {
      // Owned user has their own vault
      const ownHandle = createVaultHandle({ owner: testOwner });
      await ownHandle.initialize({ passphrase });

      // Coexisting unclaimed vault
      const _unclaimedFixture =
        await seedUnclaimedLocalVaultWithRecoveryKey(passphrase);

      const claimHandle = createVaultHandle({ owner: testOwner });
      const storageBefore = snapshotLocalStorage();

      const api = createApiDouble();
      api.getVaultMeta.mockRejectedValue({
        response: { status: 404 },
      });

      const result = await claimUnclaimedLocalVaultOnEvidence({
        api,
        handle: claimHandle,
      });

      expect(result).toEqual({ kind: 'no-evidence' });
      const storageAfter = snapshotLocalStorage();
      assertStorageByteIdentical(storageBefore, storageAfter);
    });

    test('4. returns postponed when server is unreachable', async () => {
      // Owned user has their own vault
      const ownHandle = createVaultHandle({ owner: testOwner });
      await ownHandle.initialize({ passphrase });

      // Coexisting unclaimed vault
      const _unclaimedFixture =
        await seedUnclaimedLocalVaultWithRecoveryKey(passphrase);

      const claimHandle = createVaultHandle({ owner: testOwner });
      const storageBefore = snapshotLocalStorage();

      const api = createApiDouble();
      api.getVaultMeta.mockRejectedValue(new Error('Network unreachable'));

      const result = await claimUnclaimedLocalVaultOnEvidence({
        api,
        handle: claimHandle,
      });

      expect(result).toEqual({ kind: 'postponed' });
      const storageAfter = snapshotLocalStorage();
      assertStorageByteIdentical(storageBefore, storageAfter);
    });

    test('5. returns session-lost when session expired (401/403)', async () => {
      // Owned user has their own vault
      const ownHandle = createVaultHandle({ owner: testOwner });
      await ownHandle.initialize({ passphrase });

      // Coexisting unclaimed vault
      const _unclaimedFixture =
        await seedUnclaimedLocalVaultWithRecoveryKey(passphrase);

      const claimHandle = createVaultHandle({ owner: testOwner });
      const storageBefore = snapshotLocalStorage();

      const api = createApiDouble();
      const error = new Error('Unauthorized');
      (error as unknown as { response?: { status: number } }).response = {
        status: 401,
      };
      api.getVaultMeta.mockRejectedValue(error);

      const result = await claimUnclaimedLocalVaultOnEvidence({
        api,
        handle: claimHandle,
      });

      expect(result).toEqual({ kind: 'session-lost' });
      const storageAfter = snapshotLocalStorage();
      assertStorageByteIdentical(storageBefore, storageAfter);
    });
  });

  describe('replaceOwnedLocalVaultOnEvidence — the confirm step', () => {
    test('6. replaces and locked when owned + coexisting Unclaimed Local Vault present', async () => {
      // Owned user has their own vault
      const ownHandle = createVaultHandle({ owner: testOwner });
      const { recoveryKey: ownRecoveryKey } = await ownHandle.initialize({
        passphrase,
      });

      // Unlock the owned vault first (to test that replace locks it)
      await ownHandle.unlockWithPassphrase({ passphrase });
      expect(ownHandle.isUnlocked).toBe(true);

      // Coexisting unclaimed vault with different passphrase
      const unclaimedFixture =
        await seedUnclaimedLocalVaultWithRecoveryKey('different-pass');

      const claimHandle = createVaultHandle({ owner: testOwner });
      expect(claimHandle.vaultStatus()).toBe('owned');
      const originalOwnedVault = claimHandle.loadVault();

      const storageBefore = snapshotLocalStorage();

      // Replace
      const result = replaceOwnedLocalVaultOnEvidence({
        handle: claimHandle,
      });

      expect(result).toEqual({ kind: 'replaced' });

      // Status still owned
      expect(claimHandle.vaultStatus()).toBe('owned');
      // Now locked (master key unbound)
      expect(claimHandle.isUnlocked).toBe(false);
      // Vault content changed to unclaimed vault
      const newVault = claimHandle.loadVault();
      expect(newVault).toEqual(unclaimedFixture.vault);
      expect(newVault).not.toEqual(originalOwnedVault);

      // Unclaimed slot is byte-identical (copied, not moved)
      const storageAfter = snapshotLocalStorage();
      const unclaimedSlotBefore = storageBefore.get(VAULT_STORAGE_KEY);
      const unclaimedSlotAfter = storageAfter.get(VAULT_STORAGE_KEY);
      expect(unclaimedSlotAfter).toBe(unclaimedSlotBefore);
    });

    test('7. skipped-nothing-to-replace when owned but NO coexisting Unclaimed Local Vault', async () => {
      const ownHandle = createVaultHandle({ owner: testOwner });
      const originalVault = (await ownHandle.initialize({ passphrase }), ownHandle.loadVault());

      const claimHandle = createVaultHandle({ owner: testOwner });
      const storageBefore = snapshotLocalStorage();

      const result = replaceOwnedLocalVaultOnEvidence({
        handle: claimHandle,
      });

      expect(result).toEqual({ kind: 'skipped-nothing-to-replace' });
      // Vault unchanged
      expect(claimHandle.loadVault()).toEqual(originalVault);
      const storageAfter = snapshotLocalStorage();
      assertStorageByteIdentical(storageBefore, storageAfter);
    });

    test('8. skipped-nothing-to-replace when not owned at all (absent vault)', async () => {
      const handle = createVaultHandle({ owner: testOwner });
      expect(handle.vaultStatus()).toBe('absent');

      const storageBefore = snapshotLocalStorage();

      const result = replaceOwnedLocalVaultOnEvidence({
        handle,
      });

      expect(result).toEqual({ kind: 'skipped-nothing-to-replace' });
      const storageAfter = snapshotLocalStorage();
      assertStorageByteIdentical(storageBefore, storageAfter);
    });
  });

  describe('claimUnclaimedLocalVaultWithRecoveryKey — owned + coexisting Unclaimed Local Vault', () => {
    test('9. returns replace-offer and storage unchanged when correct recovery key matches', async () => {
      // This is the load-bearing invariant: a correct recovery key while owned
      // proves evidence but MUST NOT write anything.
      const ownHandle = createVaultHandle({ owner: testOwner });
      await ownHandle.initialize({ passphrase });

      const unclaimedFixture =
        await seedUnclaimedLocalVaultWithRecoveryKey('different-pass');

      const claimHandle = createVaultHandle({ owner: testOwner });
      expect(claimHandle.vaultStatus()).toBe('owned');

      const storageBefore = snapshotLocalStorage();

      const result = await claimUnclaimedLocalVaultWithRecoveryKey({
        handle: claimHandle,
        recoveryKey: unclaimedFixture.recoveryKey,
      });

      expect(result).toEqual({ kind: 'replace-offer' });
      const storageAfter = snapshotLocalStorage();
      assertStorageByteIdentical(storageBefore, storageAfter);
    });

    test('10. returns no-match and storage unchanged when recovery key does not match', async () => {
      const ownHandle = createVaultHandle({ owner: testOwner });
      await ownHandle.initialize({ passphrase });

      const _unclaimedFixture =
        await seedUnclaimedLocalVaultWithRecoveryKey('different-pass');

      const claimHandle = createVaultHandle({ owner: testOwner });
      const storageBefore = snapshotLocalStorage();

      const result = await claimUnclaimedLocalVaultWithRecoveryKey({
        handle: claimHandle,
        recoveryKey: 'wrong-recovery-key-as-base64-here',
      });

      expect(result).toEqual({ kind: 'no-match' });
      const storageAfter = snapshotLocalStorage();
      assertStorageByteIdentical(storageBefore, storageAfter);
    });
  });

  describe('replaceOwnedLocalVaultWithRecoveryKey — the confirm step', () => {
    test('11. returns replaced + masterKeyBytes when correct recovery key unwraps the Unclaimed Vault', async () => {
      const ownHandle = createVaultHandle({ owner: testOwner });
      await ownHandle.initialize({ passphrase });

      const unclaimedFixture =
        await seedUnclaimedLocalVaultWithRecoveryKey('different-pass');

      const claimHandle = createVaultHandle({ owner: testOwner });
      const storageBefore = snapshotLocalStorage();

      const result = await replaceOwnedLocalVaultWithRecoveryKey({
        handle: claimHandle,
        recoveryKey: unclaimedFixture.recoveryKey,
      });

      expect(result.kind).toBe('replaced');
      if (result.kind === 'replaced') {
        expect(result.masterKeyBytes).toBeInstanceOf(Uint8Array);

        // After: status is owned, vault changed, and UNLOCKED
        expect(claimHandle.vaultStatus()).toBe('owned');
        expect(claimHandle.loadVault()).toEqual(unclaimedFixture.vault);
        expect(claimHandle.isUnlocked).toBe(true);

        // Verify the returned key decrypts data in the vault
        // (e.g., loadDecryptedData returns the default on empty vault)
        const decrypted = await claimHandle.loadDecryptedData({
          type: 'tasks',
          defaultValue: null,
        });
        expect(decrypted).toBe(null); // Empty vault returns default
      }

      // Unclaimed slot is byte-identical
      const storageAfter = snapshotLocalStorage();
      const unclaimedSlotBefore = storageBefore.get(VAULT_STORAGE_KEY);
      const unclaimedSlotAfter = storageAfter.get(VAULT_STORAGE_KEY);
      expect(unclaimedSlotAfter).toBe(unclaimedSlotBefore);
    });

    test('12. returns no-match when wrong recovery key provided', async () => {
      const ownHandle = createVaultHandle({ owner: testOwner });
      await ownHandle.initialize({ passphrase });

      const _unclaimedFixture =
        await seedUnclaimedLocalVaultWithRecoveryKey('different-pass');

      const claimHandle = createVaultHandle({ owner: testOwner });
      const storageBefore = snapshotLocalStorage();

      const result = await replaceOwnedLocalVaultWithRecoveryKey({
        handle: claimHandle,
        recoveryKey: 'wrong-recovery-key-as-base64-here',
      });

      expect(result).toEqual({ kind: 'no-match' });

      // Status and unlock state unchanged
      expect(claimHandle.vaultStatus()).toBe('owned');
      expect(claimHandle.isUnlocked).toBe(false);

      const storageAfter = snapshotLocalStorage();
      assertStorageByteIdentical(storageBefore, storageAfter);
    });

    test('13. returns no-match when no coexisting Unclaimed Local Vault (owned only)', async () => {
      const ownHandle = createVaultHandle({ owner: testOwner });
      await ownHandle.initialize({ passphrase });

      const claimHandle = createVaultHandle({ owner: testOwner });
      const storageBefore = snapshotLocalStorage();

      const result = await replaceOwnedLocalVaultWithRecoveryKey({
        handle: claimHandle,
        recoveryKey: 'some-recovery-key-as-base64',
      });

      expect(result).toEqual({ kind: 'no-match' });
      const storageAfter = snapshotLocalStorage();
      assertStorageByteIdentical(storageBefore, storageAfter);
    });
  });

  describe('export escape — exporting a locked vault before replacement', () => {
    test('14. exports a locked owned vault with wrapped master keys intact before replacement', async () => {
      // An owned user has their own vault, locked (no master key bound).
      // They can export it before replacement so they have a backup.
      // This tests that exportVault works on a locked handle and preserves
      // the wrapped keys needed to open it later.

      // Create and initialize an owned vault with unlocked access
      const ownHandle = createVaultHandle({ owner: testOwner });
      const { recoveryKey } = await ownHandle.initialize({ passphrase });

      // Unlock it so we can save data
      await ownHandle.unlockWithPassphrase({ passphrase });

      // Save some data (to have at least one blob for export)
      await ownHandle.saveEncryptedData({
        type: 'tasks',
        value: { title: 'Test task' },
      });

      // Get the vault and its original wrapped keys
      const ownedVault = ownHandle.loadVault();
      if (!ownedVault) throw new Error('Failed to load vault');

      // Create a fresh handle without unlocking (simulating the locked state)
      const lockedHandle = createVaultHandle({ owner: testOwner });
      expect(lockedHandle.isUnlocked).toBe(false);

      const vault = lockedHandle.loadVault();
      if (!vault) throw new Error('Failed to load vault');

      // Export the locked vault
      const exportResult = await exportVault({
        localVault: vault,
        source: 'local-file',
      });

      expect(exportResult.envelope).toBeDefined();
      expect(exportResult.text).toBeDefined();
      expect(exportResult.sizeBytes).toBeGreaterThan(0);

      // Verify the exported meta contains the wrapped keys intact
      const { meta } = exportResult.envelope;
      expect(meta.wrapped_mk_passphrase).toBeDefined();
      expect(meta.wrapped_mk_passphrase.iv).toBe(
        ownedVault.masterKeyWrappedWithPassphrase.iv,
      );
      expect(meta.wrapped_mk_passphrase.ciphertext).toBe(
        ownedVault.masterKeyWrappedWithPassphrase.ciphertext,
      );
      expect(meta.wrapped_mk_recovery).toBeDefined();
      expect(meta.wrapped_mk_recovery.iv).toBe(
        ownedVault.masterKeyWrappedWithRecoveryKey.iv,
      );
      expect(meta.wrapped_mk_recovery.ciphertext).toBe(
        ownedVault.masterKeyWrappedWithRecoveryKey.ciphertext,
      );

      // Verify blobs are present
      expect(exportResult.envelope.blobs).toBeDefined();
      expect(Object.keys(exportResult.envelope.blobs).length).toBeGreaterThan(0);
    });
  });
});
