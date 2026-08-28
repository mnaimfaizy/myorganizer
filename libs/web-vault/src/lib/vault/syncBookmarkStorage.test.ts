/**
 * Tests for Sync Bookmark storage primitives.
 *
 * Covers storage resolution, per-owner isolation, removal semantics, owner
 * assertion, and corrupted-entry handling.
 *
 * See ADR 0056 for the distinction between Sync Bookmarks (replaceable
 * pointers, loose write guards) and Local Vault entries (irreplaceable data,
 * strict write guards).
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

import {
  SYNC_BOOKMARK_STORAGE_KEY,
  SYNC_BOOKMARK_RECORD_VERSION,
  syncBookmarkStorageKey,
  readSyncBookmarks,
  writeSyncBookmark,
  removeSyncBookmarks,
  type SyncBookmarkEntry,
  type SyncBookmarkRecord,
} from './syncBookmarkStorage';

beforeEach(() => {
  localStorage.clear();
});

describe('syncBookmarkStorage — Sync Bookmark storage primitives', () => {
  describe('syncBookmarkStorageKey — key composition and owner guard', () => {
    test('1: returns correct prefixed key for a valid owner', () => {
      const key = syncBookmarkStorageKey('user-a');
      expect(key).toBe(`${SYNC_BOOKMARK_STORAGE_KEY}:user-a`);
    });

    test('2a: throws for empty string owner', () => {
      expect(() => syncBookmarkStorageKey('')).toThrow(
        'A Sync Bookmark cannot be resolved without an owner',
      );
    });

    test('2b: throws for whitespace-only owner', () => {
      expect(() => syncBookmarkStorageKey('   ')).toThrow(
        'A Sync Bookmark cannot be resolved without an owner',
      );
    });
  });

  describe('readSyncBookmarks — read and resolution', () => {
    test('3: returns empty object when owner has no bookmarks stored', () => {
      const result = readSyncBookmarks('user-a');
      expect(result).toEqual({});
    });

    test('4: returns bookmarks for owner when they exist', () => {
      const entry: SyncBookmarkEntry = {
        ciphertextHash: 'hash1',
        etag: 'etag1',
      };
      const record: SyncBookmarkRecord = {
        version: SYNC_BOOKMARK_RECORD_VERSION,
        owner: 'user-a',
        bookmarks: { tasks: entry },
      };
      localStorage.setItem(
        syncBookmarkStorageKey('user-a'),
        JSON.stringify(record),
      );

      const result = readSyncBookmarks('user-a');
      expect(result).toEqual({ tasks: entry });
    });

    test('5: returns empty object when entry names different owner (rejected)', () => {
      // Manually write an entry under user-a's key that names user-b
      const record: SyncBookmarkRecord = {
        version: SYNC_BOOKMARK_RECORD_VERSION,
        owner: 'user-b', // Wrong owner!
        bookmarks: { tasks: { ciphertextHash: 'hash1', etag: 'etag1' } },
      };
      localStorage.setItem(
        syncBookmarkStorageKey('user-a'),
        JSON.stringify(record),
      );

      const result = readSyncBookmarks('user-a');
      expect(result).toEqual({});
    });

    test('6: returns empty object when stored JSON is corrupt', () => {
      localStorage.setItem(syncBookmarkStorageKey('user-a'), '{not json');

      const result = readSyncBookmarks('user-a');
      expect(result).toEqual({});
    });

    test('7: returns empty object when stored version is wrong', () => {
      const record = {
        version: 2, // Wrong version
        owner: 'user-a',
        bookmarks: { tasks: { ciphertextHash: 'hash1', etag: 'etag1' } },
      };
      localStorage.setItem(
        syncBookmarkStorageKey('user-a'),
        JSON.stringify(record),
      );

      const result = readSyncBookmarks('user-a');
      expect(result).toEqual({});
    });

    test('8: throws for empty owner', () => {
      expect(() => readSyncBookmarks('')).toThrow(
        'A Sync Bookmark cannot be resolved without an owner',
      );
    });

    test('9: throws for whitespace-only owner', () => {
      expect(() => readSyncBookmarks('   ')).toThrow(
        'A Sync Bookmark cannot be resolved without an owner',
      );
    });
  });

  describe('writeSyncBookmark — write and merge semantics', () => {
    test('10: writes a new bookmark entry for a type', () => {
      const entry: SyncBookmarkEntry = {
        ciphertextHash: 'hash1',
        etag: 'etag1',
      };
      writeSyncBookmark({
        owner: 'user-a',
        type: 'tasks',
        entry,
      });

      const result = readSyncBookmarks('user-a');
      expect(result.tasks).toEqual(entry);
    });

    test('11: merges new bookmark into existing bookmarks for same owner', () => {
      const entry1: SyncBookmarkEntry = {
        ciphertextHash: 'hash1',
        etag: 'etag1',
      };
      const entry2: SyncBookmarkEntry = {
        ciphertextHash: 'hash2',
        etag: 'etag2',
      };

      writeSyncBookmark({
        owner: 'user-a',
        type: 'tasks',
        entry: entry1,
      });
      writeSyncBookmark({
        owner: 'user-a',
        type: 'todos',
        entry: entry2,
      });

      const result = readSyncBookmarks('user-a');
      expect(result.tasks).toEqual(entry1);
      expect(result.todos).toEqual(entry2);
    });

    test('12: overwrites bookmark when type already exists', () => {
      const entry1: SyncBookmarkEntry = {
        ciphertextHash: 'hash1',
        etag: 'etag1',
      };
      const entry2: SyncBookmarkEntry = {
        ciphertextHash: 'hash2-new',
        etag: 'etag2-new',
      };

      writeSyncBookmark({
        owner: 'user-a',
        type: 'tasks',
        entry: entry1,
      });
      writeSyncBookmark({
        owner: 'user-a',
        type: 'tasks',
        entry: entry2,
      });

      const result = readSyncBookmarks('user-a');
      expect(result.tasks).toEqual(entry2);
      expect(result.tasks).not.toEqual(entry1);
    });

    test('13: silently overwrites mis-keyed entry without throwing (unlike Local Vault)', () => {
      // Pre-write a mis-keyed entry (names different owner)
      const misKeyedRecord: SyncBookmarkRecord = {
        version: SYNC_BOOKMARK_RECORD_VERSION,
        owner: 'user-b',
        bookmarks: { tasks: { ciphertextHash: 'old-hash', etag: 'old-etag' } },
      };
      localStorage.setItem(
        syncBookmarkStorageKey('user-a'),
        JSON.stringify(misKeyedRecord),
      );

      // Act: write as user-a (should not throw)
      const entry: SyncBookmarkEntry = {
        ciphertextHash: 'new-hash',
        etag: 'new-etag',
      };
      expect(() => {
        writeSyncBookmark({
          owner: 'user-a',
          type: 'tasks',
          entry,
        });
      }).not.toThrow();

      // Assert: entry was overwritten
      const result = readSyncBookmarks('user-a');
      expect(result.tasks).toEqual(entry);
      expect(result.tasks?.ciphertextHash).toBe('new-hash');
    });

    test('14: throws for empty owner', () => {
      expect(() => {
        writeSyncBookmark({
          owner: '',
          type: 'tasks',
          entry: { ciphertextHash: 'hash1', etag: 'etag1' },
        });
      }).toThrow('A Sync Bookmark cannot be resolved without an owner');
    });

    test('15: throws for whitespace-only owner', () => {
      expect(() => {
        writeSyncBookmark({
          owner: '   ',
          type: 'tasks',
          entry: { ciphertextHash: 'hash1', etag: 'etag1' },
        });
      }).toThrow('A Sync Bookmark cannot be resolved without an owner');
    });
  });

  describe('removeSyncBookmarks — removal and per-owner isolation', () => {
    test('16: removes the entry for the given owner', () => {
      const entry: SyncBookmarkEntry = {
        ciphertextHash: 'hash1',
        etag: 'etag1',
      };
      writeSyncBookmark({
        owner: 'user-a',
        type: 'tasks',
        entry,
      });

      expect(readSyncBookmarks('user-a')).not.toEqual({});

      // Act: remove
      removeSyncBookmarks('user-a');

      // Assert: gone
      expect(readSyncBookmarks('user-a')).toEqual({});
    });

    test('17: does not affect another owner when one owner is removed', () => {
      const entryA: SyncBookmarkEntry = {
        ciphertextHash: 'hash-a',
        etag: 'etag-a',
      };
      const entryB: SyncBookmarkEntry = {
        ciphertextHash: 'hash-b',
        etag: 'etag-b',
      };

      writeSyncBookmark({
        owner: 'user-a',
        type: 'tasks',
        entry: entryA,
      });
      writeSyncBookmark({
        owner: 'user-b',
        type: 'todos',
        entry: entryB,
      });

      // Act: remove only user-a
      removeSyncBookmarks('user-a');

      // Assert: user-a is gone
      expect(readSyncBookmarks('user-a')).toEqual({});

      // Assert: user-b is untouched
      expect(readSyncBookmarks('user-b')).toEqual({ todos: entryB });
    });

    test('18: is a safe no-op when owner has no entry', () => {
      expect(() => {
        removeSyncBookmarks('user-a');
      }).not.toThrow();

      expect(readSyncBookmarks('user-a')).toEqual({});
    });

    test('19: throws for empty owner', () => {
      expect(() => removeSyncBookmarks('')).toThrow(
        'A Sync Bookmark cannot be resolved without an owner',
      );
    });

    test('20: throws for whitespace-only owner', () => {
      expect(() => removeSyncBookmarks('   ')).toThrow(
        'A Sync Bookmark cannot be resolved without an owner',
      );
    });
  });

  describe('Per-owner isolation — localStorage key assertion', () => {
    test('21: writing for user-a does not appear under user-b key', () => {
      const entry: SyncBookmarkEntry = {
        ciphertextHash: 'hash-a',
        etag: 'etag-a',
      };

      writeSyncBookmark({
        owner: 'user-a',
        type: 'tasks',
        entry,
      });

      // Assert: user-a key exists
      expect(
        localStorage.getItem(syncBookmarkStorageKey('user-a')),
      ).not.toBeNull();

      // Assert: user-b key does not exist
      expect(localStorage.getItem(syncBookmarkStorageKey('user-b'))).toBeNull();
    });

    test('22: direct localStorage check confirms separate keys for separate owners', () => {
      const entryA: SyncBookmarkEntry = {
        ciphertextHash: 'hash-a',
        etag: 'etag-a',
      };
      const entryB: SyncBookmarkEntry = {
        ciphertextHash: 'hash-b',
        etag: 'etag-b',
      };

      writeSyncBookmark({
        owner: 'user-a',
        type: 'tasks',
        entry: entryA,
      });
      writeSyncBookmark({
        owner: 'user-b',
        type: 'todos',
        entry: entryB,
      });

      // Both keys should exist separately in localStorage
      const keyA = localStorage.getItem(syncBookmarkStorageKey('user-a'));
      const keyB = localStorage.getItem(syncBookmarkStorageKey('user-b'));

      expect(keyA).not.toBeNull();
      expect(keyB).not.toBeNull();
      expect(keyA).not.toBe(keyB);

      // Verify each contains the correct owner
      const recordA = JSON.parse(keyA || '{}') as SyncBookmarkRecord;
      const recordB = JSON.parse(keyB || '{}') as SyncBookmarkRecord;

      expect(recordA.owner).toBe('user-a');
      expect(recordB.owner).toBe('user-b');
    });

    test('23: removing user-a bookmarks leaves user-b key untouched in localStorage', () => {
      const entryA: SyncBookmarkEntry = {
        ciphertextHash: 'hash-a',
        etag: 'etag-a',
      };
      const entryB: SyncBookmarkEntry = {
        ciphertextHash: 'hash-b',
        etag: 'etag-b',
      };

      writeSyncBookmark({
        owner: 'user-a',
        type: 'tasks',
        entry: entryA,
      });
      writeSyncBookmark({
        owner: 'user-b',
        type: 'todos',
        entry: entryB,
      });

      const userBBefore = localStorage.getItem(
        syncBookmarkStorageKey('user-b'),
      );

      // Act: remove user-a only
      removeSyncBookmarks('user-a');

      // Assert: user-a key gone
      expect(localStorage.getItem(syncBookmarkStorageKey('user-a'))).toBeNull();

      // Assert: user-b key byte-identical
      const userBAfter = localStorage.getItem(syncBookmarkStorageKey('user-b'));
      expect(userBAfter).toBe(userBBefore);
      expect(userBAfter).not.toBeNull();
    });
  });

  describe('Reload survival — persistence across separate reads', () => {
    test('24: bookmark written is accessible via fresh read (simulating reload)', () => {
      const entry: SyncBookmarkEntry = {
        ciphertextHash: 'hash-after-push',
        etag: 'etag-from-server',
      };

      // Write a bookmark
      writeSyncBookmark({
        owner: 'user-a',
        type: 'tasks',
        entry,
      });

      // Simulate reload by reading via fresh function call (not cache)
      const result = readSyncBookmarks('user-a');

      expect(result.tasks).toEqual(entry);
      expect(result.tasks?.ciphertextHash).toBe('hash-after-push');
      expect(result.tasks?.etag).toBe('etag-from-server');
    });

    test('25: multiple types persisted and reloaded correctly', () => {
      const entryTasks: SyncBookmarkEntry = {
        ciphertextHash: 'hash-tasks',
        etag: 'etag-tasks',
      };
      const entryTodos: SyncBookmarkEntry = {
        ciphertextHash: 'hash-todos',
        etag: 'etag-todos',
      };

      writeSyncBookmark({
        owner: 'user-a',
        type: 'tasks',
        entry: entryTasks,
      });
      writeSyncBookmark({
        owner: 'user-a',
        type: 'todos',
        entry: entryTodos,
      });

      // Simulate reload
      const result = readSyncBookmarks('user-a');

      expect(result.tasks).toEqual(entryTasks);
      expect(result.todos).toEqual(entryTodos);
    });
  });
});
