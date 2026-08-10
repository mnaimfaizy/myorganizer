'use client';

import { Button, Skeleton } from '@myorganizer/web-ui';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useShortsBudget, useYouTubeShorts, useYouTubeStatus } from '../hooks';
import { updateVideoWatched } from '../hooks';
import { YouTubeVideoPlayer } from './YouTubeVideoPlayer';
import { ShortsEntryWarning } from './ShortsEntryWarning';
import { ShortsBudgetMeter } from './ShortsBudgetMeter';
import { ShortsHardStop } from './ShortsHardStop';

/**
 * Shorts page client — orchestrates the focused Shorts watching experience.
 *
 * The page follows this flow:
 *
 * 1. Connection gate: if not connected to YouTube, show a prompt to connect.
 * 2. Entry warning: on first mount or navigation, block the page with an entry
 *    gate that explains the Shorts time cap and requires acknowledgement.
 * 3. Budget meter: render the meter in both active and locked states, wired to
 *    `budget.setLimitMinutes`.
 * 4. Active state: if acknowledged and not locked, render the active Short with
 *    Previous/Next navigation, wrapping, and a side list of all Shorts.
 * 5. Locked state: if budget is exhausted, render the Hard Stop surface.
 *
 * Watched/New state is independent of budgeting and uses the same rules as
 * long-form. Failures to update watched state do not crash the page.
 *
 * Metering must not run behind the entry warning or the Hard Stop, so `active`
 * is false until acknowledged and not locked.
 */
export function ShortsPageClient() {
  const { connected, status } = useYouTubeStatus();
  const {
    shorts,
    loading,
    error,
    updateWatched,
    refresh: refreshShorts,
  } = useYouTubeShorts();
  const [acknowledged, setAcknowledged] = useState(false);
  const [selectedShortId, setSelectedShortId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [lockedAtLastRender, setLockedAtLastRender] = useState(false);

  // Metering runs only while a Short is genuinely being watched: the entry
  // warning has been acknowledged and the User has actually started playback.
  // `budget.locked` cannot be part of this expression — it comes out of the very
  // hook being fed — so the Hard Stop case is covered from both sides instead:
  // the render adjustment below clears `playing` the moment the budget locks,
  // and `useShortsBudget` refuses to accrue against an exhausted budget anyway.
  const budget = useShortsBudget(acknowledged && playing);

  // Derive the active Short: use selection if it exists in the list, otherwise fall back to first.
  // This handles both initial load (selection is null, use first) and refresh (selection may vanish).
  const activeShort =
    shorts.find((s) => s.videoId === selectedShortId) ?? shorts[0] ?? null;
  const activeShortId = activeShort?.videoId ?? null;
  const activeIndex = activeShort ? shorts.indexOf(activeShort) : -1;

  // Adjust state during render: reset playing when budget locks to prevent metering at midnight.
  if (budget.locked && !lockedAtLastRender) {
    setLockedAtLastRender(true);
    setPlaying(false);
  } else if (!budget.locked && lockedAtLastRender) {
    setLockedAtLastRender(false);
  }

  const handleContinueToShorts = useCallback(() => {
    setAcknowledged(true);
  }, []);

  const handleRetry = useCallback(() => {
    refreshShorts();
  }, [refreshShorts]);

  const handlePreviousShort = useCallback(() => {
    if (shorts.length === 0) return;
    const previousIndex =
      activeIndex <= 0 ? shorts.length - 1 : activeIndex - 1;
    setSelectedShortId(shorts[previousIndex].videoId);
    setPlaying(false);
  }, [activeIndex, shorts]);

  const handleNextShort = useCallback(() => {
    if (shorts.length === 0) return;
    const nextIndex = activeIndex >= shorts.length - 1 ? 0 : activeIndex + 1;
    setSelectedShortId(shorts[nextIndex].videoId);
    setPlaying(false);
  }, [activeIndex, shorts]);

  const handleSelectShort = useCallback((videoId: string) => {
    setSelectedShortId(videoId);
    setPlaying(false);
  }, []);

  const handlePlay = useCallback(() => {
    setPlaying(true);
  }, []);

  const handleNearEnd = useCallback(() => {
    // Mark as watched when near the end.
    if (!activeShort) return;
    updateWatched(activeShort.videoId, true);
    void updateVideoWatched(activeShort.videoId, true).catch(() => {
      // Failure does not crash the page; local state already updated optimistically.
    });
  }, [activeShort, updateWatched]);

  const handleWatchedToggle = useCallback(
    (videoId: string, watched: boolean) => {
      updateWatched(videoId, watched);
      void updateVideoWatched(videoId, watched).catch(() => {
        // Failure does not crash the page; local state already updated optimistically.
      });
    },
    [updateWatched],
  );

  const handleWatchedToggleClick = useCallback(() => {
    if (!activeShort) return;
    handleWatchedToggle(activeShort.videoId, !activeShort.watched);
  }, [activeShort, handleWatchedToggle]);

  // Arrow key navigation: ArrowUp/Left → previous, ArrowDown/Right → next
  // Only active when viewing Shorts and not in Hard Stop state.
  useEffect(() => {
    if (!acknowledged || budget.locked || shorts.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if focus is in an editable field
      if (!(e.target instanceof HTMLElement)) return;
      const target = e.target as HTMLElement;
      const isInEditableField =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;

      if (isInEditableField) return;

      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePreviousShort();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextShort();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    acknowledged,
    budget.locked,
    shorts.length,
    handlePreviousShort,
    handleNextShort,
  ]);

  // Connection gate
  if (status === 'loading') {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <div className="rounded-full bg-red-100 p-4 dark:bg-red-900/30">
          <svg
            viewBox="0 0 24 24"
            className="h-12 w-12 text-red-600 dark:text-red-400"
            fill="currentColor"
          >
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Connect Your YouTube Account
        </h2>
        <p className="max-w-md text-center text-sm text-gray-500">
          Link your YouTube account to watch Shorts. We only request read-only
          access.
        </p>
        <Button asChild>
          <Link href="/dashboard/youtube">Back to Videos</Link>
        </Button>
      </div>
    );
  }

  // Page header
  const header = (
    <div className="border-b border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Shorts
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Time-capped daily budget. Long-form videos have no limit.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard/youtube">Videos</Link>
        </Button>
      </div>
    </div>
  );

  // Entry warning gate
  if (!acknowledged) {
    return (
      <>
        {header}
        <div className="flex flex-1 items-center justify-center p-8">
          <ShortsEntryWarning
            limitMs={budget.limitMs}
            remainingMs={budget.remainingMs}
            onContinue={handleContinueToShorts}
          />
        </div>
      </>
    );
  }

  // Render budget meter in both active and locked states
  const meterSection = (
    <div className="border-b border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <ShortsBudgetMeter
        spentMs={budget.spentMs}
        limitMs={budget.limitMs}
        remainingMs={budget.remainingMs}
        usedPercent={budget.usedPercent}
        locked={budget.locked}
        metering={budget.metering}
        onLimitMinutesChange={budget.setLimitMinutes}
      />
    </div>
  );

  // Hard Stop: locked state
  if (budget.locked) {
    return (
      <>
        {header}
        {meterSection}
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
          <ShortsHardStop limitMs={budget.limitMs} />
        </div>
      </>
    );
  }

  // Main content: player + navigation + list
  return (
    <>
      {header}
      {meterSection}

      <div className="flex flex-1 gap-4 p-4">
        {/* Player + navigation */}
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          {loading && !shorts.length ? (
            <div className="w-full max-w-sm space-y-2">
              <Skeleton className="aspect-video" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : error && !shorts.length ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center dark:border-red-900 dark:bg-red-900/20">
              <p className="text-sm font-semibold text-red-900 dark:text-red-100">
                Failed to load Shorts
              </p>
              <p className="mt-1 text-xs text-red-800 dark:text-red-200">
                {error}
              </p>
              <Button onClick={handleRetry} variant="outline" className="mt-3">
                Retry
              </Button>
            </div>
          ) : shorts.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-900">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                No Shorts Yet
              </p>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                We can&apos;t tell yet which of your saved videos are Shorts, so
                there is nothing to show here. Your daily limit is still set and
                ready. In the meantime, your long-form videos are unaffected.
              </p>
            </div>
          ) : activeShort ? (
            <>
              {/* Short player — portrait 9:16 */}
              <div className="w-full max-w-sm">
                <div className="aspect-[9/16] overflow-hidden rounded-lg bg-black">
                  <YouTubeVideoPlayer
                    video={activeShort}
                    watched={activeShort.watched}
                    onNearEnd={handleNearEnd}
                    onPlay={handlePlay}
                    defaultPlaying={false}
                    className="h-full w-full"
                  />
                </div>
              </div>

              {/* Short info + navigation */}
              <div className="w-full max-w-sm space-y-3">
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100">
                    {activeShort.title}
                  </h2>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {activeShort.channelTitle}
                  </p>
                </div>

                {/* Watched toggle */}
                <Button
                  variant="outline"
                  onClick={handleWatchedToggleClick}
                  className="w-full"
                >
                  {activeShort.watched ? 'Mark as New' : 'Mark as Watched'}
                </Button>

                {/* Previous/Next */}
                <div className="flex gap-2">
                  <Button
                    onClick={handlePreviousShort}
                    variant="outline"
                    className="flex-1"
                  >
                    ← Prev
                  </Button>
                  <Button
                    onClick={handleNextShort}
                    variant="outline"
                    className="flex-1"
                  >
                    Next →
                  </Button>
                </div>

                {/* Short index with live region for announcement */}
                <p
                  className="text-center text-xs text-gray-500 dark:text-gray-400"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  Short {activeIndex >= 0 ? activeIndex + 1 : 0} of{' '}
                  {shorts.length}
                </p>
              </div>
            </>
          ) : null}
        </div>

        {/* Side list of all Shorts */}
        <div className="hidden w-64 flex-col gap-2 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-900 lg:flex">
          <p className="px-2 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
            All Shorts
          </p>
          {shorts.map((short) => {
            const isActive = activeShortId === short.videoId;
            const watchedLabel = short.watched ? ' (Watched)' : ' (New)';
            const accessibleName = `${short.title}, ${short.channelTitle}${watchedLabel}`;
            return (
              <button
                key={short.videoId}
                type="button"
                onClick={() => handleSelectShort(short.videoId)}
                aria-current={isActive ? 'true' : undefined}
                aria-label={accessibleName}
                className={`overflow-hidden rounded-lg p-2 text-left text-xs transition-colors ${
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
                {short.watched && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Watched
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
