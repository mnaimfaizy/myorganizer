'use client';

import { Button, cn } from '@myorganizer/web-ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { updateVideoWatched } from '../hooks';
import type { VideoQueue } from '../hooks/useVideoQueue';
import { QueueRailItem } from './QueueRailItem';
import { YouTubeVideoPlayer } from './YouTubeVideoPlayer';

interface QueueRailProps {
  queue: VideoQueue;
  onWatchedToggle?: (videoId: string, watched: boolean) => void;
  className?: string;
}

export function QueueRail({
  queue,
  onWatchedToggle,
  className,
}: QueueRailProps) {
  const nowPlayingTitleRef = useRef<HTMLHeadingElement>(null);
  const lastFocusSignalRef = useRef<number>(queue.focusSignal);
  const [focusedRowIndex, setFocusedRowIndex] = useState<number>(0);
  const [watched, setWatched] = useState<boolean>(!!queue.current?.watched);
  const [updating, setUpdating] = useState<boolean>(false);
  const playButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (queue.focusSignal !== lastFocusSignalRef.current && queue.current) {
      nowPlayingTitleRef.current?.focus();
      lastFocusSignalRef.current = queue.focusSignal;
    }
  }, [queue.focusSignal, queue.current]);

  useEffect(() => {
    setWatched(!!queue.current?.watched);
    setUpdating(false);
  }, [queue.current?.videoId]);

  useEffect(() => {
    setFocusedRowIndex((prev) =>
      Math.min(prev, Math.max(queue.items.length - 1, 0)),
    );
  }, [queue.items.length]);

  const handleCompletion = useCallback(
    async (videoId: string) => {
      if (updating) return;

      setWatched(true);
      setUpdating(true);

      try {
        const result = await updateVideoWatched(videoId, true);
        setWatched(result.watched);
        onWatchedToggle?.(videoId, result.watched);
      } catch {
        setWatched(false);
      } finally {
        setUpdating(false);
      }

      queue.completeAndNext(videoId);
    },
    [queue, updating, onWatchedToggle],
  );

  const handleNearEnd = useCallback(async () => {
    if (!queue.current || watched || updating) return;
    await handleCompletion(queue.current.videoId);
  }, [queue.current, watched, updating, handleCompletion]);

  const handleMarkWatchedAndNext = useCallback(async () => {
    if (!queue.current || watched || updating) return;
    await handleCompletion(queue.current.videoId);
  }, [queue.current, watched, updating, handleCompletion]);

  const handleRegisterPlayButton = useCallback(
    (index: number, el: HTMLButtonElement | null) => {
      playButtonRefs.current[index] = el;
    },
    [],
  );

  const handleRowKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIndex = Math.min(index + 1, queue.items.length - 1);
        setFocusedRowIndex(nextIndex);
        playButtonRefs.current[nextIndex]?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIndex = Math.max(index - 1, 0);
        setFocusedRowIndex(prevIndex);
        playButtonRefs.current[prevIndex]?.focus();
      }
    },
    [queue.items.length],
  );

  const playerContent = queue.current ? (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900 motion-reduce:transition-none">
      <YouTubeVideoPlayer
        key={queue.current.videoId}
        video={queue.current}
        watched={watched}
        onNearEnd={handleNearEnd}
        defaultPlaying
      />

      <div className="space-y-3">
        <h3
          ref={nowPlayingTitleRef}
          tabIndex={-1}
          className="text-sm font-semibold text-gray-900 dark:text-gray-100"
        >
          {queue.current.title}
        </h3>

        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={handleMarkWatchedAndNext}
          disabled={updating || watched}
          className="w-full"
        >
          Mark watched & next
        </Button>
      </div>
    </div>
  ) : null;

  const railContent = (
    <aside className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 id="queue-rail-heading" className="text-sm font-semibold">
            Queue
          </h2>
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-700 dark:bg-gray-700 dark:text-gray-300">
            {queue.items.length}
          </span>
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {queue.items.length} of 4
        </span>
      </div>

      {queue.isFull && (
        <div className="rounded-md bg-yellow-50 p-2 text-xs text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
          Queue is full — 4 is the point.
        </div>
      )}

      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {queue.items.length === 1
          ? '1 Cached Upload queued'
          : `${queue.items.length} Cached Uploads queued`}
      </div>

      {queue.items.length > 0 ? (
        <ol className="space-y-2 lg:max-h-[60vh] lg:overflow-y-auto">
          {queue.items.map((video, index) => {
            const isCurrentlyPlaying = index === queue.activeIndex;

            return (
              <QueueRailItem
                key={video.videoId}
                video={video}
                index={index}
                isCurrentlyPlaying={isCurrentlyPlaying}
                focusedRowIndex={focusedRowIndex}
                onRegisterPlayButton={handleRegisterPlayButton}
                onPlay={queue.playId}
                onRemove={queue.remove}
                onMoveUp={queue.moveUp}
                onMoveDown={queue.moveDown}
                onKeyDown={handleRowKeyDown}
                queueLength={queue.items.length}
              />
            );
          })}
        </ol>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs dark:border-gray-700 dark:bg-gray-900/50">
          <p className="text-gray-900 dark:text-gray-100">
            Your queue is empty.
          </p>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Add a Cached Upload from a channel row to line up what you want to
            watch.
          </p>
        </div>
      )}

      {queue.items.length > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={queue.clear}
          className="w-full text-xs"
        >
          Clear queue
        </Button>
      )}
    </aside>
  );

  return (
    <div
      className={cn(
        'space-y-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] lg:gap-4 lg:space-y-0',
        className,
      )}
    >
      <div className="space-y-4">{playerContent}</div>

      {/* Desktop rail */}
      <div className="hidden lg:block lg:sticky lg:top-4 lg:self-start">
        {railContent}
      </div>

      {/* Mobile queue disclosure */}
      <details className="lg:hidden">
        <summary className="cursor-pointer select-none rounded-md px-3 py-2 text-sm font-semibold hover:bg-gray-100 dark:hover:bg-gray-800">
          Queue ({queue.items.length})
        </summary>
        <div className="mt-2">{railContent}</div>
      </details>
    </div>
  );
}
