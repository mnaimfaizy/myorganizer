/* eslint-disable import/first */
import '@testing-library/jest-dom';

jest.mock('../lib/shortsBudget', () => ({
  ...jest.requireActual('../lib/shortsBudget'),
  readShortsBudget: jest.fn(),
  writeShortsBudget: jest.fn(),
}));

import { renderHook, act } from '@testing-library/react';
import { readShortsBudget, writeShortsBudget } from '../lib/shortsBudget';
import { useShortsBudget } from './useShortsBudget';

describe('useShortsBudget — metering and state management', () => {
  const getTodayKey = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    localStorage.clear();
    // Default: readable ledger from storage with today's date
    (readShortsBudget as jest.Mock).mockReturnValue({
      dayKey: getTodayKey(),
      spentMs: 0,
      limitMs: 3600000,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('initialization', () => {
    it('reads ledger from storage on mount', () => {
      renderHook(() => useShortsBudget(false));
      expect(readShortsBudget).toHaveBeenCalled();
    });

    it('exposes ledger state in the hook result', () => {
      const { result } = renderHook(() => useShortsBudget(false));
      expect(result.current.spentMs).toBe(0);
      expect(result.current.limitMs).toBe(3600000);
      expect(result.current.locked).toBe(false);
    });

    it('computes usedPercent from spentMs and limitMs', () => {
      (readShortsBudget as jest.Mock).mockReturnValue({
        dayKey: '2025-01-15',
        spentMs: 1800000,
        limitMs: 3600000,
      });
      const { result } = renderHook(() => useShortsBudget(false));
      expect(result.current.usedPercent).toBe(50);
    });
  });

  describe('metering: active and visible', () => {
    it('accrues roughly elapsed time on visible page', () => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      });

      const { result } = renderHook(() => useShortsBudget(true));
      expect(result.current.spentMs).toBe(0);

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(result.current.spentMs).toBeGreaterThan(0);
      expect(result.current.spentMs).toBeLessThanOrEqual(1100);
    });

    it('persists accrued spend to storage', () => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      });

      renderHook(() => useShortsBudget(true));

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(writeShortsBudget).toHaveBeenCalled();
    });

    it('metering=true when active and not locked', () => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      });

      const { result } = renderHook(() => useShortsBudget(true));
      expect(result.current.metering).toBe(true);
    });
  });

  describe('metering: inactive', () => {
    it('does not accrue when active=false', () => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      });

      const { result } = renderHook(() => useShortsBudget(false));
      const initialSpent = result.current.spentMs;

      act(() => {
        jest.advanceTimersByTime(2000);
      });

      expect(result.current.spentMs).toBe(initialSpent);
    });

    it('metering=false when inactive', () => {
      const { result } = renderHook(() => useShortsBudget(false));
      expect(result.current.metering).toBe(false);
    });
  });

  describe('visibility awareness', () => {
    it('does not accrue when page is hidden', () => {
      let visibilityState = 'visible';
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => visibilityState,
      });

      const { result } = renderHook(() => useShortsBudget(true));

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      const visibleSpent = result.current.spentMs;

      act(() => {
        visibilityState = 'hidden';
        document.dispatchEvent(new Event('visibilitychange'));
        jest.advanceTimersByTime(1000);
      });

      const afterHiddenSpent = result.current.spentMs;
      expect(afterHiddenSpent).toBe(visibleSpent);
    });

    it('resumes without back-charging hidden gap', () => {
      let visibilityState = 'visible';
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => visibilityState,
      });

      const { result } = renderHook(() => useShortsBudget(true));

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      const beforeHiddenSpent = result.current.spentMs;

      act(() => {
        visibilityState = 'hidden';
        document.dispatchEvent(new Event('visibilitychange'));
        jest.advanceTimersByTime(2000);
      });

      const whileHiddenSpent = result.current.spentMs;

      act(() => {
        visibilityState = 'visible';
        document.dispatchEvent(new Event('visibilitychange'));
        jest.advanceTimersByTime(1000);
      });

      const afterResumeSpent = result.current.spentMs;
      const accruedAfterResume = afterResumeSpent - whileHiddenSpent;

      expect(whileHiddenSpent).toBe(beforeHiddenSpent);
      expect(accruedAfterResume).toBeGreaterThan(0);
      expect(accruedAfterResume).toBeLessThanOrEqual(1100);
    });
  });

  describe('hard stop', () => {
    it('stops accruing when spentMs reaches limitMs', () => {
      jest.clearAllMocks();
      (readShortsBudget as jest.Mock).mockReturnValueOnce({
        dayKey: getTodayKey(),
        spentMs: 3500000,
        limitMs: 3600000,
      });

      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      });

      const { result } = renderHook(() => useShortsBudget(true));
      expect(result.current.spentMs).toBe(3500000);

      act(() => {
        jest.advanceTimersByTime(200000);
      });

      expect(result.current.spentMs).toBe(3600000);
      expect(result.current.locked).toBe(true);
    });

    it('metering=false when locked', () => {
      jest.clearAllMocks();
      (readShortsBudget as jest.Mock).mockReturnValueOnce({
        dayKey: getTodayKey(),
        spentMs: 3600000,
        limitMs: 3600000,
      });

      const { result } = renderHook(() => useShortsBudget(true));
      expect(result.current.locked).toBe(true);
      expect(result.current.metering).toBe(false);
    });
  });

  describe('midnight rollover', () => {
    it('resets spentMs while preserving limitMs on day change (via real localStorage)', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

      // Seed real localStorage with a yesterday-keyed ledger.
      // This exercises the real normalizeShortsBudget path in readShortsBudget.
      jest.clearAllMocks();
      (readShortsBudget as jest.Mock).mockImplementation(
        jest.requireActual('../lib/shortsBudget').readShortsBudget,
      );
      (writeShortsBudget as jest.Mock).mockImplementation(
        jest.requireActual('../lib/shortsBudget').writeShortsBudget,
      );

      localStorage.setItem(
        'myorganizer.youtube.shorts-budget.v1',
        JSON.stringify({
          dayKey: yesterdayKey,
          spentMs: 1800000,
          limitMs: 3600000,
        }),
      );

      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      });

      const { result } = renderHook(() => useShortsBudget(true));

      // After reading from localStorage with yesterday's dayKey,
      // normalizeShortsBudget resets spentMs to 0 and updates dayKey to today,
      // but preserves the limitMs. This is the rollover behavior at initialization.
      const todayKey = getTodayKey();
      expect(result.current.dayKey).toBe(todayKey);
      expect(result.current.limitMs).toBe(3600000);
      expect(result.current.spentMs).toBe(0);
      expect(result.current.locked).toBe(false);

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // After advancing the timer with active=true and visible=true,
      // the hook accrues roughly 1 second of elapsed time against the new day.
      expect(result.current.dayKey).toBe(todayKey);
      expect(result.current.limitMs).toBe(3600000);
      expect(result.current.spentMs).toBeGreaterThan(0);
      expect(result.current.spentMs).toBeLessThanOrEqual(1100);
    });

    it('rolls over mid-session when day key changes', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

      (readShortsBudget as jest.Mock).mockReturnValueOnce({
        dayKey: yesterdayKey,
        spentMs: 1000000,
        limitMs: 3600000,
      });

      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      });

      const { result } = renderHook(() => useShortsBudget(true));
      expect(result.current.dayKey).toBe(yesterdayKey);

      act(() => {
        jest.advanceTimersByTime(2000);
      });

      const todayKey = getTodayKey();
      expect(result.current.dayKey).toBe(todayKey);
      expect(result.current.spentMs).toBeGreaterThan(0);
      expect(result.current.limitMs).toBe(3600000);
    });
  });

  describe('limit changes', () => {
    it('setLimitMinutes updates limitMs immediately', () => {
      const { result } = renderHook(() => useShortsBudget(false));
      expect(result.current.limitMs).toBe(3600000);

      act(() => {
        result.current.setLimitMinutes(120);
      });

      expect(result.current.limitMs).toBe(7200000);
    });

    it('raising limit unlocks', () => {
      (readShortsBudget as jest.Mock).mockReturnValue({
        dayKey: '2025-01-15',
        spentMs: 3600000,
        limitMs: 3600000,
      });

      const { result } = renderHook(() => useShortsBudget(false));
      expect(result.current.locked).toBe(true);

      act(() => {
        result.current.setLimitMinutes(120);
      });

      expect(result.current.locked).toBe(false);
      expect(result.current.remainingMs).toBe(3600000);
    });

    it('lowering limit locks on the spot', () => {
      (readShortsBudget as jest.Mock).mockReturnValue({
        dayKey: '2025-01-15',
        spentMs: 3000000,
        limitMs: 3600000,
      });

      const { result } = renderHook(() => useShortsBudget(false));
      expect(result.current.locked).toBe(false);

      act(() => {
        result.current.setLimitMinutes(30);
      });

      expect(result.current.locked).toBe(true);
    });

    it('persists limit change to storage', () => {
      const { result } = renderHook(() => useShortsBudget(false));

      act(() => {
        result.current.setLimitMinutes(120);
      });

      expect(writeShortsBudget).toHaveBeenCalled();
    });

    it('ignores non-finite setLimitMinutes argument', () => {
      const { result } = renderHook(() => useShortsBudget(false));
      const initialLimit = result.current.limitMs;

      act(() => {
        result.current.setLimitMinutes(NaN);
      });

      expect(result.current.limitMs).toBe(initialLimit);
    });

    it('clamps limit to [1-180] minutes', () => {
      const { result } = renderHook(() => useShortsBudget(false));

      act(() => {
        result.current.setLimitMinutes(0.5);
      });

      expect(result.current.limitMs).toBe(60 * 1000); // MIN_SHORTS_LIMIT_MS

      act(() => {
        result.current.setLimitMinutes(300);
      });

      expect(result.current.limitMs).toBe(3 * 60 * 60 * 1000); // MAX_SHORTS_LIMIT_MS
    });
  });

  describe('cross-tab synchronization', () => {
    it('raises spentMs when sibling tab spends more', () => {
      const todayKey = getTodayKey();
      const { result } = renderHook(() => useShortsBudget(false));
      expect(result.current.spentMs).toBe(0);

      act(() => {
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: 'myorganizer.youtube.shorts-budget.v1',
            newValue: JSON.stringify({
              dayKey: todayKey,
              spentMs: 1800000,
              limitMs: 3600000,
            }),
          }),
        );
      });

      expect(result.current.spentMs).toBe(1800000);
    });

    it('keeps higher spentMs when sibling tab spends less (max-wins)', () => {
      const todayKey = getTodayKey();
      (readShortsBudget as jest.Mock).mockReturnValue({
        dayKey: todayKey,
        spentMs: 2000000,
        limitMs: 3600000,
      });

      const { result } = renderHook(() => useShortsBudget(false));
      expect(result.current.spentMs).toBe(2000000);

      act(() => {
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: 'myorganizer.youtube.shorts-budget.v1',
            newValue: JSON.stringify({
              dayKey: todayKey,
              spentMs: 1000000,
              limitMs: 3600000,
            }),
          }),
        );
      });

      expect(result.current.spentMs).toBe(2000000);
    });

    it('syncs limit from sibling tab for same day', () => {
      const todayKey = getTodayKey();
      const { result } = renderHook(() => useShortsBudget(false));
      expect(result.current.dayKey).toBe(todayKey);
      expect(result.current.limitMs).toBe(3600000);

      act(() => {
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: 'myorganizer.youtube.shorts-budget.v1',
            newValue: JSON.stringify({
              dayKey: todayKey,
              spentMs: 1000000,
              limitMs: 7200000,
            }),
          }),
        );
      });

      expect(result.current.dayKey).toBe(todayKey);
      expect(result.current.limitMs).toBe(7200000);
    });

    it('ignores storage event with invalid JSON', () => {
      const { result } = renderHook(() => useShortsBudget(false));
      const initialSpent = result.current.spentMs;

      act(() => {
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: 'myorganizer.youtube.shorts-budget.v1',
            newValue: 'invalid json',
          }),
        );
      });

      expect(result.current.spentMs).toBe(initialSpent);
    });

    it('ignores storage event for different key', () => {
      const { result } = renderHook(() => useShortsBudget(false));
      const initialSpent = result.current.spentMs;

      act(() => {
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: 'some-other-key',
            newValue: JSON.stringify({
              dayKey: '2025-01-15',
              spentMs: 9999999,
              limitMs: 3600000,
            }),
          }),
        );
      });

      expect(result.current.spentMs).toBe(initialSpent);
    });
  });

  describe('computed fields', () => {
    it('remainingMs floors at 0 when overspent', () => {
      (readShortsBudget as jest.Mock).mockReturnValue({
        dayKey: '2025-01-15',
        spentMs: 3600001,
        limitMs: 3600000,
      });

      const { result } = renderHook(() => useShortsBudget(false));
      expect(result.current.remainingMs).toBe(0);
    });

    it('usedPercent caps at 100', () => {
      (readShortsBudget as jest.Mock).mockReturnValue({
        dayKey: '2025-01-15',
        spentMs: 3600001,
        limitMs: 3600000,
      });

      const { result } = renderHook(() => useShortsBudget(false));
      expect(result.current.usedPercent).toBe(100);
    });

    it('usedPercent handles zero limitMs', () => {
      (readShortsBudget as jest.Mock).mockReturnValue({
        dayKey: '2025-01-15',
        spentMs: 0,
        limitMs: 0,
      });

      const { result } = renderHook(() => useShortsBudget(false));
      expect(result.current.usedPercent).toBe(100);
    });
  });
});
