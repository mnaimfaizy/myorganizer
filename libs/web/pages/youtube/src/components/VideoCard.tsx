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
  onAddToQueue?: (videoId: string) => void;
  isQueued?: boolean;
  queueFull?: boolean;
  className?: string;
}

export function VideoCard({
  video,
  onWatchedToggle,
  onAddToQueue,
  isQueued,
  queueFull,
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
    onAddToQueue?.(video.videoId);
  }, [onAddToQueue, video.videoId]);

  return (
    <div
      className={cn(
        'group block overflow-hidden rounded-lg border border-border bg-card shadow-sm transition-shadow hover:shadow-md',
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
        <h3 className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
          <a
            href={youtubeWatchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            {video.title}
          </a>
        </h3>

        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          {video.channelTitle && (
            <>
              <span className="truncate">{video.channelTitle}</span>
              <span>·</span>
            </>
          )}
          <span>{formattedDate}</span>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-border pt-2">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleToggleWatched}
              disabled={updating}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              aria-label={
                watched
                  ? `Mark ${video.title} as new`
                  : `Mark ${video.title} as watched`
              }
            >
              {watched ? (
                <>
                  <CheckCircle className="mr-1.5 h-3.5 w-3.5 text-success" />
                  Mark as new
                </>
              ) : (
                <>
                  <Circle className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
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
                disabled={isQueued || queueFull}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                aria-label={
                  isQueued
                    ? `${video.title} is already queued`
                    : queueFull
                      ? `Queue is full — remove an upload to add ${video.title}`
                      : `Add ${video.title} to queue`
                }
              >
                <ListPlus className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                {isQueued
                  ? 'Queued'
                  : queueFull
                    ? 'Queue full'
                    : 'Add to queue'}
              </Button>
            )}
          </div>

          {error && (
            <span
              role="alert"
              className="text-[10px] font-medium text-destructive"
            >
              {error}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
