import '@testing-library/jest-dom';

import {
  DEFAULT_SHORTS_LIMIT_MS,
  MIN_SHORTS_LIMIT_MS,
  MAX_SHORTS_LIMIT_MS,
  SHORTS_BUDGET_STORAGE_KEY,
  localDayKey,
  normalizeShortsBudget,
  isShortsLocked,
  remainingShortsMs,
  withShortsLimit,
  withShortsSpend,
  formatShortsDuration,
  readShortsBudget,
  writeShortsBudget,
  type ShortsBudgetLedger,
} from './shortsBudget';

describe('shortsBudget — pure module', () => {
  describe('localDayKey', () => {
    it('returns local calendar day as YYYY-MM-DD', () => {
      const date = new Date(2025, 0, 15);
      expect(localDayKey(date)).toBe('2025-01-15');
    });

    it('pads month and day with leading zeros', () => {
      const date = new Date(2025, 0, 5);
      expect(localDayKey(date)).toBe('2025-01-05');
    });

    it('uses local components, not UTC', () => {
      const date = new Date(2025, 11, 31);
      const result = localDayKey(date);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const expected = `${year}-${month}-${day}`;
      expect(result).toBe(expected);
    });
  });

  describe('normalizeShortsBudget', () => {
    it('returns default when raw is null', () => {
      const now = new Date(2025, 0, 15);
      const result = normalizeShortsBudget(null, now);
      expect(result.spentMs).toBe(0);
      expect(result.limitMs).toBe(DEFAULT_SHORTS_LIMIT_MS);
    });

    it('returns default for non-object input', () => {
      const now = new Date(2025, 0, 15);
      expect(normalizeShortsBudget('string', now).spentMs).toBe(0);
      expect(normalizeShortsBudget(123, now).spentMs).toBe(0);
    });

    it('resets spentMs to 0 for earlier day', () => {
      const yesterday = new Date(2025, 0, 14);
      const today = new Date(2025, 0, 15);
      const result = normalizeShortsBudget(
        {
          dayKey: localDayKey(yesterday),
          spentMs: 1800000,
          limitMs: 3600000,
        },
        today,
      );
      expect(result.dayKey).toBe('2025-01-15');
      expect(result.spentMs).toBe(0);
      expect(result.limitMs).toBe(3600000);
    });

    it('preserves same-day ledger', () => {
      const now = new Date(2025, 0, 15);
      const ledger = {
        dayKey: '2025-01-15',
        spentMs: 1800000,
        limitMs: 3600000,
      };
      const result = normalizeShortsBudget(ledger, now);
      expect(result).toEqual(ledger);
    });

    it('coerces negative spentMs to 0', () => {
      const now = new Date(2025, 0, 15);
      const result = normalizeShortsBudget(
        {
          dayKey: '2025-01-15',
          spentMs: -100,
          limitMs: 3600000,
        },
        now,
      );
      expect(result.spentMs).toBe(0);
    });

    it('clamps limitMs into [MIN, MAX]', () => {
      const now = new Date(2025, 0, 15);
      const tooLow = normalizeShortsBudget(
        {
          dayKey: '2025-01-15',
          spentMs: 0,
          limitMs: 10_000,
        },
        now,
      );
      expect(tooLow.limitMs).toBe(MIN_SHORTS_LIMIT_MS);

      const tooHigh = normalizeShortsBudget(
        {
          dayKey: '2025-01-15',
          spentMs: 0,
          limitMs: 50_000_000,
        },
        now,
      );
      expect(tooHigh.limitMs).toBe(MAX_SHORTS_LIMIT_MS);
    });
  });

  describe('isShortsLocked', () => {
    it('returns true when spentMs >= limitMs', () => {
      const ledger: ShortsBudgetLedger = {
        dayKey: '2025-01-15',
        spentMs: 3600000,
        limitMs: 3600000,
      };
      expect(isShortsLocked(ledger)).toBe(true);
    });

    it('returns false when spentMs < limitMs', () => {
      const ledger: ShortsBudgetLedger = {
        dayKey: '2025-01-15',
        spentMs: 1800000,
        limitMs: 3600000,
      };
      expect(isShortsLocked(ledger)).toBe(false);
    });
  });

  describe('remainingShortsMs', () => {
    it('returns limitMs - spentMs', () => {
      const ledger: ShortsBudgetLedger = {
        dayKey: '2025-01-15',
        spentMs: 1800000,
        limitMs: 3600000,
      };
      expect(remainingShortsMs(ledger)).toBe(1800000);
    });

    it('floors at 0 when at or over limit', () => {
      const ledger: ShortsBudgetLedger = {
        dayKey: '2025-01-15',
        spentMs: 3600000,
        limitMs: 3600000,
      };
      expect(remainingShortsMs(ledger)).toBe(0);
    });
  });

  describe('withShortsLimit', () => {
    it('updates limitMs and preserves spentMs', () => {
      const ledger: ShortsBudgetLedger = {
        dayKey: '2025-01-15',
        spentMs: 1800000,
        limitMs: 3600000,
      };
      const result = withShortsLimit(ledger, 5400000);
      expect(result.spentMs).toBe(1800000);
      expect(result.limitMs).toBe(5400000);
    });

    it('locks when limit lowered below current spend', () => {
      const ledger: ShortsBudgetLedger = {
        dayKey: '2025-01-15',
        spentMs: 3000000,
        limitMs: 3600000,
      };
      const result = withShortsLimit(ledger, 1800000);
      expect(isShortsLocked(result)).toBe(true);
      expect(result.spentMs).toBe(3000000);
    });

    it('clamps limit to [MIN, MAX]', () => {
      const ledger: ShortsBudgetLedger = {
        dayKey: '2025-01-15',
        spentMs: 100,
        limitMs: 3600000,
      };
      const tooLow = withShortsLimit(ledger, 10_000);
      expect(tooLow.limitMs).toBe(MIN_SHORTS_LIMIT_MS);

      const tooHigh = withShortsLimit(ledger, 50_000_000);
      expect(tooHigh.limitMs).toBe(MAX_SHORTS_LIMIT_MS);
    });
  });

  describe('withShortsSpend', () => {
    it('accrues elapsed time up to limit', () => {
      const ledger: ShortsBudgetLedger = {
        dayKey: '2025-01-15',
        spentMs: 1800000,
        limitMs: 3600000,
      };
      const result = withShortsSpend(ledger, 900000);
      expect(result.spentMs).toBe(2700000);
    });

    it('caps spentMs at limitMs', () => {
      const ledger: ShortsBudgetLedger = {
        dayKey: '2025-01-15',
        spentMs: 3300000,
        limitMs: 3600000,
      };
      const result = withShortsSpend(ledger, 900000);
      expect(result.spentMs).toBe(3600000);
    });

    it('ignores zero or negative elapsed', () => {
      const ledger: ShortsBudgetLedger = {
        dayKey: '2025-01-15',
        spentMs: 1800000,
        limitMs: 3600000,
      };
      expect(withShortsSpend(ledger, 0)).toBe(ledger);
      expect(withShortsSpend(ledger, -1000)).toBe(ledger);
    });

    it('ignores non-finite elapsed', () => {
      const ledger: ShortsBudgetLedger = {
        dayKey: '2025-01-15',
        spentMs: 1800000,
        limitMs: 3600000,
      };
      expect(withShortsSpend(ledger, NaN)).toBe(ledger);
      expect(withShortsSpend(ledger, Infinity)).toBe(ledger);
    });
  });

  describe('formatShortsDuration', () => {
    it('formats under 1 hour as M:SS', () => {
      expect(formatShortsDuration(125000)).toBe('2:05');
    });

    it('formats over 1 hour as H:MM:SS', () => {
      const twoHours = 2 * 60 * 60 * 1000 + 5 * 60 * 1000 + 30 * 1000;
      expect(formatShortsDuration(twoHours)).toBe('2:05:30');
    });

    it('rounds up partial seconds', () => {
      expect(formatShortsDuration(1500)).toBe('0:02');
    });

    it('returns 0:00 for zero', () => {
      expect(formatShortsDuration(0)).toBe('0:00');
    });

    it('treats negative as 0:00', () => {
      expect(formatShortsDuration(-1000)).toBe('0:00');
    });
  });

  describe('localStorage round-trip', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('readShortsBudget returns default when key absent', () => {
      const result = readShortsBudget();
      expect(result.spentMs).toBe(0);
      expect(result.limitMs).toBe(DEFAULT_SHORTS_LIMIT_MS);
    });

    it('readShortsBudget returns default on parse error', () => {
      localStorage.setItem(SHORTS_BUDGET_STORAGE_KEY, 'invalid json');
      const result = readShortsBudget();
      expect(result.spentMs).toBe(0);
    });

    it('writeShortsBudget persists and readShortsBudget retrieves', () => {
      const now = new Date(2025, 0, 15);
      const ledger: ShortsBudgetLedger = {
        dayKey: '2025-01-15',
        spentMs: 1800000,
        limitMs: 3600000,
      };
      writeShortsBudget(ledger);
      const result = readShortsBudget(now);
      expect(result).toEqual(ledger);
    });

    it('writeShortsBudget swallows storage errors', () => {
      const ledger: ShortsBudgetLedger = {
        dayKey: '2025-01-15',
        spentMs: 1800000,
        limitMs: 3600000,
      };
      const mockSetItem = jest
        .spyOn(Storage.prototype, 'setItem')
        .mockImplementation(() => {
          throw new Error('Quota exceeded');
        });
      expect(() => writeShortsBudget(ledger)).not.toThrow();
      mockSetItem.mockRestore();
    });
  });
});
