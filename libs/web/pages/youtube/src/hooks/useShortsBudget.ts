'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SHORTS_BUDGET_STORAGE_KEY,
  isShortsLocked,
  localDayKey,
  normalizeShortsBudget,
  readShortsBudget,
  remainingShortsMs,
  withShortsLimit,
  withShortsSpend,
  writeShortsBudget,
  type ShortsBudgetLedger,
} from '../lib/shortsBudget';

/** How often the meter samples the clock while a Short is being watched. */
const TICK_MS = 1000;

export interface ShortsBudget {
  /** Metered wall-clock milliseconds spent on Shorts today. */
  spentMs: number;
  /** The configured Shorts Daily Budget in milliseconds. */
  limitMs: number;
  /** Budget left today, floored at zero. */
  remainingMs: number;
  /** Whole percent of today's budget consumed, 0–100. */
  usedPercent: number;
  /** True once the budget is exhausted — the Shorts Hard Stop is in force. */
  locked: boolean;
  /** Local calendar day the ledger belongs to (`YYYY-MM-DD`). */
  dayKey: string;
  /** True while wall-clock time is actually accruing. */
  metering: boolean;
  /** Applies a new limit to today's remaining budget immediately. */
  setLimitMinutes: (minutes: number) => void;
}

function isPageVisible(): boolean {
  if (typeof document === 'undefined') return false;
  return document.visibilityState === 'visible';
}

/**
 * Shorts Daily Budget metering and Shorts Hard Stop state (PRD #264 user
 * stories 15–19, decisions #245 / #251).
 *
 * Metering is **visibility-aware wall clock**: time accrues only while `active`
 * is true *and* the page is visible, sampled from `Date.now()` deltas rather
 * than counted ticks. A backgrounded tab, a throttled timer, or a sleeping
 * machine therefore cannot silently burn budget, and it cannot under-count a
 * foreground tab whose interval the browser has slowed down either.
 *
 * The ledger is shared across every tab in the browser profile. Sibling tabs
 * are followed through the `storage` event and reconciled by taking the larger
 * spend for the day, so two open Shorts tabs cannot each spend a full budget.
 *
 * Rollover is checked on every tick, so a session running through local
 * midnight unlocks in place without a reload.
 *
 * @param active whether a Short is currently being watched.
 */
export function useShortsBudget(active: boolean): ShortsBudget {
  const [ledger, setLedger] = useState<ShortsBudgetLedger>(() =>
    readShortsBudget(),
  );

  // Timestamp of the last sample while metering; null whenever metering is
  // paused, so a resume never back-charges the gap.
  const lastSampleRef = useRef<number | null>(null);

  const applyLedger = useCallback(
    (
      update: (previous: ShortsBudgetLedger) => ShortsBudgetLedger,
      { persist = true }: { persist?: boolean } = {},
    ) => {
      setLedger((previous) => {
        const next = update(previous);
        if (next === previous) return previous;
        if (persist) writeShortsBudget(next);
        return next;
      });
    },
    [],
  );

  const setLimitMinutes = useCallback(
    (minutes: number) => {
      if (!Number.isFinite(minutes)) return;
      applyLedger((previous) => withShortsLimit(previous, minutes * 60_000));
    },
    [applyLedger],
  );

  // Metering loop. Restarting on `active` alone keeps the effect body small;
  // visibility is read at sample time rather than resubscribed on every change.
  useEffect(() => {
    if (!active) {
      lastSampleRef.current = null;
      return;
    }

    const sample = () => {
      const now = Date.now();
      const previousSample = lastSampleRef.current;

      if (!isPageVisible()) {
        // Hidden: drop the anchor so the hidden stretch is never charged.
        lastSampleRef.current = null;
        return;
      }

      lastSampleRef.current = now;
      if (previousSample === null) return;

      const elapsedMs = now - previousSample;
      if (elapsedMs <= 0) return;

      applyLedger((previous) => {
        const dayKey = localDayKey(new Date(now));
        // Crossing local midnight mid-session resets spend but keeps the limit,
        // and the elapsed slice is charged against the new day.
        const base =
          previous.dayKey === dayKey
            ? previous
            : { dayKey, spentMs: 0, limitMs: previous.limitMs };
        if (isShortsLocked(base)) return base;
        return withShortsSpend(base, elapsedMs);
      });
    };

    const handleVisibilityChange = () => {
      // Re-anchor on the transition itself so the first tick after returning
      // charges only the visible portion.
      lastSampleRef.current = isPageVisible() ? Date.now() : null;
    };

    lastSampleRef.current = isPageVisible() ? Date.now() : null;
    document.addEventListener('visibilitychange', handleVisibilityChange);
    const intervalId = window.setInterval(sample, TICK_MS);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      lastSampleRef.current = null;
    };
  }, [active, applyLedger]);

  // Sibling tabs in the same browser profile share one ledger.
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== SHORTS_BUDGET_STORAGE_KEY) return;

      let incoming: ShortsBudgetLedger;
      try {
        incoming = normalizeShortsBudget(
          event.newValue ? JSON.parse(event.newValue) : null,
        );
      } catch {
        return;
      }

      applyLedger(
        (previous) => {
          if (previous.dayKey !== incoming.dayKey) return incoming;
          // Take the larger spend: two tabs metering the same day must not let
          // the slower one hand budget back.
          const spentMs = Math.max(previous.spentMs, incoming.spentMs);
          if (
            spentMs === previous.spentMs &&
            incoming.limitMs === previous.limitMs
          ) {
            return previous;
          }
          return { ...previous, spentMs, limitMs: incoming.limitMs };
        },
        // The writing tab already persisted this; echoing it back would loop.
        { persist: false },
      );
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [applyLedger]);

  // A page left open overnight with nothing playing still has to unlock at
  // local midnight, so rollover is not left to the metering loop alone.
  useEffect(() => {
    const checkRollover = () => {
      applyLedger((previous) => {
        const dayKey = localDayKey();
        if (previous.dayKey === dayKey) return previous;
        return { dayKey, spentMs: 0, limitMs: previous.limitMs };
      });
    };

    const intervalId = window.setInterval(checkRollover, TICK_MS);
    return () => window.clearInterval(intervalId);
  }, [applyLedger]);

  const remainingMs = remainingShortsMs(ledger);
  const locked = isShortsLocked(ledger);

  return useMemo(
    () => ({
      spentMs: ledger.spentMs,
      limitMs: ledger.limitMs,
      remainingMs,
      usedPercent:
        ledger.limitMs > 0
          ? Math.min(100, Math.round((ledger.spentMs / ledger.limitMs) * 100))
          : 100,
      locked,
      dayKey: ledger.dayKey,
      metering: active && !locked,
      setLimitMinutes,
    }),
    [ledger, remainingMs, locked, active, setLimitMinutes],
  );
}
