import { describe, expect, test } from '@jest/globals';
import { INTERVAL_MS, isBackupDue } from './scheduler';

describe('isBackupDue', () => {
  const now = 1_700_000_000_000;

  test('returns false when interval is off', () => {
    expect(
      isBackupDue({
        interval: 'off',
        lastSuccessMs: now - 365 * 86400_000,
        nowMs: now,
      }),
    ).toBe(false);
  });

  test('returns true when no prior success exists for daily', () => {
    expect(
      isBackupDue({ interval: 'daily', lastSuccessMs: null, nowMs: now }),
    ).toBe(true);
  });

  test('returns false when daily threshold not yet elapsed', () => {
    const last = now - 23 * 60 * 60 * 1000;
    expect(
      isBackupDue({ interval: 'daily', lastSuccessMs: last, nowMs: now }),
    ).toBe(false);
  });

  test('returns true when daily threshold elapsed', () => {
    const last = now - (INTERVAL_MS.daily ?? 0);
    expect(
      isBackupDue({ interval: 'daily', lastSuccessMs: last, nowMs: now }),
    ).toBe(true);
  });

  test('returns false when weekly threshold not yet elapsed', () => {
    const last = now - 6 * 86400_000;
    expect(
      isBackupDue({ interval: 'weekly', lastSuccessMs: last, nowMs: now }),
    ).toBe(false);
  });

  test('returns true when monthly threshold elapsed', () => {
    const last = now - (INTERVAL_MS.monthly ?? 0) - 1;
    expect(
      isBackupDue({ interval: 'monthly', lastSuccessMs: last, nowMs: now }),
    ).toBe(true);
  });
});
