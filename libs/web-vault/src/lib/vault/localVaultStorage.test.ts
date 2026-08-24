/**
 * Tests for Local Vault storage and per-User claim invariants.
 *
 * Covers the storage resolution matrix (owned, unclaimed, owner-mismatch, absent),
 * ownership assertions, and vault claim (unlockWithPassphrase/recovery-key) including
 * the byte-identity preservation invariants for the unsuffixed slot and failed unwraps.
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

jest.mock('./crypto', () => {
  const actual = jest.requireActual('./crypto');
  return {
    bytesToBase64: actual.bytesToBase64,
    base64ToBytes: actual.base64ToBytes,
    utf8ToBytes: actual.utf8ToBytes,
    bytesToUtf8: actual.bytesToUtf8,
    randomBytes: jest.fn((length: number) => new Uint8Array(length).fill(0x42)),
    importAesGcmKey: jest.fn(),
    deriveKeyFromPassphrase: jest.fn(),
    aesGcmEncrypt: jest.fn(),
    aesGcmDecrypt: jest.fn(),
  };
});

import {
  VAULT_STORAGE_KEY,
  LOCAL_VAULT_RECORD_VERSION,
  VaultOwnerMismatchError,
  localVaultStorageKey,
  readUnclaimedLocalVault,
  resolveLocalVault,
  writeOwnedLocalVault,
  ownedLocalVaultSlot,
  type VaultStorageV1,
} from './localVaultStorage';
import { createVaultHandle } from './vaultHandle';
import { VaultSecretMismatchError } from './localVaultAccess';
import {
  aesGcmDecrypt,
  aesGcmEncrypt,
  deriveKeyFromPassphrase,
  importAesGcmKey,
  bytesToBase64,
} from './crypto';

/**
 * A minimal VaultStorageV1 fixture for testing.
 */
function createTestVault(overrides?: Partial<VaultStorageV1>): VaultStorageV1 {
  return {
    version: 1,
    kdf: {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: 310_000,
      salt: bytesToBase64(new Uint8Array(16).fill(0xaa)),
    },
    masterKeyWrappedWithPassphrase: {
      iv: bytesToBase64(new Uint8Array(12).fill(0xbb)),
      ciphertext: bytesToBase64(new Uint8Array(48).fill(0xcc)),
    },
    masterKeyWrappedWithRecoveryKey: {
      iv: bytesToBase64(new Uint8Array(12).fill(0xdd)),
      ciphertext: bytesToBase64(new Uint8Array(48).fill(0xee)),
    },
    data: {},
    ...overrides,
  };
}

describe('localVaultStorage — storage resolution and ownership', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  describe('localVaultStorageKey — key composition and owner guard', () => {
    test('1: returns correct prefixed key for a valid owner', () => {
      const key = localVaultStorageKey('user-a');
      expect(key).toBe(`${VAULT_STORAGE_KEY}:user-a`);
    });

    test('2a: throws for empty string owner', () => {
      expect(() => localVaultStorageKey('')).toThrow(
        'A Local Vault cannot be resolved without an owner',
      );
    });

    test('2b: throws for whitespace-only owner', () => {
      expect(() => localVaultStorageKey('   ')).toThrow(
        'A Local Vault cannot be resolved without an owner',
      );
    });

    test('2c: resolveLocalVault throws for empty owner', () => {
      expect(() => resolveLocalVault('')).toThrow(
        'A Local Vault cannot be resolved without an owner',
      );
    });
  });

  describe('Per-User resolution — happy path and isolation', () => {
    test('3: resolveLocalVault returns owned vault for the writing user', () => {
      const vault = createTestVault();
      writeOwnedLocalVault({ owner: 'user-a', vault });

      const result = resolveLocalVault('user-a');
      expect(result.status).toBe('owned');
      expect(result).toHaveProperty('vault');
      if (result.status === 'owned') {
        expect(result.vault).toEqual(vault);
      }
    });

    test("4: resolveLocalVault does not return another user's record (isolation)", () => {
      const vault = createTestVault();
      writeOwnedLocalVault({ owner: 'user-b', vault });

      const result = resolveLocalVault('user-a');
      expect(result.status).toBe('absent');
    });
  });

  describe('Owner assertion — mismatch detection and write guards', () => {
    test('5: resolveLocalVault detects owner-mismatch when entry names different owner', () => {
      // Manually write an entry under user-a's key that names user-b
      const record = {
        version: LOCAL_VAULT_RECORD_VERSION,
        owner: 'user-b',
        vault: createTestVault(),
      };
      localStorage.setItem(
        localVaultStorageKey('user-a'),
        JSON.stringify(record),
      );

      const result = resolveLocalVault('user-a');
      expect(result.status).toBe('owner-mismatch');
      if (result.status === 'owner-mismatch') {
        expect(result.recordedOwner).toBe('user-b');
      }
    });

    test('6: writeOwnedLocalVault throws VaultOwnerMismatchError with recordedOwner when different owner named', () => {
      const vault1 = createTestVault();
      const vault2 = createTestVault({
        kdf: { ...createTestVault().kdf, iterations: 200_000 },
      });

      // Write user-b's entry under user-a's key (mismatch)
      localStorage.setItem(
        localVaultStorageKey('user-a'),
        JSON.stringify({
          version: LOCAL_VAULT_RECORD_VERSION,
          owner: 'user-b',
          vault: vault1,
        }),
      );
      const storedBefore = localStorage.getItem(localVaultStorageKey('user-a'));

      // Attempt to write as user-a
      expect(() =>
        writeOwnedLocalVault({ owner: 'user-a', vault: vault2 }),
      ).toThrow(VaultOwnerMismatchError);

      // Verify error details
      let thrownError: unknown;
      try {
        writeOwnedLocalVault({ owner: 'user-a', vault: vault2 });
      } catch (err) {
        thrownError = err;
      }
      expect(thrownError).toBeInstanceOf(VaultOwnerMismatchError);
      if (thrownError instanceof VaultOwnerMismatchError) {
        expect(thrownError.expectedOwner).toBe('user-a');
        expect(thrownError.recordedOwner).toBe('user-b');
      }

      // Verify entry unchanged
      const storedAfter = localStorage.getItem(localVaultStorageKey('user-a'));
      expect(storedAfter).toBe(storedBefore);
      expect(storedBefore).not.toBeNull();
    });

    test('6b: writeOwnedLocalVault throws VaultOwnerMismatchError with recordedOwner===null for unreadable entry', () => {
      const vault = createTestVault();
      const unreadableJson = '{not json';

      // Write an unreadable entry under user-a's key
      localStorage.setItem(localVaultStorageKey('user-a'), unreadableJson);
      const storedBefore = localStorage.getItem(localVaultStorageKey('user-a'));
      expect(storedBefore).toBe(unreadableJson);

      // Attempt to write as user-a
      expect(() => writeOwnedLocalVault({ owner: 'user-a', vault })).toThrow(
        VaultOwnerMismatchError,
      );

      // Verify error details
      let thrownError: unknown;
      try {
        writeOwnedLocalVault({ owner: 'user-a', vault });
      } catch (err) {
        thrownError = err;
      }
      expect(thrownError).toBeInstanceOf(VaultOwnerMismatchError);
      if (thrownError instanceof VaultOwnerMismatchError) {
        expect(thrownError.expectedOwner).toBe('user-a');
        expect(thrownError.recordedOwner).toBeNull();
      }

      // Verify entry unchanged — byte-identical
      const storedAfter = localStorage.getItem(localVaultStorageKey('user-a'));
      expect(storedAfter).toBe(storedBefore);
      expect(storedAfter).toBe(unreadableJson);
    });

    test("7: writeOwnedLocalVault overwrites same user's own record with current version", () => {
      const vault1 = createTestVault();
      const vault2 = createTestVault({
        kdf: { ...createTestVault().kdf, iterations: 200_000 },
      });

      // Write user-a's first entry
      writeOwnedLocalVault({ owner: 'user-a', vault: vault1 });

      // Overwrite with user-a's second entry
      writeOwnedLocalVault({ owner: 'user-a', vault: vault2 });

      // Verify it was replaced
      const result = resolveLocalVault('user-a');
      expect(result.status).toBe('owned');
      if (result.status === 'owned') {
        expect(result.vault).toEqual(vault2);
        expect(result.vault).not.toEqual(vault1);
      }

      // Verify record version and owner
      const stored = localStorage.getItem(localVaultStorageKey('user-a'));
      expect(stored).not.toBeNull();
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        expect(parsed.version).toBe(LOCAL_VAULT_RECORD_VERSION);
        expect(parsed.owner).toBe('user-a');
      }
    });
  });

  describe('Unclaimed Local Vault resolution', () => {
    test('8: resolveLocalVault offers unclaimed vault from unsuffixed slot when user has none', () => {
      const unclaimed = createTestVault();
      localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(unclaimed));

      const result = resolveLocalVault('user-a');
      expect(result.status).toBe('unclaimed');
      if (result.status === 'unclaimed') {
        expect(result.vault).toEqual(unclaimed);
      }
    });

    test('9: reading unclaimed does not write to unsuffixed slot', () => {
      const unclaimed = createTestVault();
      localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(unclaimed));
      const beforeRaw = localStorage.getItem(VAULT_STORAGE_KEY);

      resolveLocalVault('user-a');

      const afterRaw = localStorage.getItem(VAULT_STORAGE_KEY);
      expect(afterRaw).toBe(beforeRaw);
      // Verify key does not exist for user-a
      expect(localStorage.getItem(localVaultStorageKey('user-a'))).toBeNull();
    });

    test("10: unreadable entry under user's key means unclaimed is not offered", () => {
      // Write an unreadable entry under user-a's key
      localStorage.setItem(localVaultStorageKey('user-a'), '{not json');
      // Populate unsuffixed slot
      const unclaimed = createTestVault();
      localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(unclaimed));

      const result = resolveLocalVault('user-a');
      expect(result.status).toBe('absent');
    });

    test('11: readUnclaimedLocalVault returns null for corrupt JSON', () => {
      localStorage.setItem(VAULT_STORAGE_KEY, '{corrupt json');

      const result = readUnclaimedLocalVault();
      expect(result).toBeNull();
    });

    test('11b: readUnclaimedLocalVault returns null for wrong version', () => {
      const stored = {
        version: 2, // Wrong version
        kdf: createTestVault().kdf,
        masterKeyWrappedWithPassphrase:
          createTestVault().masterKeyWrappedWithPassphrase,
      };
      localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(stored));

      const result = readUnclaimedLocalVault();
      expect(result).toBeNull();
    });
  });

  describe('Vault Claim — unwrap and storage side effects', () => {
    test('12: successful unlockWithPassphrase writes owned record under user key', async () => {
      // Setup: unclaimed vault in unsuffixed slot
      const unclaimed = createTestVault();
      localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(unclaimed));

      // Setup: mocks for successful unwrap
      const sentinelKeyBytes = new Uint8Array(32).fill(0x11);
      const sentinelWrappingKey = { type: 'secret' } as unknown as CryptoKey;
      const sentinelMasterKey = { type: 'secret' } as unknown as CryptoKey;

      (deriveKeyFromPassphrase as jest.Mock).mockResolvedValue(
        sentinelWrappingKey,
      );
      (aesGcmDecrypt as jest.Mock).mockResolvedValue(sentinelKeyBytes);
      (importAesGcmKey as jest.Mock).mockResolvedValue(sentinelMasterKey);

      // Act: create handle and unlock
      const handle = createVaultHandle({ owner: 'user-a' });
      const result = await handle.unlockWithPassphrase({
        passphrase: 'test-pass',
      });

      // Assert: master key bytes returned
      expect(result.masterKeyBytes).toBe(sentinelKeyBytes);

      // Assert: record written under user-a's key
      const stored = localStorage.getItem(localVaultStorageKey('user-a'));
      expect(stored).not.toBeNull();
      if (stored !== null) {
        const record = JSON.parse(stored);
        expect(record.version).toBe(LOCAL_VAULT_RECORD_VERSION);
        expect(record.owner).toBe('user-a');
        expect(record.vault).toEqual(unclaimed);
      }
    });

    test('13: claim leaves unsuffixed slot byte-identical after successful unlock', async () => {
      // Setup: unclaimed vault in unsuffixed slot
      const unclaimed = createTestVault();
      localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(unclaimed));
      const beforeRaw = localStorage.getItem(VAULT_STORAGE_KEY);
      expect(beforeRaw).not.toBeNull();

      // Setup: mocks for successful unwrap
      const sentinelKeyBytes = new Uint8Array(32).fill(0x11);
      const sentinelWrappingKey = { type: 'secret' } as unknown as CryptoKey;
      const sentinelMasterKey = { type: 'secret' } as unknown as CryptoKey;

      (deriveKeyFromPassphrase as jest.Mock).mockResolvedValue(
        sentinelWrappingKey,
      );
      (aesGcmDecrypt as jest.Mock).mockResolvedValue(sentinelKeyBytes);
      (importAesGcmKey as jest.Mock).mockResolvedValue(sentinelMasterKey);

      // Act: create handle and unlock
      const handle = createVaultHandle({ owner: 'user-a' });
      await handle.unlockWithPassphrase({ passphrase: 'test-pass' });

      // Assert: unsuffixed slot byte-identical
      const afterRaw = localStorage.getItem(VAULT_STORAGE_KEY);
      expect(afterRaw).toBe(beforeRaw);
    });

    test('14: failed unwrap with passphrase (decrypt rejection) leaves storage untouched and throws VaultSecretMismatchError', async () => {
      // Setup: unclaimed vault in unsuffixed slot
      const unclaimed = createTestVault();
      localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(unclaimed));
      const beforeRaw = localStorage.getItem(VAULT_STORAGE_KEY);
      expect(beforeRaw).not.toBeNull();

      // Setup: mocks for failed unwrap — derive succeeds, but decrypt fails
      const sentinelWrappingKey = { type: 'secret' } as unknown as CryptoKey;
      (deriveKeyFromPassphrase as jest.Mock).mockResolvedValue(
        sentinelWrappingKey,
      );
      (aesGcmDecrypt as jest.Mock).mockRejectedValue(
        new Error('Decrypt failed'),
      );
      (importAesGcmKey as jest.Mock).mockResolvedValue({
        type: 'secret',
      } as unknown as CryptoKey);

      // Act: unlock throws VaultSecretMismatchError (single invocation)
      const handle = createVaultHandle({ owner: 'user-a' });
      let thrownError: unknown;
      try {
        await handle.unlockWithPassphrase({ passphrase: 'wrong' });
      } catch (err) {
        thrownError = err;
      }

      // Assert: correct error details
      expect(thrownError).toBeInstanceOf(VaultSecretMismatchError);
      if (thrownError instanceof VaultSecretMismatchError) {
        expect(thrownError.code).toBe('vault-secret-mismatch');
        expect(thrownError.secret).toBe('passphrase');
      }

      // Assert: unsuffixed slot unchanged
      const afterRaw = localStorage.getItem(VAULT_STORAGE_KEY);
      expect(afterRaw).toBe(beforeRaw);

      // Assert: user key not written
      expect(localStorage.getItem(localVaultStorageKey('user-a'))).toBeNull();
    });

    test('15: failed unwrap with recovery-key (decrypt rejection) leaves storage untouched and throws VaultSecretMismatchError', async () => {
      // Setup: unclaimed vault in unsuffixed slot
      const unclaimed = createTestVault();
      localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(unclaimed));
      const beforeRaw = localStorage.getItem(VAULT_STORAGE_KEY);
      expect(beforeRaw).not.toBeNull();

      // Setup: mocks for failed unwrap — import succeeds, but decrypt fails
      const sentinelRecoveryKey = { type: 'secret' } as unknown as CryptoKey;
      (importAesGcmKey as jest.Mock).mockResolvedValue(sentinelRecoveryKey);
      (aesGcmDecrypt as jest.Mock).mockRejectedValue(
        new Error('Decrypt failed'),
      );

      // Act: unlock throws VaultSecretMismatchError (single invocation)
      const handle = createVaultHandle({ owner: 'user-a' });
      let thrownError: unknown;
      try {
        await handle.unlockWithRecoveryKey({ recoveryKey: 'valid-format-key' });
      } catch (err) {
        thrownError = err;
      }

      // Assert: correct error details
      expect(thrownError).toBeInstanceOf(VaultSecretMismatchError);
      if (thrownError instanceof VaultSecretMismatchError) {
        expect(thrownError.code).toBe('vault-secret-mismatch');
        expect(thrownError.secret).toBe('recovery-key');
      }

      // Assert: unsuffixed slot unchanged
      const afterRaw = localStorage.getItem(VAULT_STORAGE_KEY);
      expect(afterRaw).toBe(beforeRaw);

      // Assert: user key not written
      expect(localStorage.getItem(localVaultStorageKey('user-a'))).toBeNull();
    });

    test('15b: failed import guard for recovery-key leaves storage untouched and throws VaultSecretMismatchError', async () => {
      // Setup: unclaimed vault in unsuffixed slot
      const unclaimed = createTestVault();
      localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(unclaimed));
      const beforeRaw = localStorage.getItem(VAULT_STORAGE_KEY);
      expect(beforeRaw).not.toBeNull();

      // Setup: mocks for failed import of malformed recovery key (pre-flight guard)
      (importAesGcmKey as jest.Mock).mockRejectedValue(
        new Error('Invalid recovery key format'),
      );

      // Act: unlock throws VaultSecretMismatchError (single invocation)
      const handle = createVaultHandle({ owner: 'user-a' });
      let thrownError: unknown;
      try {
        await handle.unlockWithRecoveryKey({
          recoveryKey: 'invalid-format-key',
        });
      } catch (err) {
        thrownError = err;
      }

      // Assert: correct error details
      expect(thrownError).toBeInstanceOf(VaultSecretMismatchError);
      if (thrownError instanceof VaultSecretMismatchError) {
        expect(thrownError.code).toBe('vault-secret-mismatch');
        expect(thrownError.secret).toBe('recovery-key');
      }

      // Assert: unsuffixed slot unchanged
      const afterRaw = localStorage.getItem(VAULT_STORAGE_KEY);
      expect(afterRaw).toBe(beforeRaw);

      // Assert: user key not written
      expect(localStorage.getItem(localVaultStorageKey('user-a'))).toBeNull();
    });

    test('16: after claim by user-a, unclaimed still available to user-c, but user-a sees owned', async () => {
      // Setup: unclaimed vault in unsuffixed slot
      const unclaimed = createTestVault();
      localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(unclaimed));

      // Setup: mocks for successful unwrap
      const sentinelKeyBytes = new Uint8Array(32).fill(0x11);
      const sentinelWrappingKey = { type: 'secret' } as unknown as CryptoKey;
      const sentinelMasterKey = { type: 'secret' } as unknown as CryptoKey;

      (deriveKeyFromPassphrase as jest.Mock).mockResolvedValue(
        sentinelWrappingKey,
      );
      (aesGcmDecrypt as jest.Mock).mockResolvedValue(sentinelKeyBytes);
      (importAesGcmKey as jest.Mock).mockResolvedValue(sentinelMasterKey);

      // Act: user-a claims
      const handleA = createVaultHandle({ owner: 'user-a' });
      await handleA.unlockWithPassphrase({ passphrase: 'test-pass' });

      // Assert: user-c still sees unclaimed
      const resultC = resolveLocalVault('user-c');
      expect(resultC.status).toBe('unclaimed');

      // Assert: user-a sees owned
      const resultA = resolveLocalVault('user-a');
      expect(resultA.status).toBe('owned');
    });

    describe('Claim invariant: write follows read; no claim without unwrap', () => {
      test('17: ownedLocalVaultSlot.write to unclaimed vault updates unsuffixed slot, creates no per-User record', () => {
        // Setup: only unsuffixed slot populated, no per-User record
        const unclaimed = createTestVault();
        localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(unclaimed));
        const unclaimedBefore = localStorage.getItem(VAULT_STORAGE_KEY);
        expect(localStorage.getItem(localVaultStorageKey('user-a'))).toBeNull();

        // Act: write via slot
        const slot = ownedLocalVaultSlot('user-a');
        const updated = createTestVault({
          kdf: { ...createTestVault().kdf, iterations: 200_000 },
        });
        slot.write(updated);

        // Assert: unsuffixed slot was updated (changed)
        const unclaimedAfter = localStorage.getItem(VAULT_STORAGE_KEY);
        expect(unclaimedAfter).not.toBe(unclaimedBefore);
        if (unclaimedAfter !== null) {
          expect(JSON.parse(unclaimedAfter)).toEqual(updated);
        }

        // Assert: per-User record was NOT created
        expect(localStorage.getItem(localVaultStorageKey('user-a'))).toBeNull();
      });

      test('18: saveEncryptedData through handle on unclaimed vault writes to unsuffixed, creates no per-User record', async () => {
        // Setup: initialize with unclaimed vault, get mocked crypto working
        const unclaimed = createTestVault();
        localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(unclaimed));

        const sentinelKeyBytes = new Uint8Array(32).fill(0x11);
        const sentinelMasterKey = { type: 'secret' } as unknown as CryptoKey;

        (importAesGcmKey as jest.Mock).mockResolvedValue(sentinelMasterKey);
        (aesGcmEncrypt as jest.Mock).mockResolvedValue(
          new Uint8Array([0x99, 0xaa, 0xbb]),
        );

        // Act: call saveEncryptedData on a locked handle with masterKeyBytes
        const handle = createVaultHandle({
          owner: 'user-a',
          masterKeyBytes: sentinelKeyBytes,
        });
        await handle.saveEncryptedData({
          type: 'tasks',
          value: [{ id: '1', title: 'Task' }],
        });

        // Assert: unsuffixed slot was updated
        const stored = localStorage.getItem(VAULT_STORAGE_KEY);
        expect(stored).not.toBeNull();
        if (stored !== null) {
          const storedVault = JSON.parse(stored);
          expect(storedVault.data?.tasks).toBeDefined();
        }

        // Assert: per-User record was NOT created
        expect(localStorage.getItem(localVaultStorageKey('user-a'))).toBeNull();
      });

      test('19: after claim via unlockWithPassphrase, subsequent writes go to owned record and unsuffixed stops changing', async () => {
        // Setup: unclaimed vault in unsuffixed slot
        const unclaimed = createTestVault();
        localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(unclaimed));
        const unclaimedBeforeClaim = localStorage.getItem(VAULT_STORAGE_KEY);

        // Setup: mocks for successful unwrap
        const sentinelKeyBytes = new Uint8Array(32).fill(0x11);
        const sentinelWrappingKey = { type: 'secret' } as unknown as CryptoKey;
        const sentinelMasterKey = { type: 'secret' } as unknown as CryptoKey;

        (deriveKeyFromPassphrase as jest.Mock).mockResolvedValue(
          sentinelWrappingKey,
        );
        (aesGcmDecrypt as jest.Mock).mockResolvedValue(sentinelKeyBytes);
        (importAesGcmKey as jest.Mock).mockResolvedValue(sentinelMasterKey);
        (aesGcmEncrypt as jest.Mock).mockResolvedValue(
          new Uint8Array([0xcc, 0xdd]),
        );

        // Act: claim via unlock
        const handle = createVaultHandle({ owner: 'user-a' });
        await handle.unlockWithPassphrase({ passphrase: 'test-pass' });

        // Assert: per-User record was created by claim
        const userRecordAfterClaim = localStorage.getItem(
          localVaultStorageKey('user-a'),
        );
        expect(userRecordAfterClaim).not.toBeNull();
        if (userRecordAfterClaim !== null) {
          const recordAfterClaim = JSON.parse(userRecordAfterClaim);
          expect(recordAfterClaim.owner).toBe('user-a');
        }

        // Assert: unsuffixed slot unchanged at claim
        const unclaimedAfterClaim = localStorage.getItem(VAULT_STORAGE_KEY);
        expect(unclaimedAfterClaim).toBe(unclaimedBeforeClaim);

        // Act: write new data to owned record
        await handle.saveEncryptedData({
          type: 'todos',
          value: [{ id: 'a', text: 'Todo A' }],
        });

        // Assert: per-User record was updated
        const userRecordStr = localStorage.getItem(
          localVaultStorageKey('user-a'),
        );
        expect(userRecordStr).not.toBeNull();
        if (userRecordStr !== null) {
          const userRecordAfterWrite = JSON.parse(userRecordStr);
          expect(userRecordAfterWrite.vault.data?.todos).toBeDefined();
        }

        // Assert: unsuffixed slot unchanged since claim (no new writes there)
        const unclaimedAfterWrite = localStorage.getItem(VAULT_STORAGE_KEY);
        expect(unclaimedAfterWrite).toBe(unclaimedBeforeClaim);
      });
    });
  });

  describe('ownedLocalVaultSlot — slot interface and claim binding', () => {
    test('slot.read() returns the same result as resolveLocalVault for the bound owner', () => {
      const vault = createTestVault();
      writeOwnedLocalVault({ owner: 'user-a', vault });

      const slot = ownedLocalVaultSlot('user-a');
      const slotResult = slot.read();
      const directResult = resolveLocalVault('user-a');

      expect(slotResult).toEqual(directResult);
    });

    test('slot.write() writes the vault as owned by the bound owner', () => {
      const vault = createTestVault();

      const slot = ownedLocalVaultSlot('user-a');
      slot.write(vault);

      const result = resolveLocalVault('user-a');
      expect(result.status).toBe('owned');
      if (result.status === 'owned') {
        expect(result.vault).toEqual(vault);
      }
    });

    test('slot.claim() with owned entry does nothing (idempotent)', () => {
      const vault1 = createTestVault();
      writeOwnedLocalVault({ owner: 'user-a', vault: vault1 });

      const slot = ownedLocalVaultSlot('user-a');
      const vault2 = createTestVault({
        kdf: { ...createTestVault().kdf, iterations: 200_000 },
      });
      slot.claim(vault2);

      // vault2 should replace vault1 (claim calls write)
      const result = resolveLocalVault('user-a');
      expect(result.status).toBe('owned');
      if (result.status === 'owned') {
        expect(result.vault).toEqual(vault2);
      }
    });
  });
});
