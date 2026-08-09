'use client';

import { Button, cn } from '@myorganizer/web-ui';
import { CheckCircle, Circle, ListPlus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { updateVideoWatched } from '../hooks';
import type { YouTubeVideo } from '../types';
import { YouTubeVideoPlayer } from './YouTubeVideoPlayer';

interface VideoCardProps {
  video: YouTubeVideo;
  onWatchedToggle?: (videoId: string, watched: boolean) => void;
  onAddToQueue?: (video: YouTubeVideo) => void;
  isQueued?: boolean;
  className?: string;
}

export function VideoCard({
  video,
  onWatchedToggle,
  onAddToQueue,
  isQueued,
  className,
}: VideoCardProps) {
  const [watched, setWatched] = useState<boolean>(!!video.watched);
  const [updating, setUpdating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setWatched(!!video.watched);
  }, [video.watched]);

  const formattedDate = new Date(video.publishedAt).toLocaleDateString(
    undefined,
    { year: 'numeric', month: 'short', day: 'numeric' },
  );

  const youtubeWatchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(
    video.videoId,
  )}`;

  const handleToggleWatched = useCallback(
    async (e?: React.MouseEvent) => {
      e?.preventDefault();
      e?.stopPropagation();

      const nextWatched = !watched;
      const prevWatched = watched;

      setWatched(nextWatched);
      setUpdating(true);
      setError(null);

      try {
        const result = await updateVideoWatched(video.videoId, nextWatched);
        setWatched(result.watched);
        onWatchedToggle?.(video.videoId, result.watched);
      } catch {
        setWatched(prevWatched);
        setError('Failed to update status');
      } finally {
        setUpdating(false);
      }
    },
    [watched, video.videoId, onWatchedToggle],
  );

  const handleNearEndAutoWatched = useCallback(async () => {
    if (watched || updating) return;

    setWatched(true);
    setUpdating(true);
    setError(null);

    try {
      const result = await updateVideoWatched(video.videoId, true);
      setWatched(result.watched);
      onWatchedToggle?.(video.videoId, result.watched);
    } catch {
      setWatched(false);
      setError('Failed to update status');
    } finally {
      setUpdating(false);
    }
  }, [watched, updating, video.videoId, onWatchedToggle]);

  const handleAddToQueue = useCallback(() => {
    onAddToQueue?.(video);
  }, [onAddToQueue, video]);

  return (
    <div
      className={cn(
        'group block overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-900',
        className,
      )}
    >
      <YouTubeVideoPlayer
        key={video.videoId}
        video={video}
        watched={watched}
        onNearEnd={handleNearEndAutoWatched}
      />

      <div className="p-3">
        <h3 className="line-clamp-2 text-sm font-medium leading-snug text-gray-900 dark:text-gray-100">
          <a
            href={youtubeWatchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            {video.title}
          </a>
        </h3>

        <div className="mt-1 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          {video.channelTitle && (
            <>
              <span className="truncate">{video.channelTitle}</span>
              <span>·</span>
            </>
          )}
          <span>{formattedDate}</span>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-2 dark:border-gray-800">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleToggleWatched}
              disabled={updating}
              className="h-7 px-2 text-xs text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              aria-label={
                watched
                  ? `Mark ${video.title} as new`
                  : `Mark ${video.title} as watched`
              }
            >
              {watched ? (
                <>
                  <CheckCircle className="mr-1.5 h-3.5 w-3.5 text-green-600 dark:text-green-500" />
                  Mark as new
                </>
              ) : (
                <>
                  <Circle className="mr-1.5 h-3.5 w-3.5 text-gray-400" />
                  Mark as watched
                </>
              )}
            </Button>

            {onAddToQueue && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleAddToQueue}
                disabled={isQueued}
                className="h-7 px-2 text-xs text-gray-600 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-60 dark:text-gray-400 dark:hover:text-gray-100"
                aria-label={
                  isQueued
                    ? `${video.title} is already queued`
                    : `Add ${video.title} to queue`
                }
              >
                <ListPlus className="mr-1.5 h-3.5 w-3.5 text-gray-400" />
                {isQueued ? 'Queued' : 'Add to queue'}
              </Button>
            )}
          </div>

          {error && (
            <span
              role="alert"
              className="text-[10px] font-medium text-red-600 dark:text-red-400"
            >
              {error}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
