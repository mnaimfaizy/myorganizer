/**
 * Tests for Vault Meta Refusal storage primitives.
 *
 * Covers per-owner isolation, storage lifetime assignment, removal semantics,
 * owner assertion, and corrupted-entry handling. Parallels syncBookmarkStorage.test.ts
 * in structure and failure direction (losing a refusal costs a repeated question,
 * never a User's data).
 */

import {
  VAULT_META_REFUSAL_STORAGE_KEY,
  VAULT_META_REFUSAL_RECORD_VERSION,
  vaultMetaRefusalStorageKey,
  readVaultMetaRefusal,
  writeVaultMetaRefusal,
  removeVaultMetaRefusals,
  type VaultMetaRefusalEntry,
  type VaultMetaRefusalRecord,
} from './vaultMetaRefusalStorage';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('vaultMetaRefusalStorage — Vault Meta Refusal storage primitives', () => {
  describe('vaultMetaRefusalStorageKey — key composition and owner guard', () => {
    test('1: returns correct prefixed key for a valid owner', () => {
      const key = vaultMetaRefusalStorageKey('user-a');
      expect(key).toBe(`${VAULT_META_REFUSAL_STORAGE_KEY}:user-a`);
    });

    test('2a: throws for empty string owner', () => {
      expect(() => vaultMetaRefusalStorageKey('')).toThrow(
        'A Vault Meta Refusal cannot be resolved without an owner',
      );
    });

    test('2b: throws for whitespace-only owner', () => {
      expect(() => vaultMetaRefusalStorageKey('   ')).toThrow(
        'A Vault Meta Refusal cannot be resolved without an owner',
      );
    });
  });

  describe('readVaultMetaRefusal — read and resolution', () => {
    test('3a: returns undefined when owner has no durable refusal stored', () => {
      const result = readVaultMetaRefusal({
        owner: 'user-a',
        lifetime: 'durable',
      });
      expect(result).toBeUndefined();
    });

    test('3b: returns undefined when owner has no session refusal stored', () => {
      const result = readVaultMetaRefusal({
        owner: 'user-a',
        lifetime: 'session',
      });
      expect(result).toBeUndefined();
    });

    test('4a: returns refusal for owner when durable entry exists', () => {
      const entry: VaultMetaRefusalEntry = {
        metaHash: 'hash-durable-1',
        change: 'passphrase',
      };
      const record: VaultMetaRefusalRecord = {
        version: VAULT_META_REFUSAL_RECORD_VERSION,
        owner: 'user-a',
        refusal: entry,
      };
      localStorage.setItem(
        vaultMetaRefusalStorageKey('user-a'),
        JSON.stringify(record),
      );

      const result = readVaultMetaRefusal({
        owner: 'user-a',
        lifetime: 'durable',
      });
      expect(result).toEqual(entry);
      expect(result?.metaHash).toBe('hash-durable-1');
    });

    test('4b: returns refusal for owner when session entry exists', () => {
      const entry: VaultMetaRefusalEntry = {
        metaHash: 'hash-session-1',
        change: 'passphrase',
      };
      const record: VaultMetaRefusalRecord = {
        version: VAULT_META_REFUSAL_RECORD_VERSION,
        owner: 'user-a',
        refusal: entry,
      };
      sessionStorage.setItem(
        vaultMetaRefusalStorageKey('user-a'),
        JSON.stringify(record),
      );

      const result = readVaultMetaRefusal({
        owner: 'user-a',
        lifetime: 'session',
      });
      expect(result).toEqual(entry);
      expect(result?.metaHash).toBe('hash-session-1');
    });

    test('5: returns undefined when entry names different owner (rejected)', () => {
      // Manually write an entry under user-a's key that names user-b
      const record: VaultMetaRefusalRecord = {
        version: VAULT_META_REFUSAL_RECORD_VERSION,
        owner: 'user-b', // Wrong owner!
        refusal: { metaHash: 'hash1', change: 'passphrase' },
      };
      localStorage.setItem(
        vaultMetaRefusalStorageKey('user-a'),
        JSON.stringify(record),
      );

      const result = readVaultMetaRefusal({
        owner: 'user-a',
        lifetime: 'durable',
      });
      expect(result).toBeUndefined();
    });

    test('6: returns undefined when stored JSON is corrupt', () => {
      localStorage.setItem(vaultMetaRefusalStorageKey('user-a'), '{not json');

      const result = readVaultMetaRefusal({
        owner: 'user-a',
        lifetime: 'durable',
      });
      expect(result).toBeUndefined();
    });

    test('7: returns undefined when stored version is wrong', () => {
      const record = {
        version: 2, // Wrong version
        owner: 'user-a',
        refusal: { metaHash: 'hash1', change: 'passphrase' },
      };
      localStorage.setItem(
        vaultMetaRefusalStorageKey('user-a'),
        JSON.stringify(record),
      );

      const result = readVaultMetaRefusal({
        owner: 'user-a',
        lifetime: 'durable',
      });
      expect(result).toBeUndefined();
    });

    test('8: returns undefined when refusal object is malformed', () => {
      // Missing metaHash
      const record = {
        version: VAULT_META_REFUSAL_RECORD_VERSION,
        owner: 'user-a',
        refusal: { notMetaHash: 'value' },
      };
      localStorage.setItem(
        vaultMetaRefusalStorageKey('user-a'),
        JSON.stringify(record),
      );

      const result = readVaultMetaRefusal({
        owner: 'user-a',
        lifetime: 'durable',
      });
      expect(result).toBeUndefined();
    });

    test('9a: throws for empty owner', () => {
      expect(() => {
        readVaultMetaRefusal({
          owner: '',
          lifetime: 'durable',
        });
      }).toThrow('A Vault Meta Refusal cannot be resolved without an owner');
    });

    test('9b: throws for whitespace-only owner', () => {
      expect(() => {
        readVaultMetaRefusal({
          owner: '   ',
          lifetime: 'session',
        });
      }).toThrow('A Vault Meta Refusal cannot be resolved without an owner');
    });
  });

  describe('writeVaultMetaRefusal — write semantics', () => {
    test('10a: writes a durable refusal entry to localStorage', () => {
      const entry: VaultMetaRefusalEntry = {
        metaHash: 'hash-durable-new',
        change: 'passphrase',
      };
      writeVaultMetaRefusal({
        owner: 'user-a',
        lifetime: 'durable',
        entry,
      });

      const result = readVaultMetaRefusal({
        owner: 'user-a',
        lifetime: 'durable',
      });
      expect(result).toEqual(entry);

      // Verify it is NOT in sessionStorage
      expect(
        sessionStorage.getItem(vaultMetaRefusalStorageKey('user-a')),
      ).toBeNull();
    });

    test('10b: writes a session refusal entry to sessionStorage', () => {
      const entry: VaultMetaRefusalEntry = {
        metaHash: 'hash-session-new',
        change: 'passphrase',
      };
      writeVaultMetaRefusal({
        owner: 'user-a',
        lifetime: 'session',
        entry,
      });

      const result = readVaultMetaRefusal({
        owner: 'user-a',
        lifetime: 'session',
      });
      expect(result).toEqual(entry);

      // Verify it is NOT in localStorage
      expect(
        localStorage.getItem(vaultMetaRefusalStorageKey('user-a')),
      ).toBeNull();
    });

    test('11: durable and session refusals coexist independently for same owner', () => {
      const durableEntry: VaultMetaRefusalEntry = {
        metaHash: 'hash-durable-coexist',
        change: 'passphrase',
      };
      const sessionEntry: VaultMetaRefusalEntry = {
        metaHash: 'hash-session-coexist',
        change: 'passphrase',
      };

      writeVaultMetaRefusal({
        owner: 'user-a',
        lifetime: 'durable',
        entry: durableEntry,
      });
      writeVaultMetaRefusal({
        owner: 'user-a',
        lifetime: 'session',
        entry: sessionEntry,
      });

      const durable = readVaultMetaRefusal({
        owner: 'user-a',
        lifetime: 'durable',
      });
      const session = readVaultMetaRefusal({
        owner: 'user-a',
        lifetime: 'session',
      });

      expect(durable).toEqual(durableEntry);
      expect(session).toEqual(sessionEntry);
      expect(durable?.metaHash).not.toBe(session?.metaHash);
    });

    test('12: a second write for the same lifetime REPLACES the first', () => {
      const entry1: VaultMetaRefusalEntry = {
        metaHash: 'hash-first',
        change: 'passphrase',
      };
      const entry2: VaultMetaRefusalEntry = {
        metaHash: 'hash-second',
        change: 'passphrase',
      };

      writeVaultMetaRefusal({
        owner: 'user-a',
        lifetime: 'durable',
        entry: entry1,
      });
      writeVaultMetaRefusal({
        owner: 'user-a',
        lifetime: 'durable',
        entry: entry2,
      });

      const result = readVaultMetaRefusal({
        owner: 'user-a',
        lifetime: 'durable',
      });
      expect(result).toEqual(entry2);
      expect(result?.metaHash).not.toBe('hash-first');
    });

    test('13a: throws for empty owner', () => {
      expect(() => {
        writeVaultMetaRefusal({
          owner: '',
          lifetime: 'durable',
          entry: { metaHash: 'hash1', change: 'passphrase' },
        });
      }).toThrow('A Vault Meta Refusal cannot be resolved without an owner');
    });

    test('13b: throws for whitespace-only owner', () => {
      expect(() => {
        writeVaultMetaRefusal({
          owner: '   ',
          lifetime: 'session',
          entry: { metaHash: 'hash1', change: 'passphrase' },
        });
      }).toThrow('A Vault Meta Refusal cannot be resolved without an owner');
    });
  });

  describe('Mis-keyed entry overwriting (silent replacement, like Sync Bookmarks)', () => {
    test('14: silently overwrites mis-keyed entry without throwing', () => {
      // Pre-write a mis-keyed entry (names different owner)
      const misKeyedRecord: VaultMetaRefusalRecord = {
        version: VAULT_META_REFUSAL_RECORD_VERSION,
        owner: 'user-b',
        refusal: { metaHash: 'old-hash', change: 'passphrase' },
      };
      localStorage.setItem(
        vaultMetaRefusalStorageKey('user-a'),
        JSON.stringify(misKeyedRecord),
      );

      // Act: write as user-a (should not throw)
      const entry: VaultMetaRefusalEntry = {
        metaHash: 'new-hash',
        change: 'passphrase',
      };
      expect(() => {
        writeVaultMetaRefusal({
          owner: 'user-a',
          lifetime: 'durable',
          entry,
        });
      }).not.toThrow();

      // Assert: entry was overwritten
      const result = readVaultMetaRefusal({
        owner: 'user-a',
        lifetime: 'durable',
      });
      expect(result).toEqual(entry);
      expect(result?.metaHash).toBe('new-hash');
    });
  });

  describe('removeVaultMetaRefusals — removal and per-owner isolation', () => {
    test('15a: removes the durable refusal for the given owner', () => {
      const entry: VaultMetaRefusalEntry = {
        metaHash: 'hash-remove',
        change: 'passphrase',
      };
      writeVaultMetaRefusal({
        owner: 'user-a',
        lifetime: 'durable',
        entry,
      });

      expect(
        readVaultMetaRefusal({
          owner: 'user-a',
          lifetime: 'durable',
        }),
      ).not.toBeUndefined();

      // Act: remove
      removeVaultMetaRefusals('user-a');

      // Assert: gone
      expect(
        readVaultMetaRefusal({
          owner: 'user-a',
          lifetime: 'durable',
        }),
      ).toBeUndefined();
    });

    test('15b: removes the session refusal for the given owner', () => {
      const entry: VaultMetaRefusalEntry = {
        metaHash: 'hash-remove-session',
        change: 'passphrase',
      };
      writeVaultMetaRefusal({
        owner: 'user-a',
        lifetime: 'session',
        entry,
      });

      expect(
        readVaultMetaRefusal({
          owner: 'user-a',
          lifetime: 'session',
        }),
      ).not.toBeUndefined();

      // Act: remove
      removeVaultMetaRefusals('user-a');

      // Assert: gone
      expect(
        readVaultMetaRefusal({
          owner: 'user-a',
          lifetime: 'session',
        }),
      ).toBeUndefined();
    });

    test('15c: removes BOTH lifetimes for the given owner', () => {
      const durableEntry: VaultMetaRefusalEntry = {
        metaHash: 'hash-durable',
        change: 'passphrase',
      };
      const sessionEntry: VaultMetaRefusalEntry = {
        metaHash: 'hash-session',
        change: 'passphrase',
      };

      writeVaultMetaRefusal({
        owner: 'user-a',
        lifetime: 'durable',
        entry: durableEntry,
      });
      writeVaultMetaRefusal({
        owner: 'user-a',
        lifetime: 'session',
        entry: sessionEntry,
      });

      // Act: remove
      removeVaultMetaRefusals('user-a');

      // Assert: both gone
      expect(
        readVaultMetaRefusal({
          owner: 'user-a',
          lifetime: 'durable',
        }),
      ).toBeUndefined();
      expect(
        readVaultMetaRefusal({
          owner: 'user-a',
          lifetime: 'session',
        }),
      ).toBeUndefined();
    });

    test('16: does not affect another owner when one owner is removed', () => {
      const entryA: VaultMetaRefusalEntry = {
        metaHash: 'hash-a',
        change: 'passphrase',
      };
      const entryB: VaultMetaRefusalEntry = {
        metaHash: 'hash-b',
        change: 'passphrase',
      };

      writeVaultMetaRefusal({
        owner: 'user-a',
        lifetime: 'durable',
        entry: entryA,
      });
      writeVaultMetaRefusal({
        owner: 'user-b',
        lifetime: 'durable',
        entry: entryB,
      });

      // Act: remove only user-a
      removeVaultMetaRefusals('user-a');

      // Assert: user-a is gone
      expect(
        readVaultMetaRefusal({
          owner: 'user-a',
          lifetime: 'durable',
        }),
      ).toBeUndefined();

      // Assert: user-b is untouched
      expect(
        readVaultMetaRefusal({
          owner: 'user-b',
          lifetime: 'durable',
        }),
      ).toEqual(entryB);
    });

    test('17a: throws for empty owner', () => {
      expect(() => removeVaultMetaRefusals('')).toThrow(
        'A Vault Meta Refusal cannot be resolved without an owner',
      );
    });

    test('17b: throws for whitespace-only owner', () => {
      expect(() => removeVaultMetaRefusals('   ')).toThrow(
        'A Vault Meta Refusal cannot be resolved without an owner',
      );
    });
  });

  describe('Per-owner isolation — direct localStorage/sessionStorage checks', () => {
    test('18a: durable write for user-a appears only under user-a key', () => {
      const entry: VaultMetaRefusalEntry = {
        metaHash: 'hash-a',
        change: 'passphrase',
      };

      writeVaultMetaRefusal({
        owner: 'user-a',
        lifetime: 'durable',
        entry,
      });

      // Assert: user-a key exists
      expect(
        localStorage.getItem(vaultMetaRefusalStorageKey('user-a')),
      ).not.toBeNull();

      // Assert: user-b key does not exist
      expect(
        localStorage.getItem(vaultMetaRefusalStorageKey('user-b')),
      ).toBeNull();
    });

    test('18b: session write for user-a appears only under user-a key', () => {
      const entry: VaultMetaRefusalEntry = {
        metaHash: 'hash-a',
        change: 'passphrase',
      };

      writeVaultMetaRefusal({
        owner: 'user-a',
        lifetime: 'session',
        entry,
      });

      // Assert: user-a key exists in sessionStorage
      expect(
        sessionStorage.getItem(vaultMetaRefusalStorageKey('user-a')),
      ).not.toBeNull();

      // Assert: user-b key does not exist
      expect(
        sessionStorage.getItem(vaultMetaRefusalStorageKey('user-b')),
      ).toBeNull();
    });

    test('19: removing user-a durable refusal leaves user-b untouched in localStorage', () => {
      const entryA: VaultMetaRefusalEntry = {
        metaHash: 'hash-a',
        change: 'passphrase',
      };
      const entryB: VaultMetaRefusalEntry = {
        metaHash: 'hash-b',
        change: 'passphrase',
      };

      writeVaultMetaRefusal({
        owner: 'user-a',
        lifetime: 'durable',
        entry: entryA,
      });
      writeVaultMetaRefusal({
        owner: 'user-b',
        lifetime: 'durable',
        entry: entryB,
      });

      const userBBefore = localStorage.getItem(
        vaultMetaRefusalStorageKey('user-b'),
      );

      // Act: remove user-a only
      removeVaultMetaRefusals('user-a');

      // Assert: user-a key gone
      expect(
        localStorage.getItem(vaultMetaRefusalStorageKey('user-a')),
      ).toBeNull();

      // Assert: user-b key byte-identical
      const userBAfter = localStorage.getItem(
        vaultMetaRefusalStorageKey('user-b'),
      );
      expect(userBAfter).toBe(userBBefore);
      expect(userBAfter).not.toBeNull();
    });
  });

  describe('Tab close simulation (sessionStorage survival)', () => {
    test('20: durable refusal survives simulated tab close (sessionStorage clear, localStorage persist)', () => {
      const durableEntry: VaultMetaRefusalEntry = {
        metaHash: 'hash-durable-survives',
        change: 'passphrase',
      };
      const sessionEntry: VaultMetaRefusalEntry = {
        metaHash: 'hash-session-survives',
        change: 'passphrase',
      };

      writeVaultMetaRefusal({
        owner: 'user-a',
        lifetime: 'durable',
        entry: durableEntry,
      });
      writeVaultMetaRefusal({
        owner: 'user-a',
        lifetime: 'session',
        entry: sessionEntry,
      });

      // Both exist initially
      expect(
        readVaultMetaRefusal({
          owner: 'user-a',
          lifetime: 'durable',
        }),
      ).toEqual(durableEntry);
      expect(
        readVaultMetaRefusal({
          owner: 'user-a',
          lifetime: 'session',
        }),
      ).toEqual(sessionEntry);

      // Simulate tab close: clear sessionStorage only
      sessionStorage.clear();

      // Durable survives
      expect(
        readVaultMetaRefusal({
          owner: 'user-a',
          lifetime: 'durable',
        }),
      ).toEqual(durableEntry);

      // Session does not
      expect(
        readVaultMetaRefusal({
          owner: 'user-a',
          lifetime: 'session',
        }),
      ).toBeUndefined();
    });
  });
});
