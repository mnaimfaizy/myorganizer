'use client';

import { Button } from '@myorganizer/web-ui';
import Link from 'next/link';
import { formatShortsDuration } from '../lib/shortsBudget';

interface ShortsHardStopProps {
  limitMs: number;
}

/**
 * Locked surface shown when the Shorts Daily Budget is exhausted.
 *
 * This is the anti-escape surface: it explains that today's budget is spent
 * and Shorts unlock at local midnight. The only actionable CTA is to return
 * to long-form videos. No player, no Short thumbnails, no video ids, and no
 * "Open on YouTube" links — nothing that links to youtube.com.
 *
 * Announced with role="status" and aria-live="polite" so assistive tech
 * announces the state when the page enters Hard Stop.
 */
export function ShortsHardStop({ limitMs }: ShortsHardStopProps) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 rounded-lg border border-amber-200 bg-amber-50 p-8 dark:border-amber-900 dark:bg-amber-900/20"
      role="status"
      aria-live="polite"
      aria-label="Shorts budget exhausted"
    >
      <div className="rounded-full bg-amber-100 p-4 dark:bg-amber-900/40">
        <svg
          className="h-12 w-12 text-amber-600 dark:text-amber-400"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm0-14c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z" />
        </svg>
      </div>

      <div className="max-w-sm text-center">
        <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-100">
          Today's Shorts Budget Is Exhausted
        </h2>
        <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
          You've watched {formatShortsDuration(limitMs)} of Shorts today.
        </p>
        <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
          Shorts will be available again at midnight local time.
        </p>
        <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
          Raising your daily time limit gives you time back today immediately.
        </p>
      </div>

      <Button asChild className="mt-4">
        <Link href="/dashboard/youtube">Back to Videos</Link>
      </Button>
    </div>
  );
}
