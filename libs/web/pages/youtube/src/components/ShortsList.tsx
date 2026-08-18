'use client';

import type { YouTubeVideo } from '../types';
import { formatRuntimeSeconds } from '../lib/formatRuntimeSeconds';

interface ShortsListProps {
  shorts: YouTubeVideo[];
  selectedShortId: string | null;
  onSelectShort: (videoId: string) => void;
}

/**
 * "All Shorts" picker for the Shorts page.
 *
 * One row definition, rendered once. The two layouts — a horizontal scroller
 * below `lg`, a vertical side rail at `lg` and up — are a pure CSS concern, so
 * there is a single place where a row's fields, accessible name, and Watched
 * state live. Maintaining a second breakpoint-specific copy is how the mobile
 * rendering previously drifted into dropping runtime and weakening its label.
 *
 * Accessibility: every row is a `type="button"` with an explicit accessible
 * name covering title, channel, and Watched/New; the active row carries
 * `aria-current`; thumbnails are decorative (`alt=""`) inside the labelled
 * button; and Watched state is conveyed as text, never by colour alone.
 */
export function ShortsList({
  shorts,
  selectedShortId,
  onSelectShort,
}: ShortsListProps) {
  if (shorts.length === 0) return null;

  return (
    <div className="lg:w-64 lg:flex-shrink-0">
      <p
        id="shorts-list-heading"
        className="mb-1 px-1 text-xs font-semibold text-gray-500 dark:text-gray-400"
      >
        All Shorts
      </p>
      <div
        aria-labelledby="shorts-list-heading"
        className="flex gap-2 overflow-x-auto rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-900 lg:max-h-[70vh] lg:flex-col lg:overflow-x-hidden lg:overflow-y-auto"
      >
        {shorts.map((short) => {
          const isActive = selectedShortId === short.videoId;
          const runtime = formatRuntimeSeconds(short.durationSeconds);
          const watchedLabel = short.watched ? ' (Watched)' : ' (New)';
          const accessibleName = `${short.title}, ${short.channelTitle}${watchedLabel}`;

          return (
            <button
              key={short.videoId}
              type="button"
              onClick={() => onSelectShort(short.videoId)}
              aria-current={isActive ? 'true' : undefined}
              aria-label={accessibleName}
              className={`w-32 flex-shrink-0 overflow-hidden rounded-lg p-2 text-left text-xs transition-colors motion-reduce:transition-none lg:w-auto ${
                isActive
                  ? 'bg-blue-100 dark:bg-blue-900/30'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <div className="aspect-video overflow-hidden rounded bg-gray-300 dark:bg-gray-700">
                {short.thumbnail ? (
                  <img
                    src={short.thumbnail}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <p className="mt-1 line-clamp-2 font-medium text-gray-900 dark:text-gray-100">
                {short.title}
              </p>
              <div className="mt-0.5 flex items-center justify-between gap-1">
                <span
                  className={
                    short.watched
                      ? 'text-xs text-gray-500 dark:text-gray-400'
                      : 'text-xs font-medium text-blue-600 dark:text-blue-400'
                  }
                >
                  {short.watched ? 'Watched' : 'New'}
                </span>
                {runtime ? (
                  <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
                    {runtime}
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
