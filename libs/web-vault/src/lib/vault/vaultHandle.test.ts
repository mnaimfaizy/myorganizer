/**
 * Tests for the owner-bound Vault Handle — the only supported way to reach a Local Vault.
 *
 * ADR 0047 asserts that vault access requires an owner at construction time.
 * These tests verify that the handle enforces owner binding, exposes the correct
 * API surface, and delegates correctly to the underlying access layer while
 * keeping storage mutations observable.
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

// === Crypto mocking ===
// Mock all WebCrypto operations; keep pure helpers real for JSON round-tripping.

let mockRandomBytesCounter = 0;

jest.mock('./crypto', () => {
  const actual = jest.requireActual('./crypto');
  return {
    ...actual,
    randomBytes: jest.fn((length: number): Uint8Array => {
      const bytes = new Uint8Array(length);
      // Deterministic but call-specific: each call gets a different seed.
      const seed = mockRandomBytesCounter++;
      for (let i = 0; i < length; i++) {
        bytes[i] = (seed + i) % 256;
      }
      return bytes;
    }),
    deriveKeyFromPassphrase: jest.fn(
      async (): Promise<CryptoKey> =>
        ({
          type: 'secret',
          extractable: false,
          algorithm: { name: 'PBKDF2' },
          usages: ['encrypt', 'decrypt'],
          __mockKey: 'derived-from-passphrase',
        }) as unknown as CryptoKey,
    ),
    importAesGcmKey: jest.fn(async (rawKey: Uint8Array): Promise<CryptoKey> => {
      if (!rawKey || !(rawKey instanceof Uint8Array)) {
        throw new Error('Invalid key material');
      }
      return {
        type: 'secret',
        extractable: false,
        algorithm: { name: 'AES-GCM' },
        usages: ['encrypt', 'decrypt'],
        __mockKey: `imported-${rawKey[0]}-${rawKey[rawKey.length - 1]}`,
      } as unknown as CryptoKey;
    }),
    aesGcmEncrypt: jest.fn(
      async (options: {
        key: CryptoKey;
        plaintext: Uint8Array;
        iv: Uint8Array;
      }): Promise<Uint8Array> => {
        // Return deterministic ciphertext: plaintext + padding based on key identity
        const keyObj = options.key as unknown as { __mockKey?: string };
        const keyMarker = keyObj.__mockKey || 'unknown';
        // Hash the key marker string to get a single byte for padding.
        let keyByte = 0xff;
        for (let i = 0; i < keyMarker.length; i++) {
          keyByte = (keyByte + keyMarker.charCodeAt(i)) & 0xff;
        }
        const padLength = Math.max(0, options.plaintext.length);
        const padding = new Uint8Array(padLength).fill(keyByte);
        return new Uint8Array([...options.plaintext, ...padding]);
      },
    ),
    aesGcmDecrypt: jest.fn(
      async (options: {
        key: CryptoKey;
        ciphertext: Uint8Array;
        iv: Uint8Array;
      }): Promise<Uint8Array> => {
        // Invert the encryption: the first half is plaintext, second half is padding.
        const plaintextLength = options.ciphertext.length / 2;
        if (
          plaintextLength <= 0 ||
          plaintextLength > options.ciphertext.length
        ) {
          throw new Error('Invalid ciphertext length');
        }
        return options.ciphertext.slice(0, plaintextLength);
      },
    ),
  };
});

import type { VaultStorageV1 } from './localVaultStorage';
import { localVaultStorageKey } from './localVaultStorage';
import * as vaultHandleModule from './vaultHandle';
import {
  createVaultHandle,
  VaultLockedError,
  VaultSecretMismatchError,
} from './vaultHandle';

// === Storage setup ===

const LS_KEY_USER_A = localVaultStorageKey('user-a');
const LS_KEY_USER_B = localVaultStorageKey('user-b');

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  mockRandomBytesCounter = 0;
});

// === Tests ===

describe('createVaultHandle (owner-bound Vault Handle)', () => {
  // Test 1: Construction and binding
  describe('Construction and binding', () => {
    test('createVaultHandle({owner:"user-a"}) exposes owner and starts locked', () => {
      const handle = createVaultHandle({ owner: 'user-a' });

      expect(handle.owner).toBe('user-a');
      expect(handle.isUnlocked).toBe(false);
    });

    test('createVaultHandle({owner, masterKeyBytes}) starts unlocked', () => {
      const masterKeyBytes = new Uint8Array([1, 2, 3, 4]);
      const handle = createVaultHandle({
        owner: 'user-a',
        masterKeyBytes,
      });

      expect(handle.owner).toBe('user-a');
      expect(handle.isUnlocked).toBe(true);
    });

    // Test 2: Owner validation
    test('createVaultHandle({owner:""}) throws', () => {
      expect(() => createVaultHandle({ owner: '' })).toThrow(
        'A Local Vault cannot be resolved without an owner',
      );
    });

    test('createVaultHandle({owner:"  "}) (whitespace only) throws', () => {
      expect(() => createVaultHandle({ owner: '  ' })).toThrow(
        'A Local Vault cannot be resolved without an owner',
      );
    });
  });

  // Test 3: Load / save / presence
  describe('Load, save, and presence', () => {
    test('hasVault() is true when owner holds owned record', () => {
      const handle = createVaultHandle({ owner: 'user-a' });

      // Pre-populate with an owned record.
      const vault: VaultStorageV1 = {
        version: 1,
        kdf: {
          name: 'PBKDF2',
          hash: 'SHA-256',
          iterations: 310000,
          salt: 'c2FsdA==',
        },
        masterKeyWrappedWithPassphrase: {
          iv: 'cGFzc3BocmFzZS1pdg==',
          ciphertext: 'cGFzc3BocmFzZS1jdA==',
        },
        masterKeyWrappedWithRecoveryKey: {
          iv: 'cmVjb3ZlcnktaXY=',
          ciphertext: 'cmVjb3ZlcnktY3Q=',
        },
        data: {},
      };
      localStorage.setItem(
        LS_KEY_USER_A,
        JSON.stringify({
          version: 2,
          owner: 'user-a',
          vault,
        }),
      );

      expect(handle.hasVault()).toBe(true);
    });

    test('hasVault() is true when owner has no record but unclaimed slot populated', () => {
      const handle = createVaultHandle({ owner: 'user-a' });

      // Pre-populate unclaimed (unsuffixed) slot.
      const unclaimedVault: VaultStorageV1 = {
        version: 1,
        kdf: {
          name: 'PBKDF2',
          hash: 'SHA-256',
          iterations: 310000,
          salt: 'c2FsdA==',
        },
        masterKeyWrappedWithPassphrase: {
          iv: 'cGFzc3BocmFzZS1pdg==',
          ciphertext: 'cGFzc3BocmFzZS1jdA==',
        },
        masterKeyWrappedWithRecoveryKey: {
          iv: 'cmVjb3ZlcnktaXY=',
          ciphertext: 'cmVjb3ZlcnktY3Q=',
        },
        data: {},
      };
      localStorage.setItem(
        'myorganizer_vault_v1',
        JSON.stringify(unclaimedVault),
      );

      expect(handle.hasVault()).toBe(true);
    });

    test('hasVault() is false when neither owner nor unclaimed exists', () => {
      const handle = createVaultHandle({ owner: 'user-a' });

      expect(handle.hasVault()).toBe(false);
    });

    test("loadVault() returns the owner's own vault", () => {
      const handle = createVaultHandle({ owner: 'user-a' });

      const vault: VaultStorageV1 = {
        version: 1,
        kdf: {
          name: 'PBKDF2',
          hash: 'SHA-256',
          iterations: 310000,
          salt: 'c2FsdA==',
        },
        masterKeyWrappedWithPassphrase: {
          iv: 'cGFzc3BocmFzZS1pdg==',
          ciphertext: 'cGFzc3BocmFzZS1jdA==',
        },
        masterKeyWrappedWithRecoveryKey: {
          iv: 'cmVjb3ZlcnktaXY=',
          ciphertext: 'cmVjb3ZlcnktY3Q=',
        },
        data: {},
      };
      localStorage.setItem(
        LS_KEY_USER_A,
        JSON.stringify({
          version: 2,
          owner: 'user-a',
          vault,
        }),
      );

      const loaded = handle.loadVault();
      expect(loaded).toEqual(vault);
    });

    test('loadVault() returns null when entry under owner key names different owner', () => {
      const handle = createVaultHandle({ owner: 'user-a' });

      // Write a record that names a different owner.
      const vault: VaultStorageV1 = {
        version: 1,
        kdf: {
          name: 'PBKDF2',
          hash: 'SHA-256',
          iterations: 310000,
          salt: 'c2FsdA==',
        },
        masterKeyWrappedWithPassphrase: {
          iv: 'cGFzc3BocmFzZS1pdg==',
          ciphertext: 'cGFzc3BocmFzZS1jdA==',
        },
        masterKeyWrappedWithRecoveryKey: {
          iv: 'cmVjb3ZlcnktaXY=',
          ciphertext: 'cmVjb3ZlcnktY3Q=',
        },
        data: {},
      };
      localStorage.setItem(
        LS_KEY_USER_A,
        JSON.stringify({
          version: 2,
          owner: 'user-b', // Wrong owner!
          vault,
        }),
      );

      expect(handle.loadVault()).toBeNull();
    });

    test('saveVault(vault) writes under owner key as LOCAL_VAULT_RECORD_VERSION', () => {
      const handle = createVaultHandle({ owner: 'user-a' });

      const vault: VaultStorageV1 = {
        version: 1,
        kdf: {
          name: 'PBKDF2',
          hash: 'SHA-256',
          iterations: 310000,
          salt: 'c2FsdA==',
        },
        masterKeyWrappedWithPassphrase: {
          iv: 'cGFzc3BocmFzZS1pdg==',
          ciphertext: 'cGFzc3BocmFzZS1jdA==',
        },
        masterKeyWrappedWithRecoveryKey: {
          iv: 'cmVjb3ZlcnktaXY=',
          ciphertext: 'cmVjb3ZlcnktY3Q=',
        },
        data: {},
      };
      handle.saveVault(vault);

      const stored = JSON.parse(
        localStorage.getItem(LS_KEY_USER_A) || '{}',
      ) as {
        version: number;
        owner: string;
        vault: VaultStorageV1;
      };
      expect(stored.version).toBe(2); // LOCAL_VAULT_RECORD_VERSION
      expect(stored.owner).toBe('user-a');
      expect(stored.vault).toEqual(vault);

      // Ensure unsuffixed slot was not touched.
      expect(localStorage.getItem('myorganizer_vault_v1')).toBeNull();
    });

    // Test 6: Isolation
    test('Two handles for different owners read and write independent records', () => {
      const handleA = createVaultHandle({ owner: 'user-a' });
      const handleB = createVaultHandle({ owner: 'user-b' });

      const vaultA: VaultStorageV1 = {
        version: 1,
        kdf: {
          name: 'PBKDF2',
          hash: 'SHA-256',
          iterations: 310000,
          salt: 'c2FsdA==',
        },
        masterKeyWrappedWithPassphrase: {
          iv: 'aS1h',
          ciphertext: 'Y3QtYQ==',
        },
        masterKeyWrappedWithRecoveryKey: {
          iv: 'aS1h',
          ciphertext: 'Y3QtYQ==',
        },
        data: { addresses: { iv: 'aXY=', ciphertext: 'Y3Q=' } },
      };

      const vaultB: VaultStorageV1 = {
        version: 1,
        kdf: {
          name: 'PBKDF2',
          hash: 'SHA-256',
          iterations: 310000,
          salt: 'c2FsdA==',
        },
        masterKeyWrappedWithPassphrase: {
          iv: 'aS1i',
          ciphertext: 'Y3QtYg==',
        },
        masterKeyWrappedWithRecoveryKey: {
          iv: 'aS1i',
          ciphertext: 'Y3QtYg==',
        },
        data: { todos: { iv: 'aXY=', ciphertext: 'Y3Q=' } },
      };

      handleA.saveVault(vaultA);
      handleB.saveVault(vaultB);

      // Each handle reads only its own vault.
      expect(handleA.loadVault()).toEqual(vaultA);
      expect(handleB.loadVault()).toEqual(vaultB);

      // Ensure they are stored under different keys.
      expect(localStorage.getItem(LS_KEY_USER_A)).not.toBeNull();
      expect(localStorage.getItem(LS_KEY_USER_B)).not.toBeNull();
      expect(
        JSON.parse(localStorage.getItem(LS_KEY_USER_A) || '{}'),
      ).toHaveProperty('owner', 'user-a');
      expect(
        JSON.parse(localStorage.getItem(LS_KEY_USER_B) || '{}'),
      ).toHaveProperty('owner', 'user-b');
    });
  });

  // Test 7: Initialize
  describe('Initialize', () => {
    test('initialize({passphrase}) resolves with recoveryKey and persists vault version 1 record', async () => {
      const handle = createVaultHandle({ owner: 'user-a' });

      const result = await handle.initialize({ passphrase: 'test-pass' });

      expect(typeof result.recoveryKey).toBe('string');
      expect(result.recoveryKey.length).toBeGreaterThan(0);

      // Check persisted vault structure.
      const stored = JSON.parse(
        localStorage.getItem(LS_KEY_USER_A) || '{}',
      ) as {
        version: number;
        owner: string;
        vault: VaultStorageV1;
      };

      expect(stored.vault.version).toBe(1);
      expect(stored.vault.kdf.name).toBe('PBKDF2');
      expect(stored.vault.kdf.hash).toBe('SHA-256');
      // Read iterations from persisted record to avoid hardcoding.
      expect(stored.vault.kdf.iterations).toBeGreaterThan(0);
      expect(typeof stored.vault.kdf.iterations).toBe('number');
      expect(typeof stored.vault.kdf.salt).toBe('string');
      expect(stored.vault.kdf.salt.length).toBeGreaterThan(0);
      expect(stored.vault.masterKeyWrappedWithPassphrase).toHaveProperty('iv');
      expect(stored.vault.masterKeyWrappedWithPassphrase).toHaveProperty(
        'ciphertext',
      );
      expect(stored.vault.masterKeyWrappedWithRecoveryKey).toHaveProperty('iv');
      expect(stored.vault.masterKeyWrappedWithRecoveryKey).toHaveProperty(
        'ciphertext',
      );
      expect(stored.vault.data).toEqual({});
    });

    // Test 8: Initialize wrapping behavior
    test('initialize wraps the same Master Key twice (passphrase and recovery)', async () => {
      const handle = createVaultHandle({ owner: 'user-a' });

      const { aesGcmEncrypt } = require('./crypto');
      aesGcmEncrypt.mockClear();

      await handle.initialize({ passphrase: 'test-pass' });

      // aesGcmEncrypt should be called exactly twice (passphrase and recovery wraps).
      expect(aesGcmEncrypt).toHaveBeenCalledTimes(2);

      // Both calls should have the same plaintext (the Master Key).
      const call1Plaintext = aesGcmEncrypt.mock.calls[0][0].plaintext;
      const call2Plaintext = aesGcmEncrypt.mock.calls[1][0].plaintext;

      expect(call1Plaintext).toEqual(call2Plaintext);
    });
  });

  // Test 9-11: Unlock
  describe('Unlock operations', () => {
    // Pre-initialize a vault for unlock tests.
    async function createInitializedVault(owner: string) {
      const handle = createVaultHandle({ owner });
      const { recoveryKey } = await handle.initialize({
        passphrase: 'test-pass',
      });
      return { handle, recoveryKey };
    }

    test('unlockWithPassphrase({passphrase}) on unlocked vault resolves with masterKeyBytes and flips isUnlocked', async () => {
      await createInitializedVault('user-a');

      const handle = createVaultHandle({ owner: 'user-a' });
      expect(handle.isUnlocked).toBe(false);

      const result = await handle.unlockWithPassphrase({
        passphrase: 'test-pass',
      });

      expect(result.masterKeyBytes).toBeInstanceOf(Uint8Array);
      expect(handle.isUnlocked).toBe(true);
    });

    test('unlockWithPassphrase when owner holds no vault and unclaimed is empty rejects', async () => {
      const handle = createVaultHandle({ owner: 'user-a' });

      await expect(
        handle.unlockWithPassphrase({ passphrase: 'test-pass' }),
      ).rejects.toThrow('Vault is not initialized');
    });

    test('unlockWithRecoveryKey({recoveryKey}) resolves and binds key like passphrase', async () => {
      const { recoveryKey } = await createInitializedVault('user-a');

      const handleForUnlock = createVaultHandle({ owner: 'user-a' });
      expect(handleForUnlock.isUnlocked).toBe(false);

      const result = await handleForUnlock.unlockWithRecoveryKey({
        recoveryKey,
      });

      expect(result.masterKeyBytes).toBeInstanceOf(Uint8Array);
      expect(handleForUnlock.isUnlocked).toBe(true);
    });

    // Test error paths: VaultSecretMismatchError when unwrap fails
    test('unlockWithPassphrase rejects with VaultSecretMismatchError when aesGcmDecrypt fails', async () => {
      await createInitializedVault('user-a');

      const handle = createVaultHandle({ owner: 'user-a' });

      // Make aesGcmDecrypt reject for this test only
      const { aesGcmDecrypt } = require('./crypto');
      aesGcmDecrypt.mockRejectedValueOnce(new Error('Decryption failed'));

      let caught: VaultSecretMismatchError | null = null;
      try {
        await handle.unlockWithPassphrase({ passphrase: 'test-pass' });
      } catch (e) {
        caught = e as VaultSecretMismatchError;
      }

      expect(caught).toBeInstanceOf(VaultSecretMismatchError);
      expect(caught?.secret).toBe('passphrase');
      expect(caught?.code).toBe('vault-secret-mismatch');

      // Handle should still be locked
      expect(handle.isUnlocked).toBe(false);

      // Vault record should still exist
      expect(localStorage.getItem(LS_KEY_USER_A)).not.toBeNull();
    });

    test('unlockWithRecoveryKey rejects with VaultSecretMismatchError when aesGcmDecrypt fails', async () => {
      const { recoveryKey } = await createInitializedVault('user-a');

      const handle = createVaultHandle({ owner: 'user-a' });

      // Make aesGcmDecrypt reject for this test only
      const { aesGcmDecrypt } = require('./crypto');
      aesGcmDecrypt.mockRejectedValueOnce(new Error('Decryption failed'));

      let caught: VaultSecretMismatchError | null = null;
      try {
        await handle.unlockWithRecoveryKey({ recoveryKey });
      } catch (e) {
        caught = e as VaultSecretMismatchError;
      }

      expect(caught).toBeInstanceOf(VaultSecretMismatchError);
      expect(caught?.secret).toBe('recovery-key');
      expect(caught?.code).toBe('vault-secret-mismatch');

      // Handle should still be locked
      expect(handle.isUnlocked).toBe(false);
    });

    test('unlockWithRecoveryKey rejects with VaultSecretMismatchError when importAesGcmKey fails', async () => {
      const { recoveryKey } = await createInitializedVault('user-a');

      const handle = createVaultHandle({ owner: 'user-a' });

      // Make importAesGcmKey reject for this test only
      const { importAesGcmKey } = require('./crypto');
      importAesGcmKey.mockRejectedValueOnce(new Error('Invalid key material'));

      let caught: VaultSecretMismatchError | null = null;
      try {
        await handle.unlockWithRecoveryKey({ recoveryKey });
      } catch (e) {
        caught = e as VaultSecretMismatchError;
      }

      expect(caught).toBeInstanceOf(VaultSecretMismatchError);
      expect(caught?.secret).toBe('recovery-key');
      expect(caught?.code).toBe('vault-secret-mismatch');

      // Handle should still be locked
      expect(handle.isUnlocked).toBe(false);
    });
  });

  // Test 12-13: Passphrase change
  describe('Change passphrase', () => {
    async function createInitializedVaultForPassphraseChange(owner: string) {
      const handle = createVaultHandle({ owner });
      await handle.initialize({ passphrase: 'old-pass' });
      return handle;
    }

    test('changePassphrase on locked handle rejects with VaultLockedError', async () => {
      await createInitializedVaultForPassphraseChange('user-a');

      const handle = createVaultHandle({ owner: 'user-a' });
      // Handle is locked.

      await expect(
        handle.changePassphrase({ newPassphrase: 'new-pass' }),
      ).rejects.toThrow(VaultLockedError);
    });

    test('changePassphrase on unlocked handle rewraps passphrase, leaves recovery and data unchanged', async () => {
      const initialHandle =
        await createInitializedVaultForPassphraseChange('user-a');
      await initialHandle.unlockWithPassphrase({ passphrase: 'old-pass' });

      const vaultBefore = initialHandle.loadVault();
      const recoveryWrapBefore = vaultBefore?.masterKeyWrappedWithRecoveryKey;
      const dataBefore = vaultBefore?.data;

      await initialHandle.changePassphrase({ newPassphrase: 'new-pass' });

      const vaultAfter = initialHandle.loadVault();
      const recoveryWrapAfter = vaultAfter?.masterKeyWrappedWithRecoveryKey;
      const dataAfter = vaultAfter?.data;

      // Passphrase wrap should change.
      expect(vaultAfter?.masterKeyWrappedWithPassphrase).not.toEqual(
        vaultBefore?.masterKeyWrappedWithPassphrase,
      );

      // Recovery wrap should remain unchanged.
      expect(recoveryWrapAfter).toEqual(recoveryWrapBefore);

      // Data should remain unchanged.
      expect(dataAfter).toEqual(dataBefore);
    });
  });

  // Test 14-15: Decrypted read / write
  describe('Decrypted read/write', () => {
    async function createInitializedUnlockedVaultForReadWrite(owner: string) {
      const handle = createVaultHandle({ owner });
      await handle.initialize({ passphrase: 'test-pass' });
      await handle.unlockWithPassphrase({ passphrase: 'test-pass' });
      return handle;
    }

    test('loadDecryptedData on locked handle rejects with VaultLockedError', async () => {
      await createInitializedUnlockedVaultForReadWrite('user-a');

      const handle = createVaultHandle({ owner: 'user-a' });

      await expect(
        handle.loadDecryptedData({
          type: 'tasks',
          defaultValue: [],
        }),
      ).rejects.toThrow(VaultLockedError);
    });

    test('loadDecryptedData returns defaultValue when owner holds no vault', async () => {
      const handle = createVaultHandle({ owner: 'user-a' });
      await handle.initialize({ passphrase: 'test-pass' });
      await handle.unlockWithPassphrase({ passphrase: 'test-pass' });

      // Now delete the vault from storage to simulate "no vault".
      localStorage.removeItem(LS_KEY_USER_A);

      const result = await handle.loadDecryptedData({
        type: 'tasks',
        defaultValue: [],
      });
      expect(result).toEqual([]);
    });

    test('loadDecryptedData returns defaultValue when vault holds no blob for type', async () => {
      const handle = await createInitializedUnlockedVaultForReadWrite('user-a');

      const result = await handle.loadDecryptedData({
        type: 'tasks',
        defaultValue: [],
      });
      expect(result).toEqual([]);
    });

    test('loadDecryptedData returns decrypted value when blob exists', async () => {
      const handle = await createInitializedUnlockedVaultForReadWrite('user-a');

      const taskValue = [
        { id: '1', title: 'Buy milk' },
        { id: '2', title: 'Pay bills' },
      ];
      await handle.saveEncryptedData({
        type: 'tasks',
        value: taskValue,
      });

      const loaded = await handle.loadDecryptedData({
        type: 'tasks',
        defaultValue: [],
      });
      expect(loaded).toEqual(taskValue);
    });

    test('saveEncryptedData on locked handle rejects with VaultLockedError', async () => {
      await createInitializedUnlockedVaultForReadWrite('user-a');

      const handle = createVaultHandle({ owner: 'user-a' });

      await expect(
        handle.saveEncryptedData({
          type: 'tasks',
          value: [],
        }),
      ).rejects.toThrow(VaultLockedError);
    });

    test('saveEncryptedData when vault absent rejects', async () => {
      const handle = createVaultHandle({
        owner: 'user-a',
        masterKeyBytes: new Uint8Array([1, 2, 3, 4]),
      });

      await expect(
        handle.saveEncryptedData({
          type: 'tasks',
          value: [],
        }),
      ).rejects.toThrow('Vault is not initialized');
    });

    test('saveEncryptedData persists blob while leaving other types unchanged', async () => {
      const handle = await createInitializedUnlockedVaultForReadWrite('user-a');

      const tasksValue = [{ id: '1', title: 'Task 1' }];
      const todosValue = [{ id: 'a', text: 'Todo A' }];

      await handle.saveEncryptedData({
        type: 'tasks',
        value: tasksValue,
      });
      await handle.saveEncryptedData({
        type: 'todos',
        value: todosValue,
      });

      // Verify both are present.
      const loadedTasks = await handle.loadDecryptedData({
        type: 'tasks',
        defaultValue: [],
      });
      const loadedTodos = await handle.loadDecryptedData({
        type: 'todos',
        defaultValue: [],
      });

      expect(loadedTasks).toEqual(tasksValue);
      expect(loadedTodos).toEqual(todosValue);

      // Verify vault data has both types.
      const vault = handle.loadVault();
      expect(vault?.data.tasks).toBeDefined();
      expect(vault?.data.todos).toBeDefined();
    });
  });

  // Test 16: Vault removal — explicit removal (hasOwnedVault and removeVault)
  describe('Vault removal — hasOwnedVault and removeVault (ADR 0033)', () => {
    test('hasOwnedVault() is false for a fresh owner with no Local Vault at all', () => {
      const handle = createVaultHandle({ owner: 'user-a' });
      expect(handle.hasOwnedVault()).toBe(false);
    });

    test('hasOwnedVault() is false when the only Local Vault visible is an Unclaimed Local Vault', () => {
      // Populate only the unsuffixed slot (Unclaimed).
      const unclaimed: VaultStorageV1 = {
        version: 1,
        kdf: {
          name: 'PBKDF2',
          hash: 'SHA-256',
          iterations: 310000,
          salt: 'c2FsdA==',
        },
        masterKeyWrappedWithPassphrase: {
          iv: 'cGFzc3BocmFzZS1pdg==',
          ciphertext: 'cGFzc3BocmFzZS1jdA==',
        },
        masterKeyWrappedWithRecoveryKey: {
          iv: 'cmVjb3ZlcnktaXY=',
          ciphertext: 'cmVjb3ZlcnktY3Q=',
        },
        data: {},
      };
      localStorage.setItem('myorganizer_vault_v1', JSON.stringify(unclaimed));

      const handle = createVaultHandle({ owner: 'user-a' });
      expect(handle.hasOwnedVault()).toBe(false);
    });

    test('hasOwnedVault() is true when this owner has an owned (claimed) Local Vault', async () => {
      // Initialize and own the vault.
      const handle = createVaultHandle({ owner: 'user-a' });
      await handle.initialize({ passphrase: 'test-pass' });

      expect(handle.hasOwnedVault()).toBe(true);
    });

    test('removeVault() removes the entry and handle.hasVault() reflects absence afterward', () => {
      // Setup: write a vault for user-a.
      const vault: VaultStorageV1 = {
        version: 1,
        kdf: {
          name: 'PBKDF2',
          hash: 'SHA-256',
          iterations: 310000,
          salt: 'c2FsdA==',
        },
        masterKeyWrappedWithPassphrase: {
          iv: 'cGFzc3BocmFzZS1pdg==',
          ciphertext: 'cGFzc3BocmFzZS1jdA==',
        },
        masterKeyWrappedWithRecoveryKey: {
          iv: 'cmVjb3ZlcnktaXY=',
          ciphertext: 'cmVjb3ZlcnktY3Q=',
        },
        data: {},
      };
      localStorage.setItem(
        LS_KEY_USER_A,
        JSON.stringify({
          version: 2,
          owner: 'user-a',
          vault,
        }),
      );

      const handle = createVaultHandle({ owner: 'user-a' });
      expect(handle.hasVault()).toBe(true);

      // Act: remove the vault.
      handle.removeVault();

      // Assert: vault is gone.
      expect(handle.hasVault()).toBe(false);
      expect(handle.loadVault()).toBeNull();

      // Assert: a fresh handle for the same owner also sees absence.
      const freshHandle = createVaultHandle({ owner: 'user-a' });
      expect(freshHandle.hasVault()).toBe(false);
    });

    test('removeVault() locks the handle: isUnlocked becomes false', () => {
      // Setup: create a handle that is unlocked (masterKeyBytes passed).
      const masterKeyBytes = new Uint8Array([1, 2, 3, 4]);
      const vault: VaultStorageV1 = {
        version: 1,
        kdf: {
          name: 'PBKDF2',
          hash: 'SHA-256',
          iterations: 310000,
          salt: 'c2FsdA==',
        },
        masterKeyWrappedWithPassphrase: {
          iv: 'cGFzc3BocmFzZS1pdg==',
          ciphertext: 'cGFzc3BocmFzZS1jdA==',
        },
        masterKeyWrappedWithRecoveryKey: {
          iv: 'cmVjb3ZlcnktaXY=',
          ciphertext: 'cmVjb3ZlcnktY3Q=',
        },
        data: {},
      };
      localStorage.setItem(
        LS_KEY_USER_A,
        JSON.stringify({
          version: 2,
          owner: 'user-a',
          vault,
        }),
      );

      const handle = createVaultHandle({
        owner: 'user-a',
        masterKeyBytes,
      });
      expect(handle.isUnlocked).toBe(true);

      // Act: remove.
      handle.removeVault();

      // Assert: locked.
      expect(handle.isUnlocked).toBe(false);
    });

    test("removeVault() does not affect a different owner's handle", () => {
      // Setup: vaults for user-a and user-b.
      const vaultA: VaultStorageV1 = {
        version: 1,
        kdf: {
          name: 'PBKDF2',
          hash: 'SHA-256',
          iterations: 310000,
          salt: 'c2FsdA==',
        },
        masterKeyWrappedWithPassphrase: {
          iv: 'aS1h',
          ciphertext: 'Y3QtYQ==',
        },
        masterKeyWrappedWithRecoveryKey: {
          iv: 'aS1h',
          ciphertext: 'Y3QtYQ==',
        },
        data: { addresses: { iv: 'aXY=', ciphertext: 'Y3Q=' } },
      };

      const vaultB: VaultStorageV1 = {
        version: 1,
        kdf: {
          name: 'PBKDF2',
          hash: 'SHA-256',
          iterations: 310000,
          salt: 'c2FsdA==',
        },
        masterKeyWrappedWithPassphrase: {
          iv: 'aS1i',
          ciphertext: 'Y3QtYg==',
        },
        masterKeyWrappedWithRecoveryKey: {
          iv: 'aS1i',
          ciphertext: 'Y3QtYg==',
        },
        data: { todos: { iv: 'aXY=', ciphertext: 'Y3Q=' } },
      };

      localStorage.setItem(
        LS_KEY_USER_A,
        JSON.stringify({
          version: 2,
          owner: 'user-a',
          vault: vaultA,
        }),
      );
      localStorage.setItem(
        LS_KEY_USER_B,
        JSON.stringify({
          version: 2,
          owner: 'user-b',
          vault: vaultB,
        }),
      );

      const handleA = createVaultHandle({ owner: 'user-a' });
      const handleB = createVaultHandle({ owner: 'user-b' });

      // Act: remove user-a's vault.
      handleA.removeVault();

      // Assert: user-a is gone.
      expect(handleA.hasOwnedVault()).toBe(false);

      // Assert: user-b is unaffected.
      expect(handleB.hasOwnedVault()).toBe(true);
      expect(handleB.loadVault()).toEqual(vaultB);
    });

    test('removeVault() when only Unclaimed Local Vault exists is a safe no-op', () => {
      // Setup: only unsuffixed slot populated.
      const unclaimed: VaultStorageV1 = {
        version: 1,
        kdf: {
          name: 'PBKDF2',
          hash: 'SHA-256',
          iterations: 310000,
          salt: 'c2FsdA==',
        },
        masterKeyWrappedWithPassphrase: {
          iv: 'cGFzc3BocmFzZS1pdg==',
          ciphertext: 'cGFzc3BocmFzZS1jdA==',
        },
        masterKeyWrappedWithRecoveryKey: {
          iv: 'cmVjb3ZlcnktaXY=',
          ciphertext: 'cmVjb3ZlcnktY3Q=',
        },
        data: {},
      };
      localStorage.setItem('myorganizer_vault_v1', JSON.stringify(unclaimed));
      const beforeRaw = localStorage.getItem('myorganizer_vault_v1');
      expect(beforeRaw).not.toBeNull();

      const handle = createVaultHandle({
        owner: 'user-a',
        masterKeyBytes: new Uint8Array([1, 2, 3, 4]),
      });

      // Act: remove (only touches the per-owner key, not the unsuffixed slot).
      handle.removeVault();

      // Assert: unsuffixed slot unchanged (byte-identical).
      const afterRaw = localStorage.getItem('myorganizer_vault_v1');
      expect(afterRaw).toBe(beforeRaw);

      // Assert: handle still sees the unclaimed vault (via hasVault).
      expect(handle.hasVault()).toBe(true);
      expect(handle.hasOwnedVault()).toBe(false);
    });

    test('not calling removeVault() leaves the Vault present for a freshly-constructed handle (reload scenario)', async () => {
      // Setup: Initialize a vault for user-a.
      const handle = createVaultHandle({ owner: 'user-a' });
      await handle.initialize({ passphrase: 'test-pass' });

      // Verify the vault exists initially.
      expect(handle.hasVault()).toBe(true);
      expect(handle.hasOwnedVault()).toBe(true);

      // Simulate cancelling the removal: no removeVault() call happens.
      // (The point of this test is the absence of a call.)

      // Simulate a reload: construct a fresh handle for the same owner.
      const reloadedHandle = createVaultHandle({ owner: 'user-a' });

      // Assert: the vault is still present in the fresh handle.
      expect(reloadedHandle.hasVault()).toBe(true);
      expect(reloadedHandle.hasOwnedVault()).toBe(true);
      expect(reloadedHandle.loadVault()).not.toBeNull();
    });
  });

  // Test 17: API shape validation
  describe('API shape validation (ADR 0047)', () => {
    test('only createVaultHandle, VaultLockedError, and VaultSecretMismatchError are exported', () => {
      const exportedKeys = Object.keys(vaultHandleModule)
        .filter((key) => key !== '__esModule')
        .sort();
      const expected = [
        'VaultLockedError',
        'VaultSecretMismatchError',
        'createVaultHandle',
      ].sort();

      expect(exportedKeys).toEqual(expected);
    });

    test('exports expose no unbound functions that return vault data', () => {
      const exports = vaultHandleModule;

      // Ensure only createVaultHandle is a non-Error-class function.
      // Use prototype chain walk to check if Error is in the inheritance chain.
      const nonErrorExports = Object.entries(exports).filter(([, value]) => {
        if (typeof value !== 'function') return false;
        // Check if value is an Error subclass by walking the prototype chain.
        let proto = (value as unknown as { prototype?: unknown }).prototype;
        while (proto !== null && proto !== undefined) {
          if (proto === Error.prototype) return false;
          proto = Object.getPrototypeOf(
            proto as unknown as Record<string, unknown>,
          );
        }
        return true;
      });

      expect(nonErrorExports).toHaveLength(1);
      expect(nonErrorExports[0][0]).toBe('createVaultHandle');
    });

    test('createVaultHandle requires an owner', () => {
      expect(() => createVaultHandle({ owner: '' })).toThrow();
      expect(() => createVaultHandle({ owner: '  ' })).toThrow();
    });
  });
});
