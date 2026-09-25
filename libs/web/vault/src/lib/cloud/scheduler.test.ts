import { afterEach, describe, expect, test } from '@jest/globals';
import {
  ESCAPE_COPY_AGE_LIMIT_MS,
  isEscapeCopyOverdue,
  startScheduler,
} from './scheduler';

describe('isEscapeCopyOverdue', () => {
  const now = 1_700_000_000_000;
  const oneDayMs = ESCAPE_COPY_AGE_LIMIT_MS['1-day'];

  test('returns false when ageLimit is off', () => {
    expect(
      isEscapeCopyOverdue({
        ageLimit: 'off',
        newestCopyMs: now - 365 * 24 * 60 * 60 * 1000,
        nowMs: now,
      }),
    ).toBe(false);
  });

  test('returns true when no copy exists', () => {
    expect(
      isEscapeCopyOverdue({
        ageLimit: '1-week',
        newestCopyMs: null,
        nowMs: now,
      }),
    ).toBe(true);
  });

  test('returns true when copy is exactly at age limit (1-day)', () => {
    const copyTime = now - oneDayMs;
    expect(
      isEscapeCopyOverdue({
        ageLimit: '1-day',
        newestCopyMs: copyTime,
        nowMs: now,
      }),
    ).toBe(true);
  });

  test('returns false when copy is 1ms younger than age limit (1-day)', () => {
    const copyTime = now - oneDayMs + 1;
    expect(
      isEscapeCopyOverdue({
        ageLimit: '1-day',
        newestCopyMs: copyTime,
        nowMs: now,
      }),
    ).toBe(false);
  });
});

describe('startScheduler', () => {
  const now = 1_700_000_000_000;
  const oneDayMs = ESCAPE_COPY_AGE_LIMIT_MS['1-day'];
  let handle: ReturnType<typeof startScheduler> | null = null;

  afterEach(() => {
    if (handle) {
      handle.stop();
      handle = null;
    }
  });

  test('checkOnce returns in-flight when already stopped', async () => {
    handle = startScheduler({
      getAgeLimit: () => '1-day',
      getNewestCopyMs: async () => null,
      canRunWithoutPrompt: () => true,
      runBackup: async () => undefined,
      now: () => now,
    });
    handle.stop();

    const result = await handle.checkOnce();
    expect(result).toEqual({ ranBackup: false, skipped: 'in-flight' });
  });

  test('checkOnce returns skipped off when ageLimit is off', async () => {
    const getNewestCopyMs = jest.fn(async () => null);
    const canRunWithoutPrompt = jest.fn(() => true);
    const runBackup = jest.fn(async () => undefined);

    handle = startScheduler({
      getAgeLimit: () => 'off',
      getNewestCopyMs,
      canRunWithoutPrompt,
      runBackup,
      now: () => now,
    });

    const result = await handle.checkOnce();
    expect(result).toEqual({ ranBackup: false, skipped: 'off' });
    expect(getNewestCopyMs).not.toHaveBeenCalled();
    expect(canRunWithoutPrompt).not.toHaveBeenCalled();
    expect(runBackup).not.toHaveBeenCalled();
  });

  test('checkOnce returns skipped not-overdue when copy is fresh', async () => {
    const recentCopyMs = now - oneDayMs / 2;
    const canRunWithoutPrompt = jest.fn(() => true);
    const runBackup = jest.fn(async () => undefined);

    handle = startScheduler({
      getAgeLimit: () => '1-day',
      getNewestCopyMs: async () => recentCopyMs,
      canRunWithoutPrompt,
      runBackup,
      now: () => now,
    });

    const result = await handle.checkOnce();
    expect(result).toEqual({ ranBackup: false, skipped: 'not-overdue' });
    expect(canRunWithoutPrompt).not.toHaveBeenCalled();
    expect(runBackup).not.toHaveBeenCalled();
  });

  test('checkOnce returns skipped needs-prompt when overdue but cannot run without prompt', async () => {
    const staleCopyMs = now - oneDayMs;
    const runBackup = jest.fn(async () => undefined);

    handle = startScheduler({
      getAgeLimit: () => '1-day',
      getNewestCopyMs: async () => staleCopyMs,
      canRunWithoutPrompt: () => false,
      runBackup,
      now: () => now,
    });

    const result = await handle.checkOnce();
    expect(result).toEqual({ ranBackup: false, skipped: 'needs-prompt' });
    expect(runBackup).not.toHaveBeenCalled();
  });

  test('checkOnce runs backup when overdue and can run without prompt', async () => {
    const staleCopyMs = now - oneDayMs;
    const runBackup = jest.fn(async () => undefined);

    handle = startScheduler({
      getAgeLimit: () => '1-day',
      getNewestCopyMs: async () => staleCopyMs,
      canRunWithoutPrompt: () => true,
      runBackup,
      now: () => now,
    });

    const result = await handle.checkOnce();
    expect(result).toEqual({ ranBackup: true });
    expect(runBackup).toHaveBeenCalledTimes(1);
  });

  test('checkOnce returns in-flight when backup is already in progress', async () => {
    const gate: { resolve?: () => void } = {};
    const backupPromise = new Promise<void>((resolve) => {
      gate.resolve = resolve;
    });
    const runBackup = jest.fn(() => backupPromise);

    handle = startScheduler({
      getAgeLimit: () => '1-day',
      getNewestCopyMs: async () => null,
      canRunWithoutPrompt: () => true,
      runBackup,
      now: () => now,
    });

    // Start first backup (don't await it yet)
    const firstPromise = handle.checkOnce();

    // Yield control to allow first checkOnce to mark in-flight before second call
    await Promise.resolve();

    // Call checkOnce again while first is in flight
    const secondResult = await handle.checkOnce();
    expect(secondResult).toEqual({ ranBackup: false, skipped: 'in-flight' });
    expect(runBackup).toHaveBeenCalledTimes(1);

    // Resolve the first backup
    gate.resolve?.();
    const firstResult = await firstPromise;
    expect(firstResult).toEqual({ ranBackup: true });
  });

  test('checkOnce can run after a prior backup completes', async () => {
    let staleTime = now - oneDayMs;
    const runBackup = jest.fn(async () => undefined);

    handle = startScheduler({
      getAgeLimit: () => '1-day',
      getNewestCopyMs: async () => staleTime,
      canRunWithoutPrompt: () => true,
      runBackup,
      now: () => now,
    });

    const firstResult = await handle.checkOnce();
    expect(firstResult).toEqual({ ranBackup: true });
    expect(runBackup).toHaveBeenCalledTimes(1);

    // Reset for a second call
    staleTime = now - oneDayMs;
    const secondResult = await handle.checkOnce();
    expect(secondResult).toEqual({ ranBackup: true });
    expect(runBackup).toHaveBeenCalledTimes(2);
  });
});
