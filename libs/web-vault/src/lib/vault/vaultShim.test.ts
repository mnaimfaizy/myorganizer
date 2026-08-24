/**
 * Equivalence suite for the Vault Shim.
 *
 * These tests verify that the legacy module functions (the shim in `vault.ts`)
 * and a handle bound to the same signed-in User resolve an identical record,
 * with identical storage side effects. The shim exists so call sites can be
 * converted in batches without ever producing two sources of truth for one
 * User's Vault (ADR 0047).
 *
 * Do not extend these tests. The shim is temporary and is deleted in #498.
 */

// Polyfill TextEncoder/TextDecoder for jsdom environment
// The test runner provides these in the global scope for Node.js compatibility
try {
  if (typeof global.TextEncoder === 'undefined') {
    const util = require('util');
    global.TextEncoder = util.TextEncoder;
    global.TextDecoder = util.TextDecoder;
  }
} catch {
  // Polyfill unavailable; fall back to jsdom's built-in if available
}

jest.mock('@myorganizer/auth', () => ({
  getCurrentUser: jest.fn(),
}));

jest.mock('./crypto', () => {
  const actual = jest.requireActual('./crypto');
  return {
    ...actual,
    randomBytes: jest.fn(),
    deriveKeyFromPassphrase: jest.fn(),
    importAesGcmKey: jest.fn(),
    aesGcmEncrypt: jest.fn(),
    aesGcmDecrypt: jest.fn(),
  };
});

import type { FilteredUserInterface } from '@myorganizer/app-api-client';
import { getCurrentUser } from '@myorganizer/auth';
import {
  aesGcmDecrypt,
  aesGcmEncrypt,
  bytesToBase64,
  deriveKeyFromPassphrase,
  importAesGcmKey,
  randomBytes,
  utf8ToBytes,
} from './crypto';
import {
  VAULT_STORAGE_KEY,
  LOCAL_VAULT_RECORD_VERSION,
} from './localVaultStorage';
import * as shimModule from './vault';
import { createVaultHandle } from './vaultHandle';

const mockGetCurrentUser = getCurrentUser as jest.MockedFunction<
  typeof getCurrentUser
>;
const mockRandomBytes = randomBytes as jest.MockedFunction<typeof randomBytes>;
const mockDeriveKeyFromPassphrase =
  deriveKeyFromPassphrase as jest.MockedFunction<
    typeof deriveKeyFromPassphrase
  >;
const mockImportAesGcmKey = importAesGcmKey as jest.MockedFunction<
  typeof importAesGcmKey
>;
const mockAesGcmEncrypt = aesGcmEncrypt as jest.MockedFunction<
  typeof aesGcmEncrypt
>;
const mockAesGcmDecrypt = aesGcmDecrypt as jest.MockedFunction<
  typeof aesGcmDecrypt
>;

/** Deterministic IV and ciphertext for testing. */
const DETERMINISTIC_IV = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
const DETERMINISTIC_CIPHERTEXT = new Uint8Array([
  10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
]);

/** A sentinel CryptoKey for testing. */
const SENTINEL_KEY = {
  type: 'secret',
  algorithm: { name: 'AES-GCM' },
} as unknown as CryptoKey;

/** Build a complete signed-in user stub for testing. */
function signedInUser(id: string): FilteredUserInterface {
  return {
    id,
    name: `Test User ${id}`,
    email: `user-${id}@test.local`,
    firstName: 'Test',
    lastName: `User${id}`,
    role: 'user',
    disabled: false,
  };
}

/** Build a vault storage fixture with proper literal `1` type. */
function makeVault(options?: {
  data?: Record<string, unknown>;
}): import('./localVaultStorage').VaultStorageV1 {
  return {
    version: 1 as const,
    kdf: {
      name: 'PBKDF2' as const,
      hash: 'SHA-256' as const,
      iterations: 310_000,
      salt: bytesToBase64(DETERMINISTIC_IV),
    },
    masterKeyWrappedWithPassphrase: {
      iv: bytesToBase64(DETERMINISTIC_IV),
      ciphertext: bytesToBase64(DETERMINISTIC_CIPHERTEXT),
    },
    masterKeyWrappedWithRecoveryKey: {
      iv: bytesToBase64(DETERMINISTIC_IV),
      ciphertext: bytesToBase64(DETERMINISTIC_CIPHERTEXT),
    },
    data: (options?.data as Record<string, unknown>) || {},
  };
}

/**
 * Read raw localStorage string for a key, returning it or null.
 * Used to capture side effects for equivalence testing.
 */
function readRawStorage(key: string): string | null {
  return window.localStorage.getItem(key);
}

/**
 * Clear localStorage, as per project testing guide.
 */
beforeEach(() => {
  window.localStorage.clear();
  jest.clearAllMocks();
  mockGetCurrentUser.mockReturnValue(undefined);
  mockRandomBytes.mockReturnValue(DETERMINISTIC_IV);
  mockDeriveKeyFromPassphrase.mockResolvedValue(SENTINEL_KEY);
  mockImportAesGcmKey.mockResolvedValue(SENTINEL_KEY);
  mockAesGcmEncrypt.mockResolvedValue(DETERMINISTIC_CIPHERTEXT);
  mockAesGcmDecrypt.mockResolvedValue(
    utf8ToBytes(JSON.stringify({ default: true })),
  );
});

describe('vault shim equivalence', () => {
  describe('loadVault', () => {
    test('returns null when signed-in user holds no vault', () => {
      const userId = 'user-1';
      mockGetCurrentUser.mockReturnValue(signedInUser(userId));

      const shimResult = shimModule.loadVault();
      expect(shimResult).toBeNull();
    });

    test('deep-equals handle result when signed-in user holds a vault', () => {
      const userId = 'user-1';
      mockGetCurrentUser.mockReturnValue(signedInUser(userId));

      // Pre-populate with a vault for the user
      const vault = makeVault();
      const record = {
        version: LOCAL_VAULT_RECORD_VERSION,
        owner: userId,
        vault,
      };
      window.localStorage.setItem(
        `${VAULT_STORAGE_KEY}:${userId}`,
        JSON.stringify(record),
      );

      const shimResult = shimModule.loadVault();
      const handleResult = createVaultHandle({ owner: userId }).loadVault();

      expect(shimResult).toEqual(handleResult);
      expect(shimResult).toEqual(vault);
    });
  });

  describe('hasVault', () => {
    test('returns false when user holds no vault and unclaimed slot is empty', () => {
      const userId = 'user-1';
      mockGetCurrentUser.mockReturnValue(signedInUser(userId));

      const shimResult = shimModule.hasVault();
      expect(shimResult).toBe(false);
    });

    test('returns true when user holds their own vault', () => {
      const userId = 'user-1';
      mockGetCurrentUser.mockReturnValue(signedInUser(userId));

      const vault = makeVault();
      const record = {
        version: LOCAL_VAULT_RECORD_VERSION,
        owner: userId,
        vault,
      };
      window.localStorage.setItem(
        `${VAULT_STORAGE_KEY}:${userId}`,
        JSON.stringify(record),
      );

      const shimResult = shimModule.hasVault();
      const handleResult = createVaultHandle({ owner: userId }).hasVault();

      expect(shimResult).toBe(true);
      expect(shimResult).toBe(handleResult);
    });

    test('returns true when user holds unclaimed vault with no owned record', () => {
      const userId = 'user-1';
      mockGetCurrentUser.mockReturnValue(signedInUser(userId));

      const unclaimedVault = makeVault();
      window.localStorage.setItem(
        VAULT_STORAGE_KEY,
        JSON.stringify(unclaimedVault),
      );

      const shimResult = shimModule.hasVault();
      const handleResult = createVaultHandle({ owner: userId }).hasVault();

      expect(shimResult).toBe(true);
      expect(shimResult).toBe(handleResult);
    });
  });

  describe('saveVault', () => {
    test('writes to same raw storage as handle for signed-in user', () => {
      const userId = 'user-1';
      mockGetCurrentUser.mockReturnValue(signedInUser(userId));

      const vault = makeVault();

      // Shim: save and capture raw storage
      shimModule.saveVault(vault);
      const shimStorageString = readRawStorage(
        `${VAULT_STORAGE_KEY}:${userId}`,
      );

      // Clear and run handle
      window.localStorage.clear();
      createVaultHandle({ owner: userId }).saveVault(vault);
      const handleStorageString = readRawStorage(
        `${VAULT_STORAGE_KEY}:${userId}`,
      );

      expect(shimStorageString).toBe(handleStorageString);
      expect(shimStorageString).not.toBeNull();
    });
  });

  describe('initializeVault', () => {
    test('creates record that handle then resolves via loadVault', async () => {
      const userId = 'user-1';
      mockGetCurrentUser.mockReturnValue(signedInUser(userId));
      mockRandomBytes.mockImplementation((length: number) => {
        const result = new Uint8Array(length);
        for (let i = 0; i < length; i++) {
          result[i] = i % 256;
        }
        return result;
      });

      const passphrase = 'test-passphrase';
      await shimModule.initializeVault({ passphrase });

      // Verify shim did not write to unsuffixed slot
      expect(readRawStorage(VAULT_STORAGE_KEY)).toBeNull();

      // Verify handle can load the vault
      const handle = createVaultHandle({ owner: userId });
      const loaded = handle.loadVault();
      expect(loaded).not.toBeNull();
      expect(loaded?.version).toBe(1);
      expect(loaded?.kdf.name).toBe('PBKDF2');
    });
  });

  describe('loadDecryptedData', () => {
    test('resolves to same value as handle when data is present', async () => {
      const userId = 'user-1';
      const masterKeyBytes = new Uint8Array([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
        21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32,
      ]);
      mockGetCurrentUser.mockReturnValue(signedInUser(userId));

      const encryptedData = { some: 'data' };
      const vault = makeVault({
        data: {
          addresses: {
            iv: bytesToBase64(DETERMINISTIC_IV),
            ciphertext: bytesToBase64(DETERMINISTIC_CIPHERTEXT),
          },
        },
      });
      const record = {
        version: LOCAL_VAULT_RECORD_VERSION,
        owner: userId,
        vault,
      };
      window.localStorage.setItem(
        `${VAULT_STORAGE_KEY}:${userId}`,
        JSON.stringify(record),
      );

      mockAesGcmDecrypt.mockResolvedValue(
        utf8ToBytes(JSON.stringify(encryptedData)),
      );

      const shimResult = await shimModule.loadDecryptedData({
        masterKeyBytes,
        type: 'addresses',
        defaultValue: { fallback: true },
      });

      mockAesGcmDecrypt.mockResolvedValue(
        utf8ToBytes(JSON.stringify(encryptedData)),
      );

      const handle = createVaultHandle({
        owner: userId,
        masterKeyBytes,
      });
      const handleResult = await handle.loadDecryptedData({
        type: 'addresses',
        defaultValue: { fallback: true },
      });

      expect(shimResult).toEqual(handleResult);
      expect(shimResult).toEqual(encryptedData);
    });

    test('returns defaultValue when data is absent (both shim and handle)', async () => {
      const userId = 'user-1';
      const masterKeyBytes = new Uint8Array([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
        21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32,
      ]);
      mockGetCurrentUser.mockReturnValue(signedInUser(userId));

      const vault = makeVault();
      const record = {
        version: LOCAL_VAULT_RECORD_VERSION,
        owner: userId,
        vault,
      };
      window.localStorage.setItem(
        `${VAULT_STORAGE_KEY}:${userId}`,
        JSON.stringify(record),
      );

      const defaultValue = { default: true };
      const shimResult = await shimModule.loadDecryptedData({
        masterKeyBytes,
        type: 'addresses',
        defaultValue,
      });

      const handle = createVaultHandle({
        owner: userId,
        masterKeyBytes,
      });
      const handleResult = await handle.loadDecryptedData({
        type: 'addresses',
        defaultValue,
      });

      expect(shimResult).toEqual(handleResult);
      expect(shimResult).toEqual(defaultValue);
    });
  });

  describe('saveEncryptedData', () => {
    test('leaves storage in same raw state as handle', async () => {
      const userId = 'user-1';
      const masterKeyBytes = new Uint8Array([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
        21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32,
      ]);
      mockGetCurrentUser.mockReturnValue(signedInUser(userId));

      const vault = makeVault();
      const record = {
        version: LOCAL_VAULT_RECORD_VERSION,
        owner: userId,
        vault,
      };
      window.localStorage.setItem(
        `${VAULT_STORAGE_KEY}:${userId}`,
        JSON.stringify(record),
      );

      // Shim: save encrypted data and capture raw storage
      const dataToSave = { secret: 'data' };
      await shimModule.saveEncryptedData({
        masterKeyBytes,
        type: 'addresses',
        value: dataToSave,
      });
      const shimStorageString = readRawStorage(
        `${VAULT_STORAGE_KEY}:${userId}`,
      );

      // Clear and run handle with same setup
      window.localStorage.clear();
      window.localStorage.setItem(
        `${VAULT_STORAGE_KEY}:${userId}`,
        JSON.stringify(record),
      );

      const handle = createVaultHandle({
        owner: userId,
        masterKeyBytes,
      });
      await handle.saveEncryptedData({
        type: 'addresses',
        value: dataToSave,
      });
      const handleStorageString = readRawStorage(
        `${VAULT_STORAGE_KEY}:${userId}`,
      );

      expect(shimStorageString).toBe(handleStorageString);
    });
  });

  describe('setNewPassphrase', () => {
    test('leaves storage in same raw state as handle.changePassphrase', async () => {
      const userId = 'user-1';
      const masterKeyBytes = new Uint8Array([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
        21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32,
      ]);
      mockGetCurrentUser.mockReturnValue(signedInUser(userId));

      const vault = makeVault();
      const record = {
        version: LOCAL_VAULT_RECORD_VERSION,
        owner: userId,
        vault,
      };
      window.localStorage.setItem(
        `${VAULT_STORAGE_KEY}:${userId}`,
        JSON.stringify(record),
      );

      // Shim: set new passphrase and capture raw storage
      const newPassphrase = 'new-passphrase';
      await shimModule.setNewPassphrase({
        masterKeyBytes,
        newPassphrase,
      });
      const shimStorageString = readRawStorage(
        `${VAULT_STORAGE_KEY}:${userId}`,
      );

      // Clear and run handle with same setup
      window.localStorage.clear();
      window.localStorage.setItem(
        `${VAULT_STORAGE_KEY}:${userId}`,
        JSON.stringify(record),
      );

      const handle = createVaultHandle({
        owner: userId,
        masterKeyBytes,
      });
      await handle.changePassphrase({ newPassphrase });
      const handleStorageString = readRawStorage(
        `${VAULT_STORAGE_KEY}:${userId}`,
      );

      expect(shimStorageString).toBe(handleStorageString);
    });
  });

  describe('unlockVaultWithPassphrase', () => {
    test('claims unclaimed vault so handle can resolve it afterwards', async () => {
      const userId = 'user-1';
      mockGetCurrentUser.mockReturnValue(signedInUser(userId));

      const masterKeyBytes = new Uint8Array([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
        21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32,
      ]);

      // Set up unclaimed vault in unsuffixed slot
      const unclaimedVault = makeVault();
      window.localStorage.setItem(
        VAULT_STORAGE_KEY,
        JSON.stringify(unclaimedVault),
      );

      const passphrase = 'test-passphrase';
      mockAesGcmDecrypt.mockResolvedValue(masterKeyBytes);

      // Capture raw unsuffixed slot before unlock
      const unclaimedBefore = readRawStorage(VAULT_STORAGE_KEY);

      // Unlock via shim
      await shimModule.unlockVaultWithPassphrase({ passphrase });

      // Verify unsuffixed slot is byte-identical
      expect(readRawStorage(VAULT_STORAGE_KEY)).toBe(unclaimedBefore);

      // Verify handle can now resolve the claimed vault
      const handle = createVaultHandle({
        owner: userId,
        masterKeyBytes,
      });
      const loaded = handle.loadVault();
      expect(loaded).not.toBeNull();
      expect(loaded?.version).toBe(1);
    });
  });

  describe('owner scoping isolation', () => {
    test('shim returns record of current signed-in user', () => {
      const userId1 = 'user-1';
      const userId2 = 'user-2';

      const vault1 = makeVault({
        data: {
          addresses: {
            iv: bytesToBase64(DETERMINISTIC_IV),
            ciphertext: bytesToBase64(new Uint8Array([1, 2, 3])),
          },
        },
      });

      const vault2 = makeVault({
        data: {
          groceries: {
            iv: bytesToBase64(DETERMINISTIC_IV),
            ciphertext: bytesToBase64(new Uint8Array([4, 5, 6])),
          },
        },
      });

      const record1 = {
        version: LOCAL_VAULT_RECORD_VERSION,
        owner: userId1,
        vault: vault1,
      };
      const record2 = {
        version: LOCAL_VAULT_RECORD_VERSION,
        owner: userId2,
        vault: vault2,
      };

      window.localStorage.setItem(
        `${VAULT_STORAGE_KEY}:${userId1}`,
        JSON.stringify(record1),
      );
      window.localStorage.setItem(
        `${VAULT_STORAGE_KEY}:${userId2}`,
        JSON.stringify(record2),
      );

      // Switch to user 1
      mockGetCurrentUser.mockReturnValue(signedInUser(userId1));
      const result1 = shimModule.loadVault();
      expect(result1).toEqual(vault1);
      expect(result1?.data.addresses).toBeDefined();
      expect(result1?.data.groceries).toBeUndefined();

      // Switch to user 2
      mockGetCurrentUser.mockReturnValue(signedInUser(userId2));
      const result2 = shimModule.loadVault();
      expect(result2).toEqual(vault2);
      expect(result2?.data.groceries).toBeDefined();
      expect(result2?.data.addresses).toBeUndefined();
    });
  });

  describe('signed-out fallback', () => {
    test('saveVault writes to unsuffixed slot when no signed-in user', () => {
      mockGetCurrentUser.mockReturnValue(undefined);

      const vault = makeVault();

      shimModule.saveVault(vault);

      // Verify data was written to unsuffixed slot
      const rawStorage = readRawStorage(VAULT_STORAGE_KEY);
      expect(rawStorage).not.toBeNull();
      if (rawStorage !== null) {
        const parsed = JSON.parse(rawStorage);
        expect(parsed).toEqual(vault);
      }

      // Verify no per-user key was created
      const keys = Object.keys(window.localStorage);
      const perUserKeys = keys.filter((k) =>
        k.startsWith(VAULT_STORAGE_KEY + ':'),
      );
      expect(perUserKeys).toHaveLength(0);
    });

    test('loadVault reads from unsuffixed slot when no signed-in user', () => {
      mockGetCurrentUser.mockReturnValue(undefined);

      const vault = makeVault();

      window.localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(vault));

      const result = shimModule.loadVault();
      expect(result).toEqual(vault);
    });
  });
});
