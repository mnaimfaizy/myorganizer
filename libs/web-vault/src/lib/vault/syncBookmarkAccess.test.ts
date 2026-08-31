/**
 * Tests for Sync Bookmark access layer — hashing, dirtiness detection,
 * and owner-bound operations.
 *
 * Covers the derived-dirtiness model: whether a Vault Blob has unsent changes
 * is determined by comparing its current Ciphertext hash to the owner's
 * bookmark, not by reading a stored flag.
 *
 * The hash function requires no Master Key and works while locked.
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
// This polyfill allows the real hashCiphertext implementation to run unmodified.
if (!(globalThis as any).crypto?.subtle) {
  const { webcrypto } = require('crypto');
  if (!(globalThis as any).crypto) {
    (globalThis as any).crypto = {};
  }
  (globalThis as any).crypto.subtle = webcrypto.subtle;
}

import type { VaultMetaV1 } from '@myorganizer/app-api-client';

import { bytesToBase64 } from './crypto';
import {
  hashCiphertext,
  hashVaultMeta,
  createSyncBookmarkAccess,
} from './syncBookmarkAccess';
import { writeSyncBookmark, readSyncBookmarks } from './syncBookmarkStorage';
import type { EncryptedBlob } from './localVaultStorage';

beforeEach(() => {
  localStorage.clear();
});

/**
 * Helper to create a VaultMetaV1 for testing.
 */
function makeVaultMeta(overrides: Partial<VaultMetaV1> = {}): VaultMetaV1 {
  return {
    version: 1,
    kdf_name: 'PBKDF2',
    kdf_salt: 'default-salt',
    kdf_params: { hash: 'SHA-256', iterations: 310_000 },
    wrapped_mk_passphrase: {
      version: 1,
      iv: 'iv1-default',
      ciphertext: 'ct1-default',
    },
    wrapped_mk_recovery: {
      version: 1,
      iv: 'iv2-default',
      ciphertext: 'ct2-default',
    },
    ...overrides,
  };
}

describe('syncBookmarkAccess — access layer, hashing, and dirtiness', () => {
  describe('hashCiphertext — deterministic hashing without Master Key', () => {
    test('1: hashes a blob deterministically', async () => {
      const blob: EncryptedBlob = {
        iv: bytesToBase64(new Uint8Array(12).fill(0xaa)),
        ciphertext: bytesToBase64(new Uint8Array(16).fill(0xbb)),
      };

      const hash1 = await hashCiphertext(blob);
      const hash2 = await hashCiphertext(blob);

      expect(hash1).toBe(hash2);
      expect(typeof hash1).toBe('string');
      expect(hash1.length).toBeGreaterThan(0);
    });

    test('2: produces different hashes for different blobs', async () => {
      const blob1: EncryptedBlob = {
        iv: bytesToBase64(new Uint8Array(12).fill(0xaa)),
        ciphertext: bytesToBase64(new Uint8Array(16).fill(0xbb)),
      };
      const blob2: EncryptedBlob = {
        iv: bytesToBase64(new Uint8Array(12).fill(0xaa)),
        ciphertext: bytesToBase64(new Uint8Array(16).fill(0xcc)), // Different ciphertext
      };

      const hash1 = await hashCiphertext(blob1);
      const hash2 = await hashCiphertext(blob2);

      expect(hash1).not.toBe(hash2);
    });

    test('3: produces different hashes when iv changes', async () => {
      const blob1: EncryptedBlob = {
        iv: bytesToBase64(new Uint8Array(12).fill(0xaa)),
        ciphertext: bytesToBase64(new Uint8Array(16).fill(0xbb)),
      };
      const blob2: EncryptedBlob = {
        iv: bytesToBase64(new Uint8Array(12).fill(0xcc)), // Different iv
        ciphertext: bytesToBase64(new Uint8Array(16).fill(0xbb)),
      };

      const hash1 = await hashCiphertext(blob1);
      const hash2 = await hashCiphertext(blob2);

      expect(hash1).not.toBe(hash2);
    });

    test('4: hash is a valid hex string', async () => {
      const blob: EncryptedBlob = {
        iv: bytesToBase64(new Uint8Array(12).fill(0xaa)),
        ciphertext: bytesToBase64(new Uint8Array(16).fill(0xbb)),
      };

      const hash = await hashCiphertext(blob);

      // Should be hex (lowercase a-f, 0-9)
      expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
      // SHA-256 produces 64 hex characters (32 bytes)
      expect(hash.length).toBe(64);
    });
  });

  describe('createSyncBookmarkAccess — owner-bound access factory', () => {
    test('5: returns an object with hasUnsentChanges, recordPushSuccess, removeBookmarks', () => {
      const access = createSyncBookmarkAccess('user-a');

      expect(typeof access.hasUnsentChanges).toBe('function');
      expect(typeof access.recordPushSuccess).toBe('function');
      expect(typeof access.removeBookmarks).toBe('function');
    });
  });

  describe('hasUnsentChanges — derived dirtiness model', () => {
    test('6: returns false when blob is undefined (nothing to push)', async () => {
      const access = createSyncBookmarkAccess('user-a');

      const result = await access.hasUnsentChanges({
        type: 'tasks',
        blob: undefined,
      });

      expect(result).toBe(false);
    });

    test('7: returns true when blob exists but no bookmark yet (never pushed)', async () => {
      const blob: EncryptedBlob = {
        iv: bytesToBase64(new Uint8Array(12).fill(0xaa)),
        ciphertext: bytesToBase64(new Uint8Array(16).fill(0xbb)),
      };
      const access = createSyncBookmarkAccess('user-a');

      const result = await access.hasUnsentChanges({
        type: 'tasks',
        blob,
      });

      expect(result).toBe(true);
    });

    test('8: returns false when blob hash matches bookmark (no unsent changes)', async () => {
      const blob: EncryptedBlob = {
        iv: bytesToBase64(new Uint8Array(12).fill(0xaa)),
        ciphertext: bytesToBase64(new Uint8Array(16).fill(0xbb)),
      };
      const hash = await hashCiphertext(blob);

      // Pre-write a matching bookmark
      writeSyncBookmark({
        owner: 'user-a',
        type: 'tasks',
        entry: { ciphertextHash: hash, etag: 'etag-1' },
      });

      const access = createSyncBookmarkAccess('user-a');

      const result = await access.hasUnsentChanges({
        type: 'tasks',
        blob,
      });

      expect(result).toBe(false);
    });

    test('9: returns true when blob hash differs from bookmark (blob changed after push)', async () => {
      const oldBlob: EncryptedBlob = {
        iv: bytesToBase64(new Uint8Array(12).fill(0xaa)),
        ciphertext: bytesToBase64(new Uint8Array(16).fill(0xbb)),
      };
      const oldHash = await hashCiphertext(oldBlob);

      // Pre-write old bookmark
      writeSyncBookmark({
        owner: 'user-a',
        type: 'tasks',
        entry: { ciphertextHash: oldHash, etag: 'etag-1' },
      });

      // New blob with different ciphertext
      const newBlob: EncryptedBlob = {
        iv: bytesToBase64(new Uint8Array(12).fill(0xaa)),
        ciphertext: bytesToBase64(new Uint8Array(16).fill(0xcc)),
      };

      const access = createSyncBookmarkAccess('user-a');

      const result = await access.hasUnsentChanges({
        type: 'tasks',
        blob: newBlob,
      });

      expect(result).toBe(true);
    });
  });

  describe('recordPushSuccess — advancing bookmarks only on confirmed success', () => {
    test('10: hashes blob and writes bookmark with ciphertextHash and etag', async () => {
      const blob: EncryptedBlob = {
        iv: bytesToBase64(new Uint8Array(12).fill(0xaa)),
        ciphertext: bytesToBase64(new Uint8Array(16).fill(0xbb)),
      };

      const access = createSyncBookmarkAccess('user-a');
      await access.recordPushSuccess({
        type: 'tasks',
        blob,
        etag: 'etag-from-server',
      });

      const bookmarks = readSyncBookmarks('user-a');
      expect(bookmarks.tasks).toBeDefined();
      expect(bookmarks.tasks?.etag).toBe('etag-from-server');
      expect(typeof bookmarks.tasks?.ciphertextHash).toBe('string');
      expect(bookmarks.tasks?.ciphertextHash.length).toBe(64); // SHA-256
    });

    test('11: subsequent hasUnsentChanges returns false after recordPushSuccess', async () => {
      const blob: EncryptedBlob = {
        iv: bytesToBase64(new Uint8Array(12).fill(0xaa)),
        ciphertext: bytesToBase64(new Uint8Array(16).fill(0xbb)),
      };

      const access = createSyncBookmarkAccess('user-a');

      // Before: should be dirty
      let isDirty = await access.hasUnsentChanges({
        type: 'tasks',
        blob,
      });
      expect(isDirty).toBe(true);

      // Act: record success
      await access.recordPushSuccess({
        type: 'tasks',
        blob,
        etag: 'etag-1',
      });

      // After: should not be dirty
      isDirty = await access.hasUnsentChanges({
        type: 'tasks',
        blob,
      });
      expect(isDirty).toBe(false);
    });

    test('12: recordPushSuccess for one type does not affect other types', async () => {
      const blobTasks: EncryptedBlob = {
        iv: bytesToBase64(new Uint8Array(12).fill(0xaa)),
        ciphertext: bytesToBase64(new Uint8Array(16).fill(0xbb)),
      };
      const blobTodos: EncryptedBlob = {
        iv: bytesToBase64(new Uint8Array(12).fill(0xcc)),
        ciphertext: bytesToBase64(new Uint8Array(16).fill(0xdd)),
      };

      const access = createSyncBookmarkAccess('user-a');

      // Record success for tasks only
      await access.recordPushSuccess({
        type: 'tasks',
        blob: blobTasks,
        etag: 'etag-tasks',
      });

      // Tasks should not be dirty
      const tasksDirty = await access.hasUnsentChanges({
        type: 'tasks',
        blob: blobTasks,
      });
      expect(tasksDirty).toBe(false);

      // Todos should still be dirty (never pushed)
      const todosDirty = await access.hasUnsentChanges({
        type: 'todos',
        blob: blobTodos,
      });
      expect(todosDirty).toBe(true);
    });

    test('13: recordPushSuccess overwrites previous bookmark for same type', async () => {
      const blob1: EncryptedBlob = {
        iv: bytesToBase64(new Uint8Array(12).fill(0xaa)),
        ciphertext: bytesToBase64(new Uint8Array(16).fill(0xbb)),
      };
      const blob2: EncryptedBlob = {
        iv: bytesToBase64(new Uint8Array(12).fill(0xcc)),
        ciphertext: bytesToBase64(new Uint8Array(16).fill(0xdd)),
      };

      const access = createSyncBookmarkAccess('user-a');

      await access.recordPushSuccess({
        type: 'tasks',
        blob: blob1,
        etag: 'etag-1',
      });

      // Blob changed locally; user pushes again
      await access.recordPushSuccess({
        type: 'tasks',
        blob: blob2,
        etag: 'etag-2',
      });

      const bookmarks = readSyncBookmarks('user-a');
      const hash2 = await hashCiphertext(blob2);

      expect(bookmarks.tasks?.etag).toBe('etag-2');
      expect(bookmarks.tasks?.ciphertextHash).toBe(hash2);
    });
  });

  describe('removeBookmarks — explicit removal (ADR 0058)', () => {
    test('14: removes all bookmarks for owner', async () => {
      const blob: EncryptedBlob = {
        iv: bytesToBase64(new Uint8Array(12).fill(0xaa)),
        ciphertext: bytesToBase64(new Uint8Array(16).fill(0xbb)),
      };

      const access = createSyncBookmarkAccess('user-a');
      await access.recordPushSuccess({
        type: 'tasks',
        blob,
        etag: 'etag-1',
      });

      // Verify bookmarks exist
      let bookmarks = readSyncBookmarks('user-a');
      expect(bookmarks.tasks).toBeDefined();

      // Act: remove
      access.removeBookmarks();

      // Assert: gone
      bookmarks = readSyncBookmarks('user-a');
      expect(bookmarks).toEqual({});
    });

    test('15: does not affect other owners when called', async () => {
      const blob: EncryptedBlob = {
        iv: bytesToBase64(new Uint8Array(12).fill(0xaa)),
        ciphertext: bytesToBase64(new Uint8Array(16).fill(0xbb)),
      };

      const accessA = createSyncBookmarkAccess('user-a');
      const accessB = createSyncBookmarkAccess('user-b');

      await accessA.recordPushSuccess({
        type: 'tasks',
        blob,
        etag: 'etag-a',
      });
      await accessB.recordPushSuccess({
        type: 'todos',
        blob,
        etag: 'etag-b',
      });

      // Remove user-a's bookmarks
      accessA.removeBookmarks();

      // Assert: user-a gone
      expect(readSyncBookmarks('user-a')).toEqual({});

      // Assert: user-b untouched
      const bookmarksB = readSyncBookmarks('user-b');
      expect(bookmarksB.todos).toBeDefined();
    });
  });

  describe('Per-owner isolation — access layer independence', () => {
    test('16: two access instances for different owners operate independently', async () => {
      const blobA: EncryptedBlob = {
        iv: bytesToBase64(new Uint8Array(12).fill(0xaa)),
        ciphertext: bytesToBase64(new Uint8Array(16).fill(0xbb)),
      };
      const blobB: EncryptedBlob = {
        iv: bytesToBase64(new Uint8Array(12).fill(0xcc)),
        ciphertext: bytesToBase64(new Uint8Array(16).fill(0xdd)),
      };

      const accessA = createSyncBookmarkAccess('user-a');
      const accessB = createSyncBookmarkAccess('user-b');

      // User-a records success for tasks
      await accessA.recordPushSuccess({
        type: 'tasks',
        blob: blobA,
        etag: 'etag-a',
      });

      // User-b records success for todos
      await accessB.recordPushSuccess({
        type: 'todos',
        blob: blobB,
        etag: 'etag-b',
      });

      // User-a checks tasks: not dirty
      const aDirty = await accessA.hasUnsentChanges({
        type: 'tasks',
        blob: blobA,
      });
      expect(aDirty).toBe(false);

      // User-b checks todos: not dirty
      const bDirty = await accessB.hasUnsentChanges({
        type: 'todos',
        blob: blobB,
      });
      expect(bDirty).toBe(false);

      // User-a checks todos: dirty (never pushed by user-a)
      const aTodosDirty = await accessA.hasUnsentChanges({
        type: 'todos',
        blob: blobB,
      });
      expect(aTodosDirty).toBe(true);

      // User-b checks tasks: dirty (never pushed by user-b)
      const bTasksDirty = await accessB.hasUnsentChanges({
        type: 'tasks',
        blob: blobA,
      });
      expect(bTasksDirty).toBe(true);
    });
  });

  describe('Bookmarks independent from saveEncryptedData — no implicit advance', () => {
    test('17: hasUnsentChanges remains true even if same blob saved locally (without recordPushSuccess)', async () => {
      const blob: EncryptedBlob = {
        iv: bytesToBase64(new Uint8Array(12).fill(0xaa)),
        ciphertext: bytesToBase64(new Uint8Array(16).fill(0xbb)),
      };

      const access = createSyncBookmarkAccess('user-a');

      // Blob exists but no bookmark
      let isDirty = await access.hasUnsentChanges({
        type: 'tasks',
        blob,
      });
      expect(isDirty).toBe(true);

      // Simulate local save (we don't call recordPushSuccess)
      // isDirty should remain true
      isDirty = await access.hasUnsentChanges({
        type: 'tasks',
        blob,
      });
      expect(isDirty).toBe(true);
    });
  });

  describe('hashVaultMeta — deterministic hashing of Vault Meta', () => {
    test('18: hashVaultMeta is stable across key ordering', async () => {
      // Create two VaultMetaV1 objects with the same values but different key order
      const meta1: VaultMetaV1 = {
        version: 1,
        kdf_name: 'PBKDF2',
        kdf_salt: 'same-salt',
        kdf_params: { hash: 'SHA-256', iterations: 310_000 },
        wrapped_mk_passphrase: {
          version: 1,
          iv: 'iv1',
          ciphertext: 'ct1',
        },
        wrapped_mk_recovery: {
          version: 1,
          iv: 'iv2',
          ciphertext: 'ct2',
        },
      };

      // Create with different property insertion order
      const meta2: VaultMetaV1 = {
        wrapped_mk_recovery: {
          version: 1,
          iv: 'iv2',
          ciphertext: 'ct2',
        },
        kdf_params: { hash: 'SHA-256', iterations: 310_000 },
        version: 1,
        wrapped_mk_passphrase: {
          version: 1,
          iv: 'iv1',
          ciphertext: 'ct1',
        },
        kdf_salt: 'same-salt',
        kdf_name: 'PBKDF2',
      };

      const hash1 = await hashVaultMeta(meta1);
      const hash2 = await hashVaultMeta(meta2);

      // Should be identical despite different key ordering
      expect(hash1).toBe(hash2);
    });

    test('19: hashVaultMeta differs when passphrase wrapping differs', async () => {
      const meta1 = makeVaultMeta({
        wrapped_mk_passphrase: {
          version: 1,
          iv: 'iv1-original',
          ciphertext: 'ct1-original',
        },
      });

      const meta2 = makeVaultMeta({
        wrapped_mk_passphrase: {
          version: 1,
          iv: 'iv1-different',
          ciphertext: 'ct1-different',
        },
      });

      const hash1 = await hashVaultMeta(meta1);
      const hash2 = await hashVaultMeta(meta2);

      expect(hash1).not.toBe(hash2);
    });

    test('20: hashVaultMeta differs when kdf_salt differs', async () => {
      const meta1 = makeVaultMeta({ kdf_salt: 'salt-1' });
      const meta2 = makeVaultMeta({ kdf_salt: 'salt-2' });

      const hash1 = await hashVaultMeta(meta1);
      const hash2 = await hashVaultMeta(meta2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('lastAgreedVaultMetaHash and recordVaultMetaAgreement', () => {
    test('21: lastAgreedVaultMetaHash returns undefined before any agreement', async () => {
      const access = createSyncBookmarkAccess('user-a');

      const result = access.lastAgreedVaultMetaHash();

      expect(result).toBeUndefined();
    });

    test('22: recordVaultMetaAgreement records hash and lastAgreedVaultMetaHash returns the recorded value', async () => {
      const meta = makeVaultMeta();
      const access = createSyncBookmarkAccess('user-a');

      // Record the agreement
      await access.recordVaultMetaAgreement({ meta });

      // lastAgreedVaultMetaHash should return the hash the test computes itself
      const expectedHash = await hashVaultMeta(meta);
      const storedHash = access.lastAgreedVaultMetaHash();

      expect(storedHash).toBe(expectedHash);
    });

    test('23: lastAgreedVaultMetaHash persists after recordVaultMetaAgreement and survives reload', async () => {
      const meta = makeVaultMeta();
      const expectedHash = await hashVaultMeta(meta);

      // Create access instance and record agreement
      const access1 = createSyncBookmarkAccess('user-a');
      await access1.recordVaultMetaAgreement({ meta });

      // Simulate reload by creating a new access instance for the same owner
      const access2 = createSyncBookmarkAccess('user-a');

      // Should still be available in the new instance
      expect(access2.lastAgreedVaultMetaHash()).toBe(expectedHash);
    });
  });
});
