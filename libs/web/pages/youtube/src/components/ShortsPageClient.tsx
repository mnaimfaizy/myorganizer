'use client';

import { Button, Skeleton } from '@myorganizer/web-ui';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useShortsBudget, useYouTubeShorts, useYouTubeStatus } from '../hooks';
import { updateVideoWatched } from '../hooks';
import { ShortsEntryWarning } from './ShortsEntryWarning';
import { ShortsBudgetMeter } from './ShortsBudgetMeter';
import { ShortsHardStop } from './ShortsHardStop';
import { YouTubeConnectPrompt } from './YouTubeConnectPrompt';
import { ShortsList } from './ShortsList';
import { ShortsPlayerPanel } from './ShortsPlayerPanel';

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
  const [playbackStarted, setPlaybackStarted] = useState(false);
  const [reportedPlaying, setReportedPlaying] = useState<boolean | null>(null);
  const [lockedAtLastRender, setLockedAtLastRender] = useState(false);

  // The Shorts Daily Budget is a guardrail, so it has to fail *closed*: a
  // metering signal that never arrives must not hand the User unlimited Shorts.
  //
  // `playbackStarted` comes from the Play click itself — a local React event
  // that cannot fail. `reportedPlaying` comes from the embed's `onStateChange`
  // postMessage, which is a best-effort channel: a blocked third-party frame, a
  // player API change, or a browser that drops the message all leave it `null`
  // forever. Treating `null` as "still playing" means precise metering when the
  // embed talks to us, and metering from the click when it does not, which is
  // how the locked prototype behaved.
  const meteringActive = playbackStarted && reportedPlaying !== false;

  // `budget.locked` cannot be part of this expression — it comes out of the very
  // hook being fed — so the Hard Stop case is covered from both sides instead:
  // the render adjustment below clears playback the moment the budget locks,
  // and `useShortsBudget` refuses to accrue against an exhausted budget anyway.
  const budget = useShortsBudget(acknowledged && meteringActive);

  // Derive the active Short: use selection if it exists in the list, otherwise fall back to first.
  // This handles both initial load (selection is null, use first) and refresh (selection may vanish).
  const activeShort =
    shorts.find((s) => s.videoId === selectedShortId) ?? shorts[0] ?? null;
  const activeShortId = activeShort?.videoId ?? null;
  const activeIndex = activeShort ? shorts.indexOf(activeShort) : -1;

  // Adjust state during render: reset playback when the budget locks, so the
  // Hard Stop cannot leave a stale metering signal behind.
  if (budget.locked && !lockedAtLastRender) {
    setLockedAtLastRender(true);
    setPlaybackStarted(false);
    setReportedPlaying(null);
  } else if (!budget.locked && lockedAtLastRender) {
    setLockedAtLastRender(false);
  }

  const handleContinueToShorts = useCallback(() => {
    setAcknowledged(true);
  }, []);

  // Moving to another Short discards the previous Short's reported state but
  // deliberately keeps `playbackStarted`: the embed is reused and autoplays the
  // new Short without a second click, so clearing it would silently stop
  // metering for the rest of the session.
  const forgetReportedPlaying = useCallback(() => {
    setReportedPlaying(null);
  }, []);

  const handleRetry = useCallback(() => {
    refreshShorts();
  }, [refreshShorts]);

  const handlePreviousShort = useCallback(() => {
    if (shorts.length === 0) return;
    const previousIndex =
      activeIndex <= 0 ? shorts.length - 1 : activeIndex - 1;
    setSelectedShortId(shorts[previousIndex].videoId);
    forgetReportedPlaying();
  }, [activeIndex, shorts, forgetReportedPlaying]);

  const handleNextShort = useCallback(() => {
    if (shorts.length === 0) return;
    const nextIndex = activeIndex >= shorts.length - 1 ? 0 : activeIndex + 1;
    setSelectedShortId(shorts[nextIndex].videoId);
    forgetReportedPlaying();
  }, [activeIndex, shorts, forgetReportedPlaying]);

  const handleSelectShort = useCallback(
    (videoId: string) => {
      setSelectedShortId(videoId);
      forgetReportedPlaying();
    },
    [forgetReportedPlaying],
  );

  const handlePlaybackStart = useCallback(() => {
    setPlaybackStarted(true);
    setReportedPlaying(null);
  }, []);

  const handlePlayingChange = useCallback((playing: boolean) => {
    setReportedPlaying(playing);
  }, []);

  // The embed refused this Short outright, so nothing is playing behind the
  // "Playback unavailable" card and the click must stop counting as playback.
  const handlePlaybackUnavailable = useCallback(() => {
    setPlaybackStarted(false);
    setReportedPlaying(null);
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
    return <YouTubeConnectPrompt fallbackHref="/dashboard/youtube" />;
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

      <div className="flex flex-1 flex-col gap-4 p-4 lg:flex-row lg:gap-4">
        {/* Loading state */}
        {loading && !shorts.length ? (
          <div className="w-full max-w-sm space-y-2">
            <Skeleton className="aspect-[9/16] rounded-lg" />
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
              No Shorts to Watch
            </p>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              None of your Enabled Channels have recent Shorts. Visit your
              long-form videos or check back later.
            </p>
          </div>
        ) : (
          <>
            {/* Player panel — desktop centered, mobile full-width */}
            <div className="flex flex-1 items-center justify-center">
              <ShortsPlayerPanel
                activeShort={activeShort}
                activeIndex={activeIndex}
                shortsLength={shorts.length}
                remainingMs={budget.remainingMs}
                watched={activeShort?.watched ?? false}
                onNearEnd={handleNearEnd}
                onPlaybackStart={handlePlaybackStart}
                onPlayingChange={handlePlayingChange}
                onPlaybackUnavailable={handlePlaybackUnavailable}
                onPrevious={handlePreviousShort}
                onNext={handleNextShort}
                onWatchedToggle={handleWatchedToggleClick}
              />
            </div>

            {/* Side list of all Shorts (responsive: desktop rail + mobile scroller) */}
            <ShortsList
              shorts={shorts}
              selectedShortId={activeShortId}
              onSelectShort={handleSelectShort}
            />
          </>
        )}
      </div>
    </>
  );
}
