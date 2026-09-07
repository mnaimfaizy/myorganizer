'use client';

import { Button, cn } from '@myorganizer/web-ui';
import { CheckCircle, Circle, ListPlus } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { updateVideoWatched } from '../hooks';
import type { YouTubeVideo } from '../types';

interface UploadListItemProps {
  video: YouTubeVideo;
  index: number;
  isFocused: boolean;
  tabIndex: number;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onPlay: (triggerElement: HTMLButtonElement) => void;
  onWatchedToggle?: (videoId: string, watched: boolean) => void;
  onAddToQueue?: (videoId: string) => void;
  isQueued: boolean;
  queueFull: boolean;
}

export const UploadListItem = React.forwardRef<
  HTMLDivElement,
  UploadListItemProps
>(
  (
    {
      video,
      onPlay,
      onWatchedToggle,
      onAddToQueue,
      isQueued,
      queueFull,
      tabIndex,
      onKeyDown,
      isFocused,
    },
    ref,
  ) => {
    const [watched, setWatched] = useState<boolean>(!!video.watched);
    const [updating, setUpdating] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const playButtonRef = useRef<HTMLButtonElement>(null);

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

    const handlePlayClick = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        if (playButtonRef.current) {
          onPlay(playButtonRef.current);
        }
      },
      [onPlay],
    );

    const handleAddToQueue = useCallback(() => {
      onAddToQueue?.(video.videoId);
    }, [onAddToQueue, video.videoId]);

    return (
      <div
        ref={ref}
        tabIndex={tabIndex}
        onKeyDown={onKeyDown}
        className={cn(
          'group flex gap-3 rounded-lg border bg-card p-3 transition-colors',
          isFocused
            ? 'border-brand bg-brand/10 ring-2 ring-brand/50'
            : 'border-border hover:bg-muted',
        )}
      >
        {/* Thumbnail */}
        <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
          {video.thumbnail ? (
            <img
              src={video.thumbnail}
              alt={video.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <span className="text-2xl text-muted-foreground">▶</span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="line-clamp-2 text-sm font-medium text-foreground">
            <a
              href={youtubeWatchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              {video.title}
            </a>
          </h4>

          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            {video.channelTitle && (
              <>
                <span className="truncate">{video.channelTitle}</span>
                <span>·</span>
              </>
            )}
            <span>{formattedDate}</span>
            <span>·</span>
            <span>{watched ? 'Watched' : 'New'}</span>
          </div>

          <div className="mt-2 flex items-center gap-1 flex-wrap">
            <Button
              type="button"
              ref={playButtonRef}
              variant="ghost"
              size="sm"
              onClick={handlePlayClick}
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              aria-label={`Play ${video.title} in app`}
            >
              Play in app
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleToggleWatched}
              disabled={updating}
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              aria-label={
                watched
                  ? `Mark ${video.title} as new`
                  : `Mark ${video.title} as watched`
              }
            >
              {watched ? (
                <>
                  <CheckCircle className="mr-1 h-3.5 w-3.5 text-success" />
                  Mark as new
                </>
              ) : (
                <>
                  <Circle className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
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
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                aria-label={
                  isQueued
                    ? `${video.title} is already queued`
                    : queueFull
                      ? `Queue is full — remove an upload to add ${video.title}`
                      : `Add ${video.title} to queue`
                }
              >
                <ListPlus className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
                {isQueued
                  ? 'Queued'
                  : queueFull
                    ? 'Queue full'
                    : 'Add to queue'}
              </Button>
            )}

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
  },
);
UploadListItem.displayName = 'UploadListItem';
