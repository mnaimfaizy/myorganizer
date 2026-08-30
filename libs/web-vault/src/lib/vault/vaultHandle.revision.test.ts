/**
 * Tests for Vault Handle Local Vault Revision integration.
 *
 * Verifies that saveVault() and removeVault() bump the revision to signal
 * readers that the Local Vault has been replaced (e.g. by convergence),
 * while saveEncryptedData() deliberately does NOT bump it (since it names
 * a single Vault Blob Type and goes through the sync sink instead).
 *
 * ADR 0047, #587.
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
if (!(globalThis as any).crypto?.subtle) {
  const { webcrypto } = require('crypto');
  if (!(globalThis as any).crypto) {
    (globalThis as any).crypto = {};
  }
  (globalThis as any).crypto.subtle = webcrypto.subtle;
}

// === Crypto mocking ===
let mockRandomBytesCounter = 0;

jest.mock('./crypto', () => {
  const actual = jest.requireActual('./crypto');
  return {
    ...actual,
    randomBytes: jest.fn((length: number): Uint8Array => {
      const bytes = new Uint8Array(length);
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
        const keyObj = options.key as unknown as { __mockKey?: string };
        const keyMarker = keyObj.__mockKey || 'unknown';
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
import { createLocalVaultRevision } from './localVaultRevision';
import { createVaultHandle } from './vaultHandle';

const LS_KEY_USER_A = localVaultStorageKey('user-a');

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  mockRandomBytesCounter = 0;
});

describe('createVaultHandle with revision', () => {
  describe('saveVault() bumps revision', () => {
    it('saveVault() increments revision counter', () => {
      const revision = createLocalVaultRevision();
      const handle = createVaultHandle({
        owner: 'user-a',
        revision,
      });

      expect(revision.current()).toBe(0);

      const vault: VaultStorageV1 = {
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
          iv: 'aS1i',
          ciphertext: 'Y3QtYg==',
        },
        data: {},
      };

      handle.saveVault(vault);

      expect(revision.current()).toBe(1);
    });

    it('multiple saveVault() calls each bump revision', () => {
      const revision = createLocalVaultRevision();
      const handle = createVaultHandle({
        owner: 'user-a',
        revision,
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
          iv: 'aS1h',
          ciphertext: 'Y3QtYQ==',
        },
        masterKeyWrappedWithRecoveryKey: {
          iv: 'aS1i',
          ciphertext: 'Y3QtYg==',
        },
        data: {},
      };

      handle.saveVault(vault);
      expect(revision.current()).toBe(1);

      handle.saveVault(vault);
      expect(revision.current()).toBe(2);

      handle.saveVault(vault);
      expect(revision.current()).toBe(3);
    });

    it('revision bump happens synchronously within saveVault', () => {
      const revision = createLocalVaultRevision();
      const handle = createVaultHandle({
        owner: 'user-a',
        revision,
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
          iv: 'aS1h',
          ciphertext: 'Y3QtYQ==',
        },
        masterKeyWrappedWithRecoveryKey: {
          iv: 'aS1i',
          ciphertext: 'Y3QtYg==',
        },
        data: {},
      };

      handle.saveVault(vault);
      // Assert synchronously, no await needed
      expect(revision.current()).toBe(1);
    });
  });

  describe('removeVault() bumps revision', () => {
    it('removeVault() increments revision counter', () => {
      const revision = createLocalVaultRevision();
      const handle = createVaultHandle({
        owner: 'user-a',
        revision,
      });

      // Setup: write a vault first
      const vault: VaultStorageV1 = {
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
          iv: 'aS1i',
          ciphertext: 'Y3QtYg==',
        },
        data: {},
      };
      handle.saveVault(vault);
      expect(revision.current()).toBe(1);

      // Remove and expect bump
      handle.removeVault();
      expect(revision.current()).toBe(2);
    });
  });

  describe('saveEncryptedData() does NOT bump revision', () => {
    it('saveEncryptedData() leaves revision unchanged', async () => {
      const revision = createLocalVaultRevision();
      const handle = createVaultHandle({
        owner: 'user-a',
        masterKeyBytes: new Uint8Array([1, 2, 3, 4]),
        revision,
      });

      // Initialize vault
      await handle.initialize({ passphrase: 'test-pass' });
      await handle.unlockWithPassphrase({ passphrase: 'test-pass' });

      // Manually bump revision to simulate a prior convergence/saveVault
      handle.saveVault(handle.loadVault()!);
      expect(revision.current()).toBe(1);

      const startRevision = revision.current();

      // Save encrypted data
      await handle.saveEncryptedData({
        type: 'tasks',
        value: [{ id: '1', title: 'Test task' }],
      });

      // Revision should NOT have bumped
      expect(revision.current()).toBe(startRevision);
    });

    it('multiple saveEncryptedData() calls do not bump revision', async () => {
      const revision = createLocalVaultRevision();
      const handle = createVaultHandle({
        owner: 'user-a',
        masterKeyBytes: new Uint8Array([1, 2, 3, 4]),
        revision,
      });

      await handle.initialize({ passphrase: 'test-pass' });
      await handle.unlockWithPassphrase({ passphrase: 'test-pass' });

      // Manually bump revision to simulate a prior convergence/saveVault
      handle.saveVault(handle.loadVault()!);
      const startRevision = revision.current();
      expect(startRevision).toBe(1);

      await handle.saveEncryptedData({
        type: 'tasks',
        value: [{ id: '1', title: 'Task 1' }],
      });

      await handle.saveEncryptedData({
        type: 'todos',
        value: [{ id: 'a', text: 'Todo A' }],
      });

      await handle.saveEncryptedData({
        type: 'tasks',
        value: [{ id: '1', title: 'Task 1 updated' }],
      });

      expect(revision.current()).toBe(startRevision);
    });
  });

  describe('handle without revision behaves normally', () => {
    it('saveVault() without revision does not throw', () => {
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
          iv: 'aS1h',
          ciphertext: 'Y3QtYQ==',
        },
        masterKeyWrappedWithRecoveryKey: {
          iv: 'aS1i',
          ciphertext: 'Y3QtYg==',
        },
        data: {},
      };

      expect(() => handle.saveVault(vault)).not.toThrow();
    });

    it('removeVault() without revision does not throw', () => {
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
          iv: 'aS1h',
          ciphertext: 'Y3QtYQ==',
        },
        masterKeyWrappedWithRecoveryKey: {
          iv: 'aS1i',
          ciphertext: 'Y3QtYg==',
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

      expect(() => handle.removeVault()).not.toThrow();
    });
  });

  describe('revision.bump() errors are swallowed', () => {
    it('saveVault() succeeds even when revision.bump() throws', () => {
      const revision = createLocalVaultRevision();
      const throwingRevision = {
        ...revision,
        bump: jest.fn(() => {
          throw new Error('bump failed');
        }),
      };

      const handle = createVaultHandle({
        owner: 'user-a',
        revision: throwingRevision,
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
          iv: 'aS1h',
          ciphertext: 'Y3QtYQ==',
        },
        masterKeyWrappedWithRecoveryKey: {
          iv: 'aS1i',
          ciphertext: 'Y3QtYg==',
        },
        data: {},
      };

      // Should not throw despite revision.bump() throwing
      expect(() => handle.saveVault(vault)).not.toThrow();

      // Vault should still be saved
      const stored = JSON.parse(
        localStorage.getItem(LS_KEY_USER_A) || '{}',
      ) as { owner: string; vault: VaultStorageV1 };
      expect(stored.owner).toBe('user-a');
      expect(stored.vault).toEqual(vault);
    });

    it('removeVault() succeeds even when revision.bump() throws', () => {
      const revision = createLocalVaultRevision();
      const throwingRevision = {
        ...revision,
        bump: jest.fn(() => {
          throw new Error('bump failed');
        }),
      };

      const handle = createVaultHandle({
        owner: 'user-a',
        revision: throwingRevision,
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
          iv: 'aS1h',
          ciphertext: 'Y3QtYQ==',
        },
        masterKeyWrappedWithRecoveryKey: {
          iv: 'aS1i',
          ciphertext: 'Y3QtYg==',
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

      // Should not throw despite revision.bump() throwing
      expect(() => handle.removeVault()).not.toThrow();

      // Vault should still be removed
      expect(handle.hasVault()).toBe(false);
    });
  });
});
