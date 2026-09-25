import {
  isVaultBlobEnvelope,
  readVaultBlobRecords,
  readDeletionLog,
  mergeDeletionLogs,
  toEpoch,
  type VaultBlobEnvelope,
} from './vaultBlobEnvelope';

describe('vaultBlobEnvelope', () => {
  describe('isVaultBlobEnvelope', () => {
    it('returns true for a valid envelope', () => {
      expect(isVaultBlobEnvelope({ records: [], deletions: {} })).toBe(true);
    });

    it('returns false for an array', () => {
      expect(isVaultBlobEnvelope([])).toBe(false);
    });

    it('returns false for null', () => {
      expect(isVaultBlobEnvelope(null)).toBe(false);
    });

    it('returns false for an object without records key', () => {
      expect(isVaultBlobEnvelope({ catalog: [], lists: [] })).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isVaultBlobEnvelope(undefined)).toBe(false);
    });
  });

  describe('readVaultBlobRecords', () => {
    it('extracts records from an envelope', () => {
      const records = [{ id: '1' }];
      const envelope: VaultBlobEnvelope<typeof records> = {
        records,
        deletions: {},
      };
      expect(readVaultBlobRecords(envelope)).toBe(records);
    });

    it('returns a bare array untouched', () => {
      const array = [{ id: '1' }, { id: '2' }];
      expect(readVaultBlobRecords(array)).toBe(array);
    });

    it('returns null unchanged', () => {
      expect(readVaultBlobRecords(null)).toBe(null);
    });

    it('returns undefined unchanged', () => {
      expect(readVaultBlobRecords(undefined)).toBe(undefined);
    });

    it('returns a bare object untouched', () => {
      const obj = { catalog: [], lists: [] };
      expect(readVaultBlobRecords(obj)).toBe(obj);
    });
  });

  describe('readDeletionLog', () => {
    it('returns empty object for a bare payload', () => {
      expect(readDeletionLog([])).toEqual({});
    });

    it('extracts deletion log from an envelope', () => {
      const log = { a: '2026-01-01T00:00:00.000Z' };
      const envelope: VaultBlobEnvelope<unknown> = {
        records: [],
        deletions: log,
      };
      expect(readDeletionLog(envelope)).toEqual(log);
    });

    it('drops entries with blank-string ids', () => {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: [],
        deletions: {
          '': '2026-01-01T00:00:00.000Z',
          '  ': '2026-01-01T00:00:00.000Z',
          a: '2026-01-01T00:00:00.000Z',
        },
      };
      expect(readDeletionLog(envelope)).toEqual({
        a: '2026-01-01T00:00:00.000Z',
      });
    });

    it('drops entries with non-string deletedAt values', () => {
      const envelope: unknown = {
        records: [],
        deletions: {
          a: null,
          b: 123,
          c: true,
          d: '2026-01-01T00:00:00.000Z',
        },
      };
      expect(readDeletionLog(envelope)).toEqual({
        d: '2026-01-01T00:00:00.000Z',
      });
    });

    it('drops entries with unparseable date strings', () => {
      const envelope: VaultBlobEnvelope<unknown> = {
        records: [],
        deletions: {
          a: 'not-a-date',
          b: '2026-01-01T00:00:00.000Z',
        },
      };
      expect(readDeletionLog(envelope)).toEqual({
        b: '2026-01-01T00:00:00.000Z',
      });
    });

    it('returns empty object when deletions is not an object', () => {
      const envelope: unknown = {
        records: [],
        deletions: 'not an object',
      };
      expect(readDeletionLog(envelope)).toEqual({});
    });

    it('returns empty object when deletions is an array', () => {
      const envelope: unknown = {
        records: [],
        deletions: [],
      };
      expect(readDeletionLog(envelope)).toEqual({});
    });

    it('returns empty object for null', () => {
      expect(readDeletionLog(null)).toEqual({});
    });

    it('returns empty object for undefined', () => {
      expect(readDeletionLog(undefined)).toEqual({});
    });
  });

  describe('mergeDeletionLogs', () => {
    it('drops entries a record cannot be compared against', () => {
      const local = {
        good: '2026-01-01T00:00:00.000Z',
        bad: 'not-a-date',
      } as Record<string, string>;
      const remote = { alsoBad: null } as unknown as Record<string, string>;
      expect(mergeDeletionLogs(local, remote)).toEqual({
        good: '2026-01-01T00:00:00.000Z',
      });
    });

    it('drops entries with blank string ids from both sides', () => {
      const local = {
        '': '2026-01-01T00:00:00.000Z',
        '  ': '2026-01-01T00:00:00.000Z',
        good: '2026-01-01T00:00:00.000Z',
      } as Record<string, string>;
      const remote = {
        '': '2026-01-02T00:00:00.000Z',
        alsoGood: '2026-01-02T00:00:00.000Z',
      } as Record<string, string>;
      expect(mergeDeletionLogs(local, remote)).toEqual({
        good: '2026-01-01T00:00:00.000Z',
        alsoGood: '2026-01-02T00:00:00.000Z',
      });
    });

    it('drops entries with non-string values from both sides while keeping good entries', () => {
      const local = {
        good: '2026-01-01T00:00:00.000Z',
        badNull: null,
        badNum: 123,
        badObj: { timestamp: '2026-01-01T00:00:00.000Z' },
      } as unknown as Record<string, string>;
      const remote = {
        alsoGood: '2026-01-02T00:00:00.000Z',
        remoteBadNull: null,
        remoteBadArray: ['2026-01-02T00:00:00.000Z'],
      } as unknown as Record<string, string>;
      expect(mergeDeletionLogs(local, remote)).toEqual({
        good: '2026-01-01T00:00:00.000Z',
        alsoGood: '2026-01-02T00:00:00.000Z',
      });
    });

    it('returns union of both logs', () => {
      const local = { a: '2026-01-01T00:00:00.000Z' };
      const remote = { b: '2026-01-02T00:00:00.000Z' };
      expect(mergeDeletionLogs(local, remote)).toEqual({
        a: '2026-01-01T00:00:00.000Z',
        b: '2026-01-02T00:00:00.000Z',
      });
    });

    it('keeps newer timestamp when id is in both logs', () => {
      const local = { a: '2026-01-01T00:00:00.000Z' };
      const remote = { a: '2026-01-02T00:00:00.000Z' };
      expect(mergeDeletionLogs(local, remote)).toEqual({
        a: '2026-01-02T00:00:00.000Z',
      });
    });

    it('keeps local timestamp when it is newer', () => {
      const local = { a: '2026-01-02T00:00:00.000Z' };
      const remote = { a: '2026-01-01T00:00:00.000Z' };
      expect(mergeDeletionLogs(local, remote)).toEqual({
        a: '2026-01-02T00:00:00.000Z',
      });
    });

    it('does not drop entries from either side', () => {
      const local = {
        a: '2026-01-01T00:00:00.000Z',
        c: '2026-01-03T00:00:00.000Z',
      };
      const remote = {
        b: '2026-01-02T00:00:00.000Z',
        d: '2026-01-04T00:00:00.000Z',
      };
      const result = mergeDeletionLogs(local, remote);
      expect(result).toEqual({
        a: '2026-01-01T00:00:00.000Z',
        b: '2026-01-02T00:00:00.000Z',
        c: '2026-01-03T00:00:00.000Z',
        d: '2026-01-04T00:00:00.000Z',
      });
    });

    it('returns empty object when both are empty', () => {
      expect(mergeDeletionLogs({}, {})).toEqual({});
    });
  });

  describe('toEpoch', () => {
    it('converts a valid ISO string to epoch milliseconds', () => {
      const epoch = toEpoch('2026-01-01T00:00:00.000Z');
      expect(epoch).toBe(new Date('2026-01-01T00:00:00.000Z').getTime());
    });

    it('returns -Infinity for undefined', () => {
      expect(toEpoch(undefined)).toBe(Number.NEGATIVE_INFINITY);
    });

    it('returns -Infinity for null', () => {
      expect(toEpoch(null)).toBe(Number.NEGATIVE_INFINITY);
    });

    it('returns -Infinity for unparseable string', () => {
      expect(toEpoch('not-a-date')).toBe(Number.NEGATIVE_INFINITY);
    });

    it('returns -Infinity for empty string', () => {
      expect(toEpoch('')).toBe(Number.NEGATIVE_INFINITY);
    });
  });
});
