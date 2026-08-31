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

// === Polyfill crypto.subtle for Node's jsdom environment ===
// jsdom ~22.1 does not provide crypto.subtle, but Node's webcrypto is available.
// This polyfill allows the real hashCiphertext implementation in syncBookmarkAccess to run unmodified.
if (!(globalThis as any).crypto?.subtle) {
  const { webcrypto } = require('crypto');
  if (!(globalThis as any).crypto) {
    (globalThis as any).crypto = {};
  }
  (globalThis as any).crypto.subtle = webcrypto.subtle;
}

// === Crypto mocking ===
// Mock all WebCrypto operations; keep pure helpers real for JSON round-tripping.
// Note: This only affects ./crypto module exports (PBKDF2, AES-GCM), not crypto.subtle.digest
// which is called directly from syncBookmarkAccess.ts via globalThis.crypto.subtle (now polyfilled above).

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
        handle.changePassphrase({
          currentPassphrase: 'old-pass',
          newPassphrase: 'new-pass',
        }),
      ).rejects.toThrow(VaultLockedError);
    });

    test('changePassphrase with wrong current passphrase throws VaultSecretMismatchError and leaves vault byte-identical', async () => {
      const initialHandle =
        await createInitializedVaultForPassphraseChange('user-a');
      await initialHandle.unlockWithPassphrase({ passphrase: 'old-pass' });

      // Record state before the failed call
      const vaultBefore = initialHandle.loadVault()!;
      const stateBefore = {
        masterKeyWrappedWithPassphrase:
          vaultBefore.masterKeyWrappedWithPassphrase,
        masterKeyWrappedWithRecoveryKey:
          vaultBefore.masterKeyWrappedWithRecoveryKey,
        kdf: vaultBefore.kdf,
        data: vaultBefore.data,
      };

      // Make aesGcmDecrypt reject to simulate wrong passphrase unwrap failure
      const { aesGcmDecrypt } = require('./crypto');
      aesGcmDecrypt.mockRejectedValueOnce(
        new Error('Decryption failed - wrong passphrase'),
      );

      // Attempt to change with wrong current passphrase
      let caught: VaultSecretMismatchError | null = null;
      try {
        await initialHandle.changePassphrase({
          currentPassphrase: 'wrong-pass',
          newPassphrase: 'new-pass',
        });
      } catch (e) {
        caught = e as VaultSecretMismatchError;
      }

      expect(caught).toBeInstanceOf(VaultSecretMismatchError);
      expect(caught?.secret).toBe('passphrase');

      // Verify state is unchanged
      const vaultAfter = initialHandle.loadVault()!;
      const stateAfter = {
        masterKeyWrappedWithPassphrase:
          vaultAfter.masterKeyWrappedWithPassphrase,
        masterKeyWrappedWithRecoveryKey:
          vaultAfter.masterKeyWrappedWithRecoveryKey,
        kdf: vaultAfter.kdf,
        data: vaultAfter.data,
      };

      expect(stateAfter).toEqual(stateBefore);
    });

    test('changePassphrase with correct current passphrase rewraps and new passphrase unlocks', async () => {
      const initialHandle =
        await createInitializedVaultForPassphraseChange('user-a');
      await initialHandle.unlockWithPassphrase({ passphrase: 'old-pass' });

      const vaultBefore = initialHandle.loadVault();

      // Change with correct passphrase
      await initialHandle.changePassphrase({
        currentPassphrase: 'old-pass',
        newPassphrase: 'new-pass',
      });

      const vaultAfter = initialHandle.loadVault();

      // Passphrase wrap should change
      expect(vaultAfter?.masterKeyWrappedWithPassphrase).not.toEqual(
        vaultBefore?.masterKeyWrappedWithPassphrase,
      );

      // Recovery wrap should remain unchanged
      expect(vaultAfter?.masterKeyWrappedWithRecoveryKey).toEqual(
        vaultBefore?.masterKeyWrappedWithRecoveryKey,
      );

      // Verify new passphrase works by unlocking a fresh handle
      const newHandle = createVaultHandle({ owner: 'user-a' });
      const unlockResult = await newHandle.unlockWithPassphrase({
        passphrase: 'new-pass',
      });
      expect(unlockResult.masterKeyBytes).toBeInstanceOf(Uint8Array);
      expect(newHandle.loadVault()).not.toBeNull();
    });

    test('changePassphrase preserves kdf.salt byte-identical', async () => {
      const initialHandle =
        await createInitializedVaultForPassphraseChange('user-a');
      await initialHandle.unlockWithPassphrase({ passphrase: 'old-pass' });

      const saltBefore = initialHandle.loadVault()!.kdf.salt;

      await initialHandle.changePassphrase({
        currentPassphrase: 'old-pass',
        newPassphrase: 'new-pass',
      });

      const saltAfter = initialHandle.loadVault()!.kdf.salt;
      expect(saltAfter).toBe(saltBefore);
    });

    test('resetPassphrase on unlocked handle rewraps passphrase, leaves recovery and data unchanged', async () => {
      const initialHandle =
        await createInitializedVaultForPassphraseChange('user-a');
      await initialHandle.unlockWithPassphrase({ passphrase: 'old-pass' });

      const vaultBefore = initialHandle.loadVault();
      const recoveryWrapBefore = vaultBefore?.masterKeyWrappedWithRecoveryKey;
      const dataBefore = vaultBefore?.data;

      await initialHandle.resetPassphrase({ newPassphrase: 'new-pass' });

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

    test('resetPassphrase preserves kdf.salt byte-identical', async () => {
      const initialHandle =
        await createInitializedVaultForPassphraseChange('user-a');
      await initialHandle.unlockWithPassphrase({ passphrase: 'old-pass' });

      const saltBefore = initialHandle.loadVault()!.kdf.salt;

      await initialHandle.resetPassphrase({ newPassphrase: 'new-pass' });

      const saltAfter = initialHandle.loadVault()!.kdf.salt;
      expect(saltAfter).toBe(saltBefore);
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

  // Test 17: vaultStatus() method
  describe('vaultStatus()', () => {
    test('vaultStatus() returns "owned" when owner holds owned record', () => {
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

      expect(handle.vaultStatus()).toBe('owned');
    });

    test('vaultStatus() returns "unclaimed" when only unsuffixed slot populated', () => {
      const handle = createVaultHandle({ owner: 'user-a' });

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

      expect(handle.vaultStatus()).toBe('unclaimed');
    });

    test('vaultStatus() returns "owner-mismatch" when entry names different owner', () => {
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
          owner: 'user-b', // Different owner
          vault,
        }),
      );

      expect(handle.vaultStatus()).toBe('owner-mismatch');
    });

    test('vaultStatus() returns "absent" when no vault exists', () => {
      const handle = createVaultHandle({ owner: 'user-a' });

      expect(handle.vaultStatus()).toBe('absent');
    });

    test('vaultStatus() does not modify localStorage', () => {
      const handle = createVaultHandle({ owner: 'user-a' });

      const beforeState = JSON.stringify({
        ownedKey: localStorage.getItem(LS_KEY_USER_A),
        unclaimedKey: localStorage.getItem('myorganizer_vault_v1'),
      });

      // Call vaultStatus multiple times
      handle.vaultStatus();
      handle.vaultStatus();
      handle.vaultStatus();

      const afterState = JSON.stringify({
        ownedKey: localStorage.getItem(LS_KEY_USER_A),
        unclaimedKey: localStorage.getItem('myorganizer_vault_v1'),
      });

      expect(afterState).toBe(beforeState);
    });
  });

  // Test 18: hasUnclaimedLocalVault() method
  describe('hasUnclaimedLocalVault()', () => {
    test('hasUnclaimedLocalVault() returns true when unsuffixed slot populated', () => {
      const handle = createVaultHandle({ owner: 'user-a' });

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

      expect(handle.hasUnclaimedLocalVault()).toBe(true);
    });

    test('hasUnclaimedLocalVault() returns true even when owner also holds their own record', () => {
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

      // Owner has their own record
      localStorage.setItem(
        LS_KEY_USER_A,
        JSON.stringify({
          version: 2,
          owner: 'user-a',
          vault,
        }),
      );

      // AND device has unclaimed vault
      localStorage.setItem('myorganizer_vault_v1', JSON.stringify(vault));

      // hasUnclaimedLocalVault should still return true
      expect(handle.hasUnclaimedLocalVault()).toBe(true);
      // But vaultStatus hides it
      expect(handle.vaultStatus()).toBe('owned');
    });

    test('hasUnclaimedLocalVault() returns false when unsuffixed slot empty', () => {
      const handle = createVaultHandle({ owner: 'user-a' });

      expect(handle.hasUnclaimedLocalVault()).toBe(false);
    });
  });

  // Test 19: Vault Claim
  describe('claimUnclaimedLocalVault()', () => {
    async function createUnclaimedVault() {
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
      return unclaimedVault;
    }

    test('claimUnclaimedLocalVault() with correct passphrase resolves with masterKeyBytes', async () => {
      const handle = createVaultHandle({ owner: 'user-a' });
      await createUnclaimedVault();

      const result = await handle.claimUnclaimedLocalVault({
        passphrase: 'test-pass',
      });

      expect(result.masterKeyBytes).toBeInstanceOf(Uint8Array);
      expect(result.masterKeyBytes.length).toBeGreaterThan(0);
    });

    test('claimUnclaimedLocalVault() creates owner record and unlocks handle', async () => {
      const handle = createVaultHandle({ owner: 'user-a' });
      await createUnclaimedVault();

      expect(handle.isUnlocked).toBe(false);
      expect(handle.vaultStatus()).toBe('unclaimed');

      await handle.claimUnclaimedLocalVault({ passphrase: 'test-pass' });

      expect(handle.isUnlocked).toBe(true);
      expect(handle.vaultStatus()).toBe('owned');
    });

    test('claimUnclaimedLocalVault() leaves unsuffixed slot byte-identical after success', async () => {
      const handle = createVaultHandle({ owner: 'user-a' });
      const unclaimedVault = await createUnclaimedVault();
      const unclaimedBefore = JSON.stringify(unclaimedVault);

      await handle.claimUnclaimedLocalVault({ passphrase: 'test-pass' });

      const unclaimedAfter = localStorage.getItem('myorganizer_vault_v1');
      expect(unclaimedAfter).toBe(unclaimedBefore);
    });

    test('claimUnclaimedLocalVault() creates owned record under owner key', async () => {
      const handle = createVaultHandle({ owner: 'user-a' });
      await createUnclaimedVault();

      await handle.claimUnclaimedLocalVault({ passphrase: 'test-pass' });

      const ownedRecord = JSON.parse(
        localStorage.getItem(LS_KEY_USER_A) || '{}',
      );
      expect(ownedRecord.version).toBe(2);
      expect(ownedRecord.owner).toBe('user-a');
      expect(ownedRecord.vault).toBeDefined();
    });

    test('claimUnclaimedLocalVault() with wrong passphrase rejects with VaultSecretMismatchError', async () => {
      const handle = createVaultHandle({ owner: 'user-a' });
      await createUnclaimedVault();

      // Mock aesGcmDecrypt to fail
      const { aesGcmDecrypt } = require('./crypto');
      aesGcmDecrypt.mockRejectedValueOnce(new Error('Decryption failed'));

      let caught: VaultSecretMismatchError | null = null;
      try {
        await handle.claimUnclaimedLocalVault({ passphrase: 'wrong-pass' });
      } catch (e) {
        caught = e as VaultSecretMismatchError;
      }

      expect(caught).toBeInstanceOf(VaultSecretMismatchError);
      expect(caught?.secret).toBe('passphrase');
    });

    test('claimUnclaimedLocalVault() with wrong passphrase leaves unsuffixed slot unchanged and creates no owned record', async () => {
      const handle = createVaultHandle({ owner: 'user-a' });
      await createUnclaimedVault();
      const unclaimedBefore = localStorage.getItem('myorganizer_vault_v1');

      // Mock aesGcmDecrypt to fail
      const { aesGcmDecrypt } = require('./crypto');
      aesGcmDecrypt.mockRejectedValueOnce(new Error('Decryption failed'));

      try {
        await handle.claimUnclaimedLocalVault({ passphrase: 'wrong-pass' });
      } catch {
        // Expected to throw
      }

      // Unsuffixed slot should be byte-identical
      expect(localStorage.getItem('myorganizer_vault_v1')).toBe(
        unclaimedBefore,
      );

      // No owned record should be created
      expect(localStorage.getItem(LS_KEY_USER_A)).toBeNull();

      // Handle should still be locked
      expect(handle.isUnlocked).toBe(false);
    });

    test('claimUnclaimedLocalVault() when no unclaimed vault exists rejects', async () => {
      const handle = createVaultHandle({ owner: 'user-a' });

      await expect(
        handle.claimUnclaimedLocalVault({ passphrase: 'test-pass' }),
      ).rejects.toThrow();
    });

    test('claimUnclaimedLocalVault() claim by user-a leaves unclaimed vault resolvable for user-c', async () => {
      const handleA = createVaultHandle({ owner: 'user-a' });
      const handleC = createVaultHandle({ owner: 'user-c' });

      await createUnclaimedVault();
      const unclaimedBefore = localStorage.getItem('myorganizer_vault_v1');

      // User A claims
      await handleA.claimUnclaimedLocalVault({ passphrase: 'test-pass' });

      // User C should still see it as unclaimed
      expect(handleC.vaultStatus()).toBe('unclaimed');
      expect(handleC.hasUnclaimedLocalVault()).toBe(true);

      // Unsuffixed slot should be byte-identical
      expect(localStorage.getItem('myorganizer_vault_v1')).toBe(
        unclaimedBefore,
      );
    });
  });

  // Test 20: Escape path - initialize when unclaimed vault exists
  describe('initialize() escape path with unclaimed vault present', () => {
    async function createUnclaimedVault() {
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
      return unclaimedVault;
    }

    test('initialize() when unclaimed vault present creates owned record and leaves unsuffixed slot byte-identical', async () => {
      const handle = createVaultHandle({ owner: 'user-a' });
      const unclaimedVault = await createUnclaimedVault();
      const unclaimedBefore = localStorage.getItem('myorganizer_vault_v1');

      // User creates their own vault (escape path)
      await handle.initialize({ passphrase: 'new-pass' });

      // Owner should have their own record
      const ownedRecord = JSON.parse(
        localStorage.getItem(LS_KEY_USER_A) || '{}',
      );
      expect(ownedRecord.version).toBe(2);
      expect(ownedRecord.owner).toBe('user-a');
      expect(ownedRecord.vault).toBeDefined();

      // Unsuffixed slot should be byte-identical (regression guard for #495)
      expect(localStorage.getItem('myorganizer_vault_v1')).toBe(
        unclaimedBefore,
      );

      // User's own vault should differ from unclaimed (different masterKey)
      expect(ownedRecord.vault).not.toEqual(unclaimedVault);
    });
  });

  // Test 21: API shape validation
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

  // Test 22: Sync Bookmark integration — hasUnsentChanges
  describe('hasUnsentChanges — Sync Bookmark dirtiness (works while locked)', () => {
    test('1: hasUnsentChanges returns false when type has no saved blob', async () => {
      const handle = createVaultHandle({ owner: 'user-a' });
      await handle.initialize({ passphrase: 'test-pass' });

      const isDirty = await handle.hasUnsentChanges('tasks');
      expect(isDirty).toBe(false);
    });

    test('2: hasUnsentChanges returns true when type has blob but no bookmark yet', async () => {
      const handle = createVaultHandle({ owner: 'user-a' });
      await handle.initialize({ passphrase: 'test-pass' });
      await handle.unlockWithPassphrase({ passphrase: 'test-pass' });

      // Save some data
      await handle.saveEncryptedData({
        type: 'tasks',
        value: [{ id: '1', title: 'Task 1' }],
      });

      // hasUnsentChanges should be true (never pushed)
      const isDirty = await handle.hasUnsentChanges('tasks');
      expect(isDirty).toBe(true);
    });

    test('3: hasUnsentChanges returns false when blob hash matches bookmark', async () => {
      const handle = createVaultHandle({ owner: 'user-a' });
      await handle.initialize({ passphrase: 'test-pass' });
      await handle.unlockWithPassphrase({ passphrase: 'test-pass' });

      // Save data and record push success (simulates confirmed push)
      const taskValue = [{ id: '1', title: 'Task 1' }];
      await handle.saveEncryptedData({
        type: 'tasks',
        value: taskValue,
      });
      await handle.recordPushSuccess({ type: 'tasks', etag: 'etag-1' });

      // Should not be dirty after confirmed push
      const isDirty = await handle.hasUnsentChanges('tasks');
      expect(isDirty).toBe(false);
    });

    test('4: hasUnsentChanges returns true when blob changed after bookmark recorded', async () => {
      const handle = createVaultHandle({ owner: 'user-a' });
      await handle.initialize({ passphrase: 'test-pass' });
      await handle.unlockWithPassphrase({ passphrase: 'test-pass' });

      // Save initial data and record push
      await handle.saveEncryptedData({
        type: 'tasks',
        value: [{ id: '1', title: 'Task 1' }],
      });
      await handle.recordPushSuccess({ type: 'tasks', etag: 'etag-1' });

      // Verify not dirty after push
      let isDirty = await handle.hasUnsentChanges('tasks');
      expect(isDirty).toBe(false);

      // User edits and saves new data locally
      await handle.saveEncryptedData({
        type: 'tasks',
        value: [{ id: '1', title: 'Task 1 - Updated' }],
      });

      // Should be dirty again (new blob hash, old bookmark)
      isDirty = await handle.hasUnsentChanges('tasks');
      expect(isDirty).toBe(true);
    });

    test('5: hasUnsentChanges works while handle is locked (no Master Key needed)', async () => {
      // Initialize and save data
      const initHandle = createVaultHandle({ owner: 'user-a' });
      await initHandle.initialize({ passphrase: 'test-pass' });
      await initHandle.unlockWithPassphrase({ passphrase: 'test-pass' });
      await initHandle.saveEncryptedData({
        type: 'tasks',
        value: [{ id: '1', title: 'Task 1' }],
      });

      // Create a new handle WITHOUT masterKeyBytes (locked)
      const lockedHandle = createVaultHandle({ owner: 'user-a' });
      expect(lockedHandle.isUnlocked).toBe(false);

      // hasUnsentChanges should still work (no unlock required)
      const isDirty = await lockedHandle.hasUnsentChanges('tasks');
      expect(isDirty).toBe(true);
    });

    test('6: hasUnsentChanges for different types operate independently', async () => {
      const handle = createVaultHandle({ owner: 'user-a' });
      await handle.initialize({ passphrase: 'test-pass' });
      await handle.unlockWithPassphrase({ passphrase: 'test-pass' });

      // Save tasks and record push success
      await handle.saveEncryptedData({
        type: 'tasks',
        value: [{ id: '1', title: 'Task 1' }],
      });
      await handle.recordPushSuccess({ type: 'tasks', etag: 'etag-tasks' });

      // Save todos but do NOT record push success
      await handle.saveEncryptedData({
        type: 'todos',
        value: [{ id: 'a', text: 'Todo A' }],
      });

      // Tasks should not be dirty (pushed)
      expect(await handle.hasUnsentChanges('tasks')).toBe(false);

      // Todos should be dirty (never pushed)
      expect(await handle.hasUnsentChanges('todos')).toBe(true);
    });
  });

  // Test 23: Sync Bookmark integration — recordPushSuccess
  describe('recordPushSuccess — record confirmed successful push', () => {
    test('1: recordPushSuccess advances bookmark for type', async () => {
      const handle = createVaultHandle({ owner: 'user-a' });
      await handle.initialize({ passphrase: 'test-pass' });
      await handle.unlockWithPassphrase({ passphrase: 'test-pass' });

      await handle.saveEncryptedData({
        type: 'tasks',
        value: [{ id: '1', title: 'Task 1' }],
      });

      // Before: dirty
      let isDirty = await handle.hasUnsentChanges('tasks');
      expect(isDirty).toBe(true);

      // Act: record push success
      await handle.recordPushSuccess({ type: 'tasks', etag: 'etag-1' });

      // After: not dirty
      isDirty = await handle.hasUnsentChanges('tasks');
      expect(isDirty).toBe(false);
    });

    test('2: recordPushSuccess throws when no blob saved for type yet', async () => {
      const handle = createVaultHandle({ owner: 'user-a' });
      await handle.initialize({ passphrase: 'test-pass' });
      await handle.unlockWithPassphrase({ passphrase: 'test-pass' });

      // Do NOT save any tasks; try to record push success
      let caughtError: unknown;
      try {
        await handle.recordPushSuccess({ type: 'tasks', etag: 'etag-1' });
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(Error);
      if (caughtError instanceof Error) {
        expect(caughtError.message).toContain(
          'No Ciphertext saved for "tasks"',
        );
      }
    });

    test('3: recordPushSuccess stores etag from server', async () => {
      const handle = createVaultHandle({ owner: 'user-a' });
      await handle.initialize({ passphrase: 'test-pass' });
      await handle.unlockWithPassphrase({ passphrase: 'test-pass' });

      await handle.saveEncryptedData({
        type: 'tasks',
        value: [{ id: '1', title: 'Task 1' }],
      });

      const serverEtag = 'server-etag-abc123xyz';
      await handle.recordPushSuccess({ type: 'tasks', etag: serverEtag });

      // Verify etag was stored by reading bookmarks directly
      const { readSyncBookmarks } = require('./syncBookmarkStorage');
      const bookmarks = readSyncBookmarks('user-a');
      expect(bookmarks.tasks?.etag).toBe(serverEtag);
    });

    test('4: recordPushSuccess for one type does not affect others', async () => {
      const handle = createVaultHandle({ owner: 'user-a' });
      await handle.initialize({ passphrase: 'test-pass' });
      await handle.unlockWithPassphrase({ passphrase: 'test-pass' });

      // Save two types
      await handle.saveEncryptedData({
        type: 'tasks',
        value: [{ id: '1', title: 'Task 1' }],
      });
      await handle.saveEncryptedData({
        type: 'todos',
        value: [{ id: 'a', text: 'Todo A' }],
      });

      // Record push success only for tasks
      await handle.recordPushSuccess({ type: 'tasks', etag: 'etag-tasks' });

      // Tasks should not be dirty
      expect(await handle.hasUnsentChanges('tasks')).toBe(false);

      // Todos should still be dirty
      expect(await handle.hasUnsentChanges('todos')).toBe(true);
    });

    test('5: recordPushSuccess can be called multiple times for same type (re-push)', async () => {
      const handle = createVaultHandle({ owner: 'user-a' });
      await handle.initialize({ passphrase: 'test-pass' });
      await handle.unlockWithPassphrase({ passphrase: 'test-pass' });

      await handle.saveEncryptedData({
        type: 'tasks',
        value: [{ id: '1', title: 'Task 1' }],
      });

      // First push
      await handle.recordPushSuccess({ type: 'tasks', etag: 'etag-1' });
      let isDirty = await handle.hasUnsentChanges('tasks');
      expect(isDirty).toBe(false);

      // User edits locally
      await handle.saveEncryptedData({
        type: 'tasks',
        value: [{ id: '1', title: 'Task 1 - Updated' }],
      });
      isDirty = await handle.hasUnsentChanges('tasks');
      expect(isDirty).toBe(true);

      // Second push
      await handle.recordPushSuccess({ type: 'tasks', etag: 'etag-2' });
      isDirty = await handle.hasUnsentChanges('tasks');
      expect(isDirty).toBe(false);

      // Verify new etag was stored
      const { readSyncBookmarks } = require('./syncBookmarkStorage');
      const bookmarks = readSyncBookmarks('user-a');
      expect(bookmarks.tasks?.etag).toBe('etag-2');
    });
  });

  // Test 24: Vault removal — Sync Bookmarks cleanup
  describe('removeVault — explicit removal includes Sync Bookmarks', () => {
    test('1: removeVault removes both Local Vault and Sync Bookmarks for owner', () => {
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

      // Pre-write a sync bookmark for user-a
      const {
        writeSyncBookmark,
        syncBookmarkStorageKey,
      } = require('./syncBookmarkStorage');
      writeSyncBookmark({
        owner: 'user-a',
        type: 'tasks',
        entry: { ciphertextHash: 'hash1', etag: 'etag1' },
      });

      const handle = createVaultHandle({ owner: 'user-a' });

      // Verify both exist before removal
      expect(localStorage.getItem(LS_KEY_USER_A)).not.toBeNull();
      expect(
        localStorage.getItem(syncBookmarkStorageKey('user-a')),
      ).not.toBeNull();

      // Act: remove vault
      handle.removeVault();

      // Assert: both are gone
      expect(localStorage.getItem(LS_KEY_USER_A)).toBeNull();
      expect(localStorage.getItem(syncBookmarkStorageKey('user-a'))).toBeNull();
    });

    test('2: removeVault for user-a leaves user-b bookmarks untouched', () => {
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

      // Setup: vaults and bookmarks for both users
      localStorage.setItem(
        LS_KEY_USER_A,
        JSON.stringify({
          version: 2,
          owner: 'user-a',
          vault,
        }),
      );
      localStorage.setItem(
        LS_KEY_USER_B,
        JSON.stringify({
          version: 2,
          owner: 'user-b',
          vault,
        }),
      );

      const {
        writeSyncBookmark,
        syncBookmarkStorageKey,
      } = require('./syncBookmarkStorage');
      writeSyncBookmark({
        owner: 'user-a',
        type: 'tasks',
        entry: { ciphertextHash: 'hash-a', etag: 'etag-a' },
      });
      writeSyncBookmark({
        owner: 'user-b',
        type: 'todos',
        entry: { ciphertextHash: 'hash-b', etag: 'etag-b' },
      });

      const userBBookmarkBefore = localStorage.getItem(
        syncBookmarkStorageKey('user-b'),
      );

      const handleA = createVaultHandle({ owner: 'user-a' });

      // Act: remove user-a's vault
      handleA.removeVault();

      // Assert: user-a is gone
      expect(localStorage.getItem(LS_KEY_USER_A)).toBeNull();
      expect(localStorage.getItem(syncBookmarkStorageKey('user-a'))).toBeNull();

      // Assert: user-b is unchanged
      expect(localStorage.getItem(LS_KEY_USER_B)).not.toBeNull();
      expect(localStorage.getItem(syncBookmarkStorageKey('user-b'))).toBe(
        userBBookmarkBefore,
      );
    });

    test('3: removeVault when only sync bookmarks exist (no Local Vault) is safe', () => {
      // Setup: only sync bookmark, no local vault
      const {
        writeSyncBookmark,
        syncBookmarkStorageKey,
      } = require('./syncBookmarkStorage');
      writeSyncBookmark({
        owner: 'user-a',
        type: 'tasks',
        entry: { ciphertextHash: 'hash1', etag: 'etag1' },
      });

      expect(localStorage.getItem(LS_KEY_USER_A)).toBeNull();
      expect(
        localStorage.getItem(syncBookmarkStorageKey('user-a')),
      ).not.toBeNull();

      const handle = createVaultHandle({ owner: 'user-a' });

      // Act: remove (should not throw even though no Local Vault)
      expect(() => {
        handle.removeVault();
      }).not.toThrow();

      // Assert: bookmark is gone
      expect(localStorage.getItem(syncBookmarkStorageKey('user-a'))).toBeNull();
    });

    test('4: after removeVault(), fresh handle for same owner starts clean', async () => {
      // Setup: vault with bookmark
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
        data: {
          tasks: {
            iv: 'dGFza3MtaXY=',
            ciphertext: 'dGFza3MtY3Q=',
          },
        },
      };
      localStorage.setItem(
        LS_KEY_USER_A,
        JSON.stringify({
          version: 2,
          owner: 'user-a',
          vault,
        }),
      );

      const { writeSyncBookmark } = require('./syncBookmarkStorage');
      writeSyncBookmark({
        owner: 'user-a',
        type: 'tasks',
        entry: { ciphertextHash: 'old-hash', etag: 'old-etag' },
      });

      const handleBefore = createVaultHandle({ owner: 'user-a' });
      expect(handleBefore.hasOwnedVault()).toBe(true);

      // Act: remove
      handleBefore.removeVault();

      // New handle should start clean
      const handleAfter = createVaultHandle({ owner: 'user-a' });
      expect(handleAfter.hasOwnedVault()).toBe(false);

      // Bookmarks should be empty when read fresh
      const { readSyncBookmarks } = require('./syncBookmarkStorage');
      expect(readSyncBookmarks('user-a')).toEqual({});
    });
  });

  // Test 25: Vault Sync Sink — fire-and-forget sync notifications
  describe('Vault Sync Sink (VaultSyncSink)', () => {
    async function createInitializedUnlockedHandleWithSink(
      owner: string,
      syncSink: { vaultBlobChanged: jest.Mock },
    ) {
      const handle = createVaultHandle({ owner, syncSink });
      await handle.initialize({ passphrase: 'test-pass' });
      await handle.unlockWithPassphrase({ passphrase: 'test-pass' });
      return handle;
    }

    test('1: omitting syncSink leaves behavior exactly unchanged', async () => {
      const handle = createVaultHandle({ owner: 'user-a' });
      await handle.initialize({ passphrase: 'test-pass' });
      await handle.unlockWithPassphrase({ passphrase: 'test-pass' });

      const taskValue = [{ id: '1', title: 'Task 1' }];
      await handle.saveEncryptedData({
        type: 'tasks',
        value: taskValue,
      });

      // Should round-trip the value without any sink involvement
      const loaded = await handle.loadDecryptedData({
        type: 'tasks',
        defaultValue: [],
      });
      expect(loaded).toEqual(taskValue);
    });

    test('2: saveEncryptedData calls sink once with correct Vault Blob Type', async () => {
      const syncSink = {
        vaultBlobChanged: jest.fn(),
      };
      const handleWithSink = await createInitializedUnlockedHandleWithSink(
        'user-a',
        syncSink,
      );

      const taskValue = [{ id: '1', title: 'Task 1' }];
      await handleWithSink.saveEncryptedData({
        type: 'tasks',
        value: taskValue,
      });

      // Sink should be called exactly once with type 'tasks' (VaultBlobType.Tasks)
      expect(syncSink.vaultBlobChanged).toHaveBeenCalledTimes(1);
      expect(syncSink.vaultBlobChanged).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tasks',
        }),
      );
    });

    test('3: field vocabulary is translated from Local Vault field to Vault Blob Type', async () => {
      const syncSink = {
        vaultBlobChanged: jest.fn(),
      };
      const handleWithSink = await createInitializedUnlockedHandleWithSink(
        'user-a',
        syncSink,
      );

      const mobileValue = [{ id: '1', number: '555-1234' }];
      await handleWithSink.saveEncryptedData({
        type: 'mobileNumbers',
        value: mobileValue,
      });

      // Sink should receive VaultBlobType.MobileNumbers (which is 'mobileNumbers')
      expect(syncSink.vaultBlobChanged).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'mobileNumbers',
        }),
      );
    });

    test('4: handle passed to sink is the exact same object reference', async () => {
      let capturedHandle: unknown;
      const syncSink = {
        vaultBlobChanged: jest.fn((change) => {
          capturedHandle = change.handle;
        }),
      };
      const handleWithSink = await createInitializedUnlockedHandleWithSink(
        'user-a',
        syncSink,
      );

      await handleWithSink.saveEncryptedData({
        type: 'tasks',
        value: [{ id: '1', title: 'Task 1' }],
      });

      // The handle passed to the sink must be the exact same object reference
      expect(capturedHandle).toBe(handleWithSink);
    });

    test('5: Local Vault is already committed when sink is invoked (local-commit-first)', async () => {
      let vaultAtSinkTime: VaultStorageV1 | null = null;
      const syncSink = {
        vaultBlobChanged: jest.fn((change) => {
          // Capture the vault state at the moment the sink is called
          vaultAtSinkTime = change.handle.loadVault();
        }),
      };
      const handleWithSink = await createInitializedUnlockedHandleWithSink(
        'user-a',
        syncSink,
      );

      // Save initial data to establish a pre-save ciphertext
      await handleWithSink.saveEncryptedData({
        type: 'tasks',
        value: [{ id: '1', title: 'Task 1' }],
      });
      const preSaveCiphertext = handleWithSink.loadVault()?.data.tasks;

      // Now save different data, which will trigger the sink
      const newTaskValue = [{ id: '2', title: 'Task 2' }];
      await handleWithSink.saveEncryptedData({
        type: 'tasks',
        value: newTaskValue,
      });

      // Verify that the vault captured inside the sink already holds the new ciphertext
      expect(vaultAtSinkTime).not.toBeNull();
      if (vaultAtSinkTime) {
        const vault: VaultStorageV1 = vaultAtSinkTime;
        // Assert the ciphertext is different from before the save (proves new data was written)
        expect(vault.data.tasks).not.toEqual(preSaveCiphertext);
        // And that it matches what we have after the save (proves sink saw the finished write)
        expect(vault.data.tasks).toEqual(
          handleWithSink.loadVault()?.data.tasks,
        );
      }
    });

    test('6: saveEncryptedData resolves even if sink returns non-settling promise', async () => {
      const syncSink = {
        vaultBlobChanged: jest.fn(() => {
          // Return a promise that never settles
          return new Promise(() => {
            // Never resolves or rejects
          });
        }),
      };
      const handleWithSink = await createInitializedUnlockedHandleWithSink(
        'user-a',
        syncSink,
      );

      // This should resolve despite the sink returning a non-settling promise
      await expect(
        handleWithSink.saveEncryptedData({
          type: 'tasks',
          value: [{ id: '1', title: 'Task 1' }],
        }),
      ).resolves.toBeUndefined();
    });

    test('7: sink throwing an error does not fail the save', async () => {
      const syncSink = {
        vaultBlobChanged: jest.fn(() => {
          throw new Error('sink exploded');
        }),
      };
      const handleWithSink = await createInitializedUnlockedHandleWithSink(
        'user-a',
        syncSink,
      );

      // Save should resolve even if sink throws
      await expect(
        handleWithSink.saveEncryptedData({
          type: 'tasks',
          value: [{ id: '1', title: 'Task 1' }],
        }),
      ).resolves.toBeUndefined();

      // But the data should still be saved and readable
      const loaded = await handleWithSink.loadDecryptedData({
        type: 'tasks',
        defaultValue: [],
      });
      expect(loaded).toEqual([{ id: '1', title: 'Task 1' }]);
    });

    test('8: repeated saveEncryptedData calls report each time', async () => {
      const syncSink = {
        vaultBlobChanged: jest.fn(),
      };
      const handleWithSink = await createInitializedUnlockedHandleWithSink(
        'user-a',
        syncSink,
      );

      // Save the same type three times
      await handleWithSink.saveEncryptedData({
        type: 'tasks',
        value: [{ id: '1', title: 'Task 1' }],
      });
      await handleWithSink.saveEncryptedData({
        type: 'tasks',
        value: [{ id: '2', title: 'Task 2' }],
      });
      await handleWithSink.saveEncryptedData({
        type: 'tasks',
        value: [{ id: '3', title: 'Task 3' }],
      });

      // Sink should be called three times (no coalescing at handle level)
      expect(syncSink.vaultBlobChanged).toHaveBeenCalledTimes(3);
    });

    test('9: saveVault does not report to sink', async () => {
      const syncSink = {
        vaultBlobChanged: jest.fn(),
      };
      const handleWithSink = createVaultHandle({
        owner: 'user-a',
        masterKeyBytes: new Uint8Array([1, 2, 3, 4]),
        syncSink,
      });

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
        data: {
          tasks: {
            iv: 'dGFza3MtaXY=',
            ciphertext: 'dGFza3MtY3Q=',
          },
        },
      };

      // Call saveVault (not saveEncryptedData)
      handleWithSink.saveVault(vault);

      // Sink should not be called
      expect(syncSink.vaultBlobChanged).not.toHaveBeenCalled();

      // But vault should still be written
      expect(handleWithSink.loadVault()).toEqual(vault);
    });

    test('10: locked handle rejects saveEncryptedData without calling sink', async () => {
      const syncSink = {
        vaultBlobChanged: jest.fn(),
      };
      // Create a locked handle (no masterKeyBytes, no unlock)
      const handleWithSink = createVaultHandle({
        owner: 'user-a',
        syncSink,
      });

      // Attempt to save while locked
      await expect(
        handleWithSink.saveEncryptedData({
          type: 'tasks',
          value: [{ id: '1', title: 'Task 1' }],
        }),
      ).rejects.toThrow(VaultLockedError);

      // Sink should not have been called
      expect(syncSink.vaultBlobChanged).not.toHaveBeenCalled();
    });
  });
});
