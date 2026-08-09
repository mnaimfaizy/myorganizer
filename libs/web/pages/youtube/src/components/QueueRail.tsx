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

  const handleNearEnd = useCallback(async () => {
    if (!queue.current || watched || updating) return;

    setWatched(true);
    setUpdating(true);

    try {
      const result = await updateVideoWatched(queue.current.videoId, true);
      setWatched(result.watched);
      onWatchedToggle?.(queue.current.videoId, result.watched);
    } catch {
      setWatched(false);
    } finally {
      setUpdating(false);
    }

    queue.playNext();
  }, [queue, watched, updating, onWatchedToggle]);

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

  return (
    <section
      aria-labelledby="queue-rail-heading"
      className={cn('space-y-4', className)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 id="queue-rail-heading" className="text-lg font-semibold">
            Queue
          </h2>
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-700 dark:bg-gray-700 dark:text-gray-300">
            {queue.items.length}
          </span>
        </div>
        {queue.items.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={queue.clear}
            className="text-xs text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            Clear queue
          </Button>
        )}
      </div>

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

      {queue.current ? (
        <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <YouTubeVideoPlayer
            key={queue.current.videoId}
            video={queue.current}
            watched={watched}
            onNearEnd={handleNearEnd}
            defaultPlaying
          />

          <h3
            ref={nowPlayingTitleRef}
            tabIndex={-1}
            className="text-sm font-semibold text-gray-900 dark:text-gray-100"
          >
            {queue.current.title}
          </h3>
        </div>
      ) : null}

      {queue.items.length > 0 ? (
        <ol className="space-y-2">
          {queue.items.map((video, index) => {
            const isCurrentlyPlaying = index === queue.currentIndex;

            return (
              <QueueRailItem
                key={video.videoId}
                video={video}
                index={index}
                isCurrentlyPlaying={isCurrentlyPlaying}
                focusedRowIndex={focusedRowIndex}
                onRegisterPlayButton={handleRegisterPlayButton}
                onPlay={queue.playAt}
                onRemove={queue.remove}
                onKeyDown={handleRowKeyDown}
              />
            );
          })}
        </ol>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/50">
          <p className="text-sm text-gray-900 dark:text-gray-100">
            Your queue is empty.
          </p>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Add a Cached Upload from a channel row to line up what you want to
            watch.
          </p>
        </div>
      )}
    </section>
  );
}
