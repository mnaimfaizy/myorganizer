'use client';

import { Input, Label } from '@myorganizer/web-ui';
import { useCallback, useState } from 'react';
import {
  formatShortsDuration,
  MAX_SHORTS_LIMIT_MINUTES,
  MIN_SHORTS_LIMIT_MINUTES,
} from '../hooks';

interface ShortsBudgetMeterProps {
  spentMs: number;
  limitMs: number;
  remainingMs: number;
  usedPercent: number;
  locked: boolean;
  metering: boolean;
  onLimitMinutesChange: (minutes: number) => void;
}

/**
 * Renders the Shorts Daily Budget meter with progress visualization and
 * a numeric minutes control for the daily limit.
 *
 * The progress bar shows time used vs. the limit without relying on color alone.
 * Remaining time is in a polite live region so assistive tech hears meaningful
 * changes without being spammed. Announcements key off whole remaining minutes
 * and the locked transition, not every second tick.
 *
 * The limit input immediately fires onChange for any valid number and ignores
 * empty or non-numeric entries — never sends NaN.
 */
export function ShortsBudgetMeter({
  spentMs,
  limitMs,
  remainingMs,
  usedPercent,
  locked,
  metering,
  onLimitMinutesChange,
}: ShortsBudgetMeterProps) {
  const [inputValue, setInputValue] = useState<string>(() =>
    String(Math.round(limitMs / 60_000)),
  );
  const [syncedLimitMs, setSyncedLimitMs] = useState(limitMs);

  // Adjust state during render when the committed limit changes (e.g., via another tab).
  if (syncedLimitMs !== limitMs) {
    setSyncedLimitMs(limitMs);
    setInputValue(String(Math.round(limitMs / 60_000)));
  }

  // Coarsened to whole minutes so the polite region announces on a meaningful
  // step rather than on every one-second metering tick.
  const remainingMinutes = Math.ceil(remainingMs / 60_000);
  const announcement = locked
    ? 'Shorts Daily Budget spent for today. Shorts stay locked until local midnight.'
    : `${remainingMinutes} ${
        remainingMinutes === 1 ? 'minute' : 'minutes'
      } of Shorts Daily Budget remaining today.`;

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setInputValue(value);

      // Only fire onChange for a valid integer within bounds; ignore empty or NaN.
      const parsed = parseInt(value, 10);
      if (Number.isFinite(parsed) && value.trim() !== '') {
        if (
          parsed >= MIN_SHORTS_LIMIT_MINUTES &&
          parsed <= MAX_SHORTS_LIMIT_MINUTES
        ) {
          onLimitMinutesChange(parsed);
        }
      }
    },
    [onLimitMinutesChange],
  );

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      {/* Header: time used and remaining */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Shorts Daily Budget
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {formatShortsDuration(spentMs)} used today
          </p>
        </div>
        <div className="text-right">
          {/*
            The visible countdown ticks every second, so it must not be the
            live region — a screen reader would read it aloud once a second.
            The announcement below carries the same state at whole-minute
            granularity, so its text only changes on a coarse step.
          */}
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {formatShortsDuration(remainingMs)} remaining
          </p>
          {metering && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              (metering…)
            </p>
          )}
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      {/* Progress bar: shows usage with text label, not color alone */}
      <div className="space-y-2">
        <div className="flex h-6 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            // Reduced motion is honoured in CSS rather than sniffed in JS —
            // the variant tracks the OS preference live, with no effect,
            // no state, and nothing to go stale.
            className="bg-blue-500 transition-all duration-300 motion-reduce:transition-none"
            style={{ width: `${Math.min(usedPercent, 100)}%` }}
            role="progressbar"
            aria-valuenow={usedPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${usedPercent}% of daily Shorts budget used`}
          />
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {usedPercent}% used
        </p>
      </div>

      {/* Limit control: numeric input */}
      <div className="space-y-2">
        <Label htmlFor="shorts-limit-minutes" className="text-sm">
          Daily limit (minutes)
        </Label>
        <Input
          id="shorts-limit-minutes"
          type="number"
          inputMode="numeric"
          min={MIN_SHORTS_LIMIT_MINUTES}
          max={MAX_SHORTS_LIMIT_MINUTES}
          value={inputValue}
          onChange={handleInputChange}
          className="w-full"
          // Deliberately editable while locked: raising the limit is the one
          // sanctioned way to get time back today (PRD #264 user story 18), and
          // the banner below says so. Disabling it here would make that promise
          // unactionable. It is not a Hard Stop bypass — the escape the Hard
          // Stop blocks is leaving for YouTube, not the User's own daily cap.
        />
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Min: {MIN_SHORTS_LIMIT_MINUTES} min • Max: {MAX_SHORTS_LIMIT_MINUTES}{' '}
          min
        </p>
      </div>

      {/* Locked state banner with live announcement */}
      {locked && (
        <div
          className="rounded bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
          role="status"
          aria-live="polite"
        >
          Today's Shorts budget is exhausted. Raising the daily limit gives time
          back today.
        </div>
      )}
    </div>
  );
}
