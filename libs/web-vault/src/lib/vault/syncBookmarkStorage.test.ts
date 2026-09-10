/**
 * Tests for Sync Bookmark storage primitives.
 *
 * Covers storage resolution, per-owner isolation, removal semantics, owner
 * assertion, and corrupted-entry handling.
 *
 * See ADR 0058 for the distinction between Sync Bookmarks (replaceable
 * pointers, loose write guards) and Local Vault entries (irreplaceable data,
 * strict write guards).
 */

import {
  SYNC_BOOKMARK_STORAGE_KEY,
  SYNC_BOOKMARK_RECORD_VERSION,
  syncBookmarkStorageKey,
  readSyncBookmarks,
  readVaultMetaBookmark,
  writeSyncBookmark,
  writeVaultMetaBookmark,
  removeSyncBookmarks,
  readObservedVaultIdentity,
  writeObservedVaultIdentity,
  type SyncBookmarkEntry,
  type SyncBookmarkRecord,
  type VaultMetaBookmarkEntry,
  type ObservedVaultIdentityEntry,
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

  describe('readObservedVaultIdentity and writeObservedVaultIdentity — Observed Vault Identity storage', () => {
    test('33: readObservedVaultIdentity returns undefined for owner with no record at all', () => {
      const result = readObservedVaultIdentity('user-a');
      expect(result).toBeUndefined();
    });

    test('34: readObservedVaultIdentity returns undefined for owner whose record has bookmarks but no observedVaultIdentity', () => {
      // Pre-write a record with only sync bookmarks and meta bookmark, no observed identity
      const record: SyncBookmarkRecord = {
        version: SYNC_BOOKMARK_RECORD_VERSION,
        owner: 'user-a',
        bookmarks: { tasks: { ciphertextHash: 'hash1', etag: 'etag1' } },
        metaBookmark: { metaHash: 'meta-hash-1' },
        // observedVaultIdentity is deliberately absent
      };
      localStorage.setItem(
        syncBookmarkStorageKey('user-a'),
        JSON.stringify(record),
      );

      const result = readObservedVaultIdentity('user-a');
      expect(result).toBeUndefined();
    });

    test('35: writeObservedVaultIdentity then readObservedVaultIdentity round-trips the entry', () => {
      const entry: ObservedVaultIdentityEntry = {
        identity: 'vault-identity-salt-abc123',
      };

      writeObservedVaultIdentity({
        owner: 'user-a',
        entry,
      });

      const result = readObservedVaultIdentity('user-a');
      expect(result).toEqual(entry);
      expect(result?.identity).toBe('vault-identity-salt-abc123');
    });

    test('36: writeObservedVaultIdentity preserves existing sync bookmarks', () => {
      // Write a Sync Bookmark first
      const syncEntry: SyncBookmarkEntry = {
        ciphertextHash: 'hash-1',
        etag: 'etag-1',
      };
      writeSyncBookmark({
        owner: 'user-a',
        type: 'tasks',
        entry: syncEntry,
      });

      // Verify Sync Bookmark is present
      expect(readSyncBookmarks('user-a').tasks).toEqual(syncEntry);

      // Now write an Observed Vault Identity
      const identityEntry: ObservedVaultIdentityEntry = {
        identity: 'salt-value-1',
      };
      writeObservedVaultIdentity({
        owner: 'user-a',
        entry: identityEntry,
      });

      // Assert: Sync Bookmark still exists and is unchanged
      expect(readSyncBookmarks('user-a').tasks).toEqual(syncEntry);
      // Assert: Observed Vault Identity also exists
      expect(readObservedVaultIdentity('user-a')).toEqual(identityEntry);
    });

    test('37: writeObservedVaultIdentity preserves existing Vault Meta Bookmark', () => {
      // Write a Vault Meta Bookmark first
      const metaEntry: VaultMetaBookmarkEntry = {
        metaHash: 'meta-hash-1',
      };
      writeVaultMetaBookmark({
        owner: 'user-a',
        entry: metaEntry,
      });

      // Verify Vault Meta Bookmark is present
      expect(readVaultMetaBookmark('user-a')).toEqual(metaEntry);

      // Now write an Observed Vault Identity
      const identityEntry: ObservedVaultIdentityEntry = {
        identity: 'salt-value-1',
      };
      writeObservedVaultIdentity({
        owner: 'user-a',
        entry: identityEntry,
      });

      // Assert: Vault Meta Bookmark still exists and is unchanged
      expect(readVaultMetaBookmark('user-a')).toEqual(metaEntry);
      // Assert: Observed Vault Identity also exists
      expect(readObservedVaultIdentity('user-a')).toEqual(identityEntry);
    });

    test('38: writeSyncBookmark preserves existing Observed Vault Identity', () => {
      // Write an Observed Vault Identity first
      const identityEntry: ObservedVaultIdentityEntry = {
        identity: 'salt-value-1',
      };
      writeObservedVaultIdentity({
        owner: 'user-a',
        entry: identityEntry,
      });

      // Verify Observed Vault Identity is present
      expect(readObservedVaultIdentity('user-a')).toEqual(identityEntry);

      // Now write a Sync Bookmark
      const syncEntry: SyncBookmarkEntry = {
        ciphertextHash: 'hash-1',
        etag: 'etag-1',
      };
      writeSyncBookmark({
        owner: 'user-a',
        type: 'tasks',
        entry: syncEntry,
      });

      // Assert: Observed Vault Identity still exists and is unchanged
      expect(readObservedVaultIdentity('user-a')).toEqual(identityEntry);
      // Assert: Sync Bookmark also exists
      expect(readSyncBookmarks('user-a').tasks).toEqual(syncEntry);
    });

    test('39: writeVaultMetaBookmark preserves existing Observed Vault Identity', () => {
      // Write an Observed Vault Identity first
      const identityEntry: ObservedVaultIdentityEntry = {
        identity: 'salt-value-1',
      };
      writeObservedVaultIdentity({
        owner: 'user-a',
        entry: identityEntry,
      });

      // Verify Observed Vault Identity is present
      expect(readObservedVaultIdentity('user-a')).toEqual(identityEntry);

      // Now write a Vault Meta Bookmark
      const metaEntry: VaultMetaBookmarkEntry = {
        metaHash: 'meta-hash-1',
      };
      writeVaultMetaBookmark({
        owner: 'user-a',
        entry: metaEntry,
      });

      // Assert: Observed Vault Identity still exists and is unchanged
      expect(readObservedVaultIdentity('user-a')).toEqual(identityEntry);
      // Assert: Vault Meta Bookmark also exists
      expect(readVaultMetaBookmark('user-a')).toEqual(metaEntry);
    });

    test('40: removeSyncBookmarks removes the Observed Vault Identity while leaving other owners untouched', () => {
      const identityA: ObservedVaultIdentityEntry = {
        identity: 'salt-a',
      };
      const identityB: ObservedVaultIdentityEntry = {
        identity: 'salt-b',
      };

      writeObservedVaultIdentity({
        owner: 'user-a',
        entry: identityA,
      });
      writeObservedVaultIdentity({
        owner: 'user-b',
        entry: identityB,
      });

      // Also add sync bookmarks to user-b to verify removal is complete
      writeSyncBookmark({
        owner: 'user-b',
        type: 'tasks',
        entry: { ciphertextHash: 'hash-b', etag: 'etag-b' },
      });

      // Act: remove user-a's bookmarks
      removeSyncBookmarks('user-a');

      // Assert: user-a's Observed Vault Identity is gone
      expect(readObservedVaultIdentity('user-a')).toBeUndefined();
      // Assert: user-a's sync bookmarks are gone
      expect(readSyncBookmarks('user-a')).toEqual({});
      // Assert: user-b's Observed Vault Identity is still present and unchanged
      expect(readObservedVaultIdentity('user-b')).toEqual(identityB);
      // Assert: user-b's sync bookmarks are still present
      expect(readSyncBookmarks('user-b').tasks).toBeDefined();
    });

    test('41: owner isolation - Observed Vault Identity written for user-a is not visible to user-b', () => {
      const entryA: ObservedVaultIdentityEntry = {
        identity: 'salt-a',
      };
      const entryB: ObservedVaultIdentityEntry = {
        identity: 'salt-b',
      };

      writeObservedVaultIdentity({
        owner: 'user-a',
        entry: entryA,
      });
      writeObservedVaultIdentity({
        owner: 'user-b',
        entry: entryB,
      });

      // Assert: user-a's Observed Vault Identity is not visible to user-b
      expect(readObservedVaultIdentity('user-a')).toEqual(entryA);
      expect(readObservedVaultIdentity('user-b')).toEqual(entryB);
      expect(readObservedVaultIdentity('user-b')).not.toEqual(entryA);
    });

    test('42: readObservedVaultIdentity returns undefined for corrupted entry, and writeObservedVaultIdentity silently overwrites it without throwing', () => {
      // Pre-write a corrupted (malformed JSON) entry under user-a's key
      localStorage.setItem(syncBookmarkStorageKey('user-a'), '{not json');

      // Part 1: read should return undefined, not throw
      const readResult = readObservedVaultIdentity('user-a');
      expect(readResult).toBeUndefined();

      // Part 2: write should not throw
      const identityEntry: ObservedVaultIdentityEntry = {
        identity: 'vault-salt-post-corrupt',
      };
      expect(() => {
        writeObservedVaultIdentity({
          owner: 'user-a',
          entry: identityEntry,
        });
      }).not.toThrow();

      // Part 3: verify the corrupted entry was overwritten
      const newReadResult = readObservedVaultIdentity('user-a');
      expect(newReadResult).toEqual(identityEntry);
      expect(newReadResult?.identity).toBe('vault-salt-post-corrupt');
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

  describe('readVaultMetaBookmark and writeVaultMetaBookmark — Vault Meta Bookmark storage', () => {
    test('26: readVaultMetaBookmark returns undefined for owner with no record at all', () => {
      const result = readVaultMetaBookmark('user-a');
      expect(result).toBeUndefined();
    });

    test('27: readVaultMetaBookmark returns undefined for owner whose record has bookmarks but no metaBookmark', () => {
      // Pre-write a record with only sync bookmarks, no Vault Meta Bookmark
      const record: SyncBookmarkRecord = {
        version: SYNC_BOOKMARK_RECORD_VERSION,
        owner: 'user-a',
        bookmarks: { tasks: { ciphertextHash: 'hash1', etag: 'etag1' } },
        // metaBookmark is deliberately absent
      };
      localStorage.setItem(
        syncBookmarkStorageKey('user-a'),
        JSON.stringify(record),
      );

      const result = readVaultMetaBookmark('user-a');
      expect(result).toBeUndefined();
    });

    test('28: writeVaultMetaBookmark then readVaultMetaBookmark round-trips the entry', () => {
      const entry: VaultMetaBookmarkEntry = {
        metaHash: 'meta-hash-value-1',
      };

      writeVaultMetaBookmark({
        owner: 'user-a',
        entry,
      });

      const result = readVaultMetaBookmark('user-a');
      expect(result).toEqual(entry);
      expect(result?.metaHash).toBe('meta-hash-value-1');
    });

    test('29: ADR 0058 amendment - writeVaultMetaBookmark preserves existing sync bookmarks when writeSyncBookmark is called afterwards', () => {
      // Write a Vault Meta Bookmark first
      const metaEntry: VaultMetaBookmarkEntry = {
        metaHash: 'meta-hash-1',
      };
      writeVaultMetaBookmark({
        owner: 'user-a',
        entry: metaEntry,
      });

      // Verify Vault Meta Bookmark is present
      expect(readVaultMetaBookmark('user-a')).toEqual(metaEntry);

      // Now write a Sync Bookmark for a Vault Blob Type
      const syncEntry: SyncBookmarkEntry = {
        ciphertextHash: 'hash-1',
        etag: 'etag-1',
      };
      writeSyncBookmark({
        owner: 'user-a',
        type: 'tasks',
        entry: syncEntry,
      });

      // Assert: Vault Meta Bookmark still exists and is unchanged
      expect(readVaultMetaBookmark('user-a')).toEqual(metaEntry);
      // Assert: Sync Bookmark also exists
      expect(readSyncBookmarks('user-a').tasks).toEqual(syncEntry);
    });

    test('30: ADR 0058 amendment - writeSyncBookmark preserves existing Vault Meta Bookmark when writeVaultMetaBookmark is called afterwards', () => {
      // Write a Sync Bookmark first
      const syncEntry: SyncBookmarkEntry = {
        ciphertextHash: 'hash-1',
        etag: 'etag-1',
      };
      writeSyncBookmark({
        owner: 'user-a',
        type: 'tasks',
        entry: syncEntry,
      });

      // Verify Sync Bookmark is present
      expect(readSyncBookmarks('user-a').tasks).toEqual(syncEntry);

      // Now write a Vault Meta Bookmark
      const metaEntry: VaultMetaBookmarkEntry = {
        metaHash: 'meta-hash-1',
      };
      writeVaultMetaBookmark({
        owner: 'user-a',
        entry: metaEntry,
      });

      // Assert: Sync Bookmark still exists and is unchanged
      expect(readSyncBookmarks('user-a').tasks).toEqual(syncEntry);
      // Assert: Vault Meta Bookmark now exists
      expect(readVaultMetaBookmark('user-a')).toEqual(metaEntry);
    });

    test('31: owner isolation - Vault Meta Bookmark written for user-a is not visible to user-b', () => {
      const entryA: VaultMetaBookmarkEntry = {
        metaHash: 'meta-hash-a',
      };
      const entryB: VaultMetaBookmarkEntry = {
        metaHash: 'meta-hash-b',
      };

      writeVaultMetaBookmark({
        owner: 'user-a',
        entry: entryA,
      });
      writeVaultMetaBookmark({
        owner: 'user-b',
        entry: entryB,
      });

      // Assert: user-a's Vault Meta Bookmark is not visible to user-b
      expect(readVaultMetaBookmark('user-a')).toEqual(entryA);
      expect(readVaultMetaBookmark('user-b')).toEqual(entryB);
      expect(readVaultMetaBookmark('user-b')).not.toEqual(entryA);
    });

    test('32: removeSyncBookmarks removes the Vault Meta Bookmark while leaving other owners untouched', () => {
      const entryA: VaultMetaBookmarkEntry = {
        metaHash: 'meta-hash-a',
      };
      const entryB: VaultMetaBookmarkEntry = {
        metaHash: 'meta-hash-b',
      };

      writeVaultMetaBookmark({
        owner: 'user-a',
        entry: entryA,
      });
      writeVaultMetaBookmark({
        owner: 'user-b',
        entry: entryB,
      });

      // Also add sync bookmarks to user-b to verify removal is complete
      writeSyncBookmark({
        owner: 'user-b',
        type: 'tasks',
        entry: { ciphertextHash: 'hash-b', etag: 'etag-b' },
      });

      // Act: remove user-a's bookmarks
      removeSyncBookmarks('user-a');

      // Assert: user-a's Vault Meta Bookmark is gone
      expect(readVaultMetaBookmark('user-a')).toBeUndefined();
      // Assert: user-a's sync bookmarks are gone
      expect(readSyncBookmarks('user-a')).toEqual({});
      // Assert: user-b's Vault Meta Bookmark is still present and unchanged
      expect(readVaultMetaBookmark('user-b')).toEqual(entryB);
      // Assert: user-b's sync bookmarks are still present
      expect(readSyncBookmarks('user-b').tasks).toBeDefined();
    });
  });
});
