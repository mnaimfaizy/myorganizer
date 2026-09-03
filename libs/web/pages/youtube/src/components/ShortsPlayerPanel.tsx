'use client';

import { Button } from '@myorganizer/web-ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { YouTubeVideo } from '../types';
import { formatRuntimeSeconds } from '../lib/formatRuntimeSeconds';
import { YouTubeVideoPlayer } from './YouTubeVideoPlayer';

interface ShortsPlayerPanelProps {
  activeShort: YouTubeVideo | null;
  activeIndex: number;
  shortsLength: number;
  remainingMs: number;
  watched?: boolean;
  onNearEnd?: () => void;
  /** The User pressed Play. Fires from the click itself, not from the embed. */
  onPlaybackStart?: () => void;
  /** The embed reported a playback state transition. May never fire. */
  onPlayingChange?: (playing: boolean) => void;
  /** The embed refused to play this Short at all. */
  onPlaybackUnavailable?: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onWatchedToggle: () => void;
}

/**
 * Portrait 9:16 player panel with title/channel block, Watched toggle,
 * Prev/Next navigation (as icon buttons flanking the player), and position indicator.
 *
 * Renders runtime below the player and shows budget consequence warning when
 * the next Short exceeds remaining time.
 */
export function ShortsPlayerPanel({
  activeShort,
  activeIndex,
  shortsLength,
  remainingMs,
  watched = false,
  onNearEnd,
  onPlaybackStart,
  onPlayingChange,
  onPlaybackUnavailable,
  onPrevious,
  onNext,
  onWatchedToggle,
}: ShortsPlayerPanelProps) {
  if (!activeShort) {
    return null;
  }

  const runtime = formatRuntimeSeconds(activeShort.durationSeconds) || null;
  const runtimeMs =
    activeShort.durationSeconds != null
      ? activeShort.durationSeconds * 1000
      : null;

  const budgetWarning =
    runtimeMs != null && runtimeMs > remainingMs
      ? 'This Short is longer than the time you have left today'
      : null;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      {/* Short player — portrait 9:16 */}
      <div className="w-full max-w-sm">
        <div className="aspect-[9/16] overflow-hidden rounded-lg bg-black">
          <YouTubeVideoPlayer
            video={activeShort}
            watched={watched}
            onNearEnd={onNearEnd}
            onPlay={onPlaybackStart}
            onPlayingChange={onPlayingChange}
            onPlaybackUnavailable={onPlaybackUnavailable}
            defaultPlaying={false}
            className="h-full w-full"
          />
        </div>
      </div>

      {/* Runtime display */}
      {runtime && <p className="text-xs text-muted-foreground">{runtime}</p>}

      {/* Short info + navigation */}
      <div className="w-full max-w-sm space-y-3">
        <div>
          <h2 className="font-semibold text-foreground">{activeShort.title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {activeShort.channelTitle}
          </p>
        </div>

        {/* Budget warning */}
        {budgetWarning && (
          <div className="rounded-md bg-warning/10 p-2 text-xs text-warning">
            {budgetWarning}
          </div>
        )}

        {/* Watched toggle */}
        <Button variant="outline" onClick={onWatchedToggle} className="w-full">
          {watched ? 'Mark as New' : 'Mark as Watched'}
        </Button>

        {/* Previous/Next with chevron icons flanking the player area */}
        <div className="flex items-center justify-center gap-3">
          <Button
            onClick={onPrevious}
            variant="outline"
            size="icon"
            aria-label="Previous Short"
            className="h-10 w-10"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          {/* Position indicator */}
          <p
            className="min-w-12 text-center text-xs text-muted-foreground"
            aria-live="polite"
            aria-atomic="true"
          >
            {activeIndex >= 0 ? activeIndex + 1 : 0} of {shortsLength}
          </p>

          <Button
            onClick={onNext}
            variant="outline"
            size="icon"
            aria-label="Next Short"
            className="h-10 w-10"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
