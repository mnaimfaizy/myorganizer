/**
 * Tests for Recovery Key Acknowledgment storage primitives.
 *
 * Covers per-owner isolation, key composition, read/write/remove semantics,
 * owner assertion, and corrupted-entry handling. Parallels vaultMetaRefusalStorage.test.ts
 * in structure and failure direction (losing a record costs a reminder not shown,
 * never a User's data). localStorage only — no sessionStorage half.
 */

import {
  RECOVERY_KEY_ACKNOWLEDGMENT_STORAGE_KEY,
  RECOVERY_KEY_ACKNOWLEDGMENT_RECORD_VERSION,
  recoveryKeyAcknowledgmentStorageKey,
  readRecoveryKeyAcknowledgment,
  writeRecoveryKeyAcknowledgment,
  removeRecoveryKeyAcknowledgment,
  type RecoveryKeyAcknowledgmentRecord,
} from './recoveryKeyAcknowledgmentStorage';

const OWNER_GUARD_MESSAGE =
  'A Recovery Key Acknowledgment cannot be resolved without an owner';

beforeEach(() => {
  localStorage.clear();
});

describe('recoveryKeyAcknowledgmentStorage — Recovery Key Acknowledgment storage primitives', () => {
  describe('recoveryKeyAcknowledgmentStorageKey — key composition and owner guard', () => {
    test('1: returns correct prefixed key for a valid owner', () => {
      const key = recoveryKeyAcknowledgmentStorageKey('user-a');
      expect(key).toBe(`${RECOVERY_KEY_ACKNOWLEDGMENT_STORAGE_KEY}:user-a`);
    });

    test('2: throws for empty or whitespace-only owner', () => {
      expect(() => recoveryKeyAcknowledgmentStorageKey('')).toThrow(
        OWNER_GUARD_MESSAGE,
      );
      expect(() => recoveryKeyAcknowledgmentStorageKey('   ')).toThrow(
        OWNER_GUARD_MESSAGE,
      );
    });
  });

  describe('readRecoveryKeyAcknowledgment — read and resolution', () => {
    test('3: returns undefined when owner has no entry stored', () => {
      expect(readRecoveryKeyAcknowledgment('user-a')).toBeUndefined();
    });

    test('4: returns record when a valid entry exists', () => {
      const record: RecoveryKeyAcknowledgmentRecord = {
        version: RECOVERY_KEY_ACKNOWLEDGMENT_RECORD_VERSION,
        owner: 'user-a',
        wrappingHash: 'abc123',
      };
      localStorage.setItem(
        recoveryKeyAcknowledgmentStorageKey('user-a'),
        JSON.stringify(record),
      );

      expect(readRecoveryKeyAcknowledgment('user-a')).toEqual(record);
    });

    test('5: returns undefined when entry names different owner (rejected)', () => {
      const record: RecoveryKeyAcknowledgmentRecord = {
        version: RECOVERY_KEY_ACKNOWLEDGMENT_RECORD_VERSION,
        owner: 'user-b',
        wrappingHash: 'abc123',
      };
      localStorage.setItem(
        recoveryKeyAcknowledgmentStorageKey('user-a'),
        JSON.stringify(record),
      );

      expect(readRecoveryKeyAcknowledgment('user-a')).toBeUndefined();
    });

    test('6: returns undefined when stored JSON is corrupt', () => {
      localStorage.setItem(
        recoveryKeyAcknowledgmentStorageKey('user-a'),
        '{not json',
      );

      expect(readRecoveryKeyAcknowledgment('user-a')).toBeUndefined();
    });

    test('7: returns undefined when stored version is wrong', () => {
      const record = {
        version: 2,
        owner: 'user-a',
        wrappingHash: 'abc123',
      };
      localStorage.setItem(
        recoveryKeyAcknowledgmentStorageKey('user-a'),
        JSON.stringify(record),
      );

      expect(readRecoveryKeyAcknowledgment('user-a')).toBeUndefined();
    });

    test('8: returns undefined when wrappingHash is empty string', () => {
      const record = {
        version: RECOVERY_KEY_ACKNOWLEDGMENT_RECORD_VERSION,
        owner: 'user-a',
        wrappingHash: '',
      };
      localStorage.setItem(
        recoveryKeyAcknowledgmentStorageKey('user-a'),
        JSON.stringify(record),
      );

      expect(readRecoveryKeyAcknowledgment('user-a')).toBeUndefined();
    });
  });

  describe('writeRecoveryKeyAcknowledgment — write semantics', () => {
    test('9: writes a record to localStorage and read returns it', () => {
      writeRecoveryKeyAcknowledgment({
        owner: 'user-a',
        wrappingHash: 'abc123',
      });

      const result = readRecoveryKeyAcknowledgment('user-a');
      expect(result).toEqual({
        version: RECOVERY_KEY_ACKNOWLEDGMENT_RECORD_VERSION,
        owner: 'user-a',
        wrappingHash: 'abc123',
      });

      const raw = localStorage.getItem(
        recoveryKeyAcknowledgmentStorageKey('user-a'),
      );
      const parsed = JSON.parse(raw!) as Record<string, unknown>;
      expect(parsed.version).toBe(RECOVERY_KEY_ACKNOWLEDGMENT_RECORD_VERSION);
      expect(parsed.owner).toBe('user-a');
      expect(parsed.wrappingHash).toBe('abc123');
      expect(parsed).not.toHaveProperty('recoveryKey');
    });

    test('10: a second write REPLACES the first for the same owner', () => {
      writeRecoveryKeyAcknowledgment({
        owner: 'user-a',
        wrappingHash: 'hash-first',
      });
      writeRecoveryKeyAcknowledgment({
        owner: 'user-a',
        wrappingHash: 'hash-second',
      });

      const result = readRecoveryKeyAcknowledgment('user-a');
      expect(result?.wrappingHash).toBe('hash-second');
      expect(result?.wrappingHash).not.toBe('hash-first');
    });

    test('11: each owner reads their own wrappingHash without touching the other key', () => {
      writeRecoveryKeyAcknowledgment({
        owner: 'user-a',
        wrappingHash: 'hash-a',
      });
      writeRecoveryKeyAcknowledgment({
        owner: 'user-b',
        wrappingHash: 'hash-b',
      });

      expect(readRecoveryKeyAcknowledgment('user-a')?.wrappingHash).toBe(
        'hash-a',
      );
      expect(readRecoveryKeyAcknowledgment('user-b')?.wrappingHash).toBe(
        'hash-b',
      );
      expect(
        localStorage.getItem(recoveryKeyAcknowledgmentStorageKey('user-a')),
      ).not.toBeNull();
      expect(
        localStorage.getItem(recoveryKeyAcknowledgmentStorageKey('user-b')),
      ).not.toBeNull();
    });
  });

  describe('Mis-keyed entry overwriting (silent replacement, like Sync Bookmarks)', () => {
    test('12: silently overwrites mis-keyed entry without throwing', () => {
      const misKeyedRecord: RecoveryKeyAcknowledgmentRecord = {
        version: RECOVERY_KEY_ACKNOWLEDGMENT_RECORD_VERSION,
        owner: 'user-b',
        wrappingHash: 'old-hash',
      };
      localStorage.setItem(
        recoveryKeyAcknowledgmentStorageKey('user-a'),
        JSON.stringify(misKeyedRecord),
      );

      expect(() =>
        writeRecoveryKeyAcknowledgment({
          owner: 'user-a',
          wrappingHash: 'new-hash',
        }),
      ).not.toThrow();

      expect(readRecoveryKeyAcknowledgment('user-a')).toEqual({
        version: RECOVERY_KEY_ACKNOWLEDGMENT_RECORD_VERSION,
        owner: 'user-a',
        wrappingHash: 'new-hash',
      });
    });
  });

  describe('removeRecoveryKeyAcknowledgment — removal and per-owner isolation', () => {
    test('13: removes the record for the given owner', () => {
      writeRecoveryKeyAcknowledgment({
        owner: 'user-a',
        wrappingHash: 'abc123',
      });
      expect(readRecoveryKeyAcknowledgment('user-a')).not.toBeUndefined();

      removeRecoveryKeyAcknowledgment('user-a');

      expect(readRecoveryKeyAcknowledgment('user-a')).toBeUndefined();
      expect(
        localStorage.getItem(recoveryKeyAcknowledgmentStorageKey('user-a')),
      ).toBeNull();
    });

    test('14: does not affect another owner when one owner is removed', () => {
      writeRecoveryKeyAcknowledgment({
        owner: 'user-a',
        wrappingHash: 'hash-a',
      });
      writeRecoveryKeyAcknowledgment({
        owner: 'user-b',
        wrappingHash: 'hash-b',
      });

      const userBBefore = localStorage.getItem(
        recoveryKeyAcknowledgmentStorageKey('user-b'),
      );

      removeRecoveryKeyAcknowledgment('user-a');

      expect(readRecoveryKeyAcknowledgment('user-a')).toBeUndefined();
      expect(readRecoveryKeyAcknowledgment('user-b')).toEqual({
        version: RECOVERY_KEY_ACKNOWLEDGMENT_RECORD_VERSION,
        owner: 'user-b',
        wrappingHash: 'hash-b',
      });
      expect(
        localStorage.getItem(recoveryKeyAcknowledgmentStorageKey('user-b')),
      ).toBe(userBBefore);
    });
  });

  describe('assertOwner — empty or whitespace owner is rejected on every entry point', () => {
    test('15: throws on read, write, and remove when owner is missing', () => {
      expect(() => readRecoveryKeyAcknowledgment('')).toThrow(
        OWNER_GUARD_MESSAGE,
      );
      expect(() => readRecoveryKeyAcknowledgment('   ')).toThrow(
        OWNER_GUARD_MESSAGE,
      );
      expect(() =>
        writeRecoveryKeyAcknowledgment({ owner: '', wrappingHash: 'abc123' }),
      ).toThrow(OWNER_GUARD_MESSAGE);
      expect(() =>
        writeRecoveryKeyAcknowledgment({
          owner: '   ',
          wrappingHash: 'abc123',
        }),
      ).toThrow(OWNER_GUARD_MESSAGE);
      expect(() => removeRecoveryKeyAcknowledgment('')).toThrow(
        OWNER_GUARD_MESSAGE,
      );
      expect(() => removeRecoveryKeyAcknowledgment('   ')).toThrow(
        OWNER_GUARD_MESSAGE,
      );
    });
  });
});
