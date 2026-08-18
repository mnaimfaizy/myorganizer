'use client';

import { Button, Skeleton, cn } from '@myorganizer/web-ui';
import { CheckCircle, Circle, ExternalLink, ListPlus, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { updateVideoWatched } from '../hooks';
import type { ChannelCarousel, YouTubeVideo } from '../types';
import { ChannelList } from './ChannelList';
import { YouTubeVideoPlayer } from './YouTubeVideoPlayer';

interface ChannelDirectoryProps {
  channels: ChannelCarousel[];
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  onWatchedToggle?: (videoId: string, watched: boolean) => void;
  onAddToQueue?: (videoId: string) => void;
  isQueued?: (videoId: string) => boolean;
  queueFull?: boolean;
  /**
   * True while another surface on the page owns the single active player.
   * The directory closes its own player rather than letting two YouTube
   * embeds play over each other.
   */
  playbackSuspended?: boolean;
  /**
   * Called when the User plays an upload here, so the page can hand this
   * surface the active player and stop whatever else was playing.
   */
  onPlaybackClaim?: () => void;
}

export function ChannelDirectory({
  channels,
  loading,
  error,
  onRetry,
  onWatchedToggle,
  onAddToQueue,
  isQueued,
  queueFull,
  playbackSuspended = false,
  onPlaybackClaim,
}: ChannelDirectoryProps) {
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(
    null,
  );
  const [pickedVideoId, setPickedVideoId] = useState<string | null>(null);
  const [focusedVideoIndex, setFocusedVideoIndex] = useState<number>(0);

  const channelDesktopRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const channelMobileRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const videoRowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const playerTriggerRef = useRef<HTMLButtonElement | null>(null);

  // Playback is derived, not synced: while another surface owns the single
  // active player this one renders none, whatever the User last picked here.
  // Suspension only lifts when this surface claims playback again, which sets
  // a fresh id in the same commit — so nothing stale can resume on its own.
  // Deriving rather than clearing in an effect also means focus is never
  // yanked back: the surface that claimed playback owns where focus lands.
  const activeVideoId = playbackSuspended ? null : pickedVideoId;

  // Compute effective selected channel: use explicit selection if valid, else first channel
  const effectiveSelectedChannelId =
    selectedChannelId ?? channels[0]?.channelId ?? null;
  const selectedChannel = effectiveSelectedChannelId
    ? channels.find((c) => c.channelId === effectiveSelectedChannelId)
    : null;

  const handleRetryClick = useCallback(() => {
    onRetry?.();
  }, [onRetry]);

  const handleChannelSelect = useCallback((channelId: string) => {
    setSelectedChannelId(channelId);
    setPickedVideoId(null);
    setFocusedVideoIndex(0);
  }, []);

  const handleChannelKeyDown = useCallback(
    (
      e: React.KeyboardEvent<HTMLButtonElement>,
      index: number,
      layoutType: 'desktop' | 'mobile',
    ) => {
      const refs =
        layoutType === 'desktop'
          ? channelDesktopRefs.current
          : channelMobileRefs.current;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const nextIndex = Math.min(index + 1, channels.length - 1);
        refs[nextIndex]?.focus();
        setSelectedChannelId(channels[nextIndex].channelId);
        setPickedVideoId(null);
        setFocusedVideoIndex(0);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const prevIndex = Math.max(index - 1, 0);
        refs[prevIndex]?.focus();
        setSelectedChannelId(channels[prevIndex].channelId);
        setPickedVideoId(null);
        setFocusedVideoIndex(0);
      } else if (e.key === 'Home') {
        e.preventDefault();
        refs[0]?.focus();
        setSelectedChannelId(channels[0].channelId);
        setPickedVideoId(null);
        setFocusedVideoIndex(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        const lastIndex = channels.length - 1;
        refs[lastIndex]?.focus();
        setSelectedChannelId(channels[lastIndex].channelId);
        setPickedVideoId(null);
        setFocusedVideoIndex(0);
      }
    },
    [channels],
  );

  const handleVideoKeyDown = useCallback(
    (
      e: React.KeyboardEvent<HTMLDivElement>,
      index: number,
      selectedChannel: ChannelCarousel,
    ) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIndex = Math.min(
          index + 1,
          selectedChannel.videos.length - 1,
        );
        setFocusedVideoIndex(nextIndex);
        videoRowRefs.current[nextIndex]?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIndex = Math.max(index - 1, 0);
        setFocusedVideoIndex(prevIndex);
        videoRowRefs.current[prevIndex]?.focus();
      } else if (e.key === 'Home') {
        e.preventDefault();
        setFocusedVideoIndex(0);
        videoRowRefs.current[0]?.focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        const lastIndex = selectedChannel.videos.length - 1;
        setFocusedVideoIndex(lastIndex);
        videoRowRefs.current[lastIndex]?.focus();
      } else if (e.key === 'Escape' && activeVideoId) {
        e.preventDefault();
        setPickedVideoId(null);
        playerTriggerRef.current?.focus();
      }
    },
    [activeVideoId],
  );

  const handlePlayVideo = useCallback(
    (videoId: string, triggerElement: HTMLButtonElement) => {
      // Claim before opening, so whatever else was playing is stopped in the
      // same commit and the two players never overlap for a frame.
      onPlaybackClaim?.();
      setPickedVideoId(videoId);
      playerTriggerRef.current = triggerElement;
    },
    [onPlaybackClaim],
  );

  const handleClosePlayer = useCallback(() => {
    setPickedVideoId(null);
    playerTriggerRef.current?.focus();
  }, []);

  const handleVideoNearEnd = useCallback(() => {
    if (!activeVideoId || !effectiveSelectedChannelId) return;
    const video = channels
      .find((c) => c.channelId === effectiveSelectedChannelId)
      ?.videos.find((v) => v.videoId === activeVideoId);
    if (video && !video.watched) {
      void updateVideoWatched(video.videoId, true).then(() => {
        onWatchedToggle?.(video.videoId, true);
      });
    }
  }, [activeVideoId, effectiveSelectedChannelId, channels, onWatchedToggle]);

  if (error) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-900/20"
      >
        <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
        {onRetry && (
          <button
            onClick={handleRetryClick}
            className="mt-3 inline-flex items-center rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 active:bg-red-800 dark:bg-red-700 dark:hover:bg-red-600"
            type="button"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (loading && channels.length === 0) {
    return (
      <div role="status" aria-live="polite" className="space-y-6">
        <div className="hidden lg:flex gap-4">
          <div className="w-48 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded" />
            ))}
          </div>
          <div className="flex-1 space-y-4">
            <Skeleton className="h-6 w-48 rounded" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded" />
            ))}
          </div>
        </div>
        <div className="lg:hidden space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-24 rounded-full shrink-0" />
            ))}
          </div>
          <Skeleton className="h-6 w-48 rounded" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center dark:border-gray-700 dark:bg-gray-900/50">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          No Enabled Channels yet. Enable a channel from the list above to get
          started.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <ChannelList
        channels={channels}
        selectedChannelId={effectiveSelectedChannelId}
        desktopRefs={channelDesktopRefs}
        mobileRefs={channelMobileRefs}
        onSelect={handleChannelSelect}
        onKeyDown={handleChannelKeyDown}
      />

      {/* Detail pane: Selected channel videos */}
      {selectedChannel && (
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {/* Channel title */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {selectedChannel.channelTitle}
            </h2>
          </div>

          {/* Active player */}
          {activeVideoId && (
            <ActivePlayerPanel
              activeVideoId={activeVideoId}
              video={selectedChannel.videos.find(
                (v) => v.videoId === activeVideoId,
              )}
              onClose={handleClosePlayer}
              onNearEnd={handleVideoNearEnd}
            />
          )}

          {/* Uploads list */}
          {selectedChannel.videos.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/50">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                No uploads for this channel.
              </p>
              <a
                href={`https://www.youtube.com/channel/${encodeURIComponent(selectedChannel.channelId)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open channel on YouTube
              </a>
            </div>
          ) : (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Cached Uploads
              </h3>
              {selectedChannel.videos.map((video, index) => (
                <UploadListItem
                  key={video.id}
                  video={video}
                  index={index}
                  isFocused={focusedVideoIndex === index}
                  ref={(el) => {
                    videoRowRefs.current[index] = el;
                  }}
                  tabIndex={focusedVideoIndex === index ? 0 : -1}
                  onKeyDown={(e) =>
                    handleVideoKeyDown(e, index, selectedChannel)
                  }
                  onPlay={(triggerEl) =>
                    handlePlayVideo(video.videoId, triggerEl)
                  }
                  onWatchedToggle={onWatchedToggle}
                  onAddToQueue={onAddToQueue}
                  isQueued={isQueued?.(video.videoId) ?? false}
                  queueFull={queueFull ?? false}
                />
              ))}

              {/* End-of-list disclosure */}
              <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  MyOrganizer stores only recent uploads from each channel.
                  Older uploads are not cached here.
                </p>
                <a
                  href={`https://www.youtube.com/channel/${encodeURIComponent(selectedChannel.channelId)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open channel on YouTube
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ActivePlayerPanelProps {
  activeVideoId: string;
  video?: YouTubeVideo;
  onClose: () => void;
  onNearEnd: () => void;
}

function ActivePlayerPanel({
  activeVideoId,
  video,
  onClose,
  onNearEnd,
}: ActivePlayerPanelProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [onClose],
  );

  if (!video) return null;

  return (
    <div
      onKeyDown={handleKeyDown}
      className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900 lg:sticky lg:top-2 lg:z-10"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {video.title}
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-6 w-6 p-0"
          aria-label="Close player"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <YouTubeVideoPlayer
        key={activeVideoId}
        video={video}
        watched={video.watched ?? false}
        onNearEnd={onNearEnd}
        defaultPlaying
      />
    </div>
  );
}

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

const UploadListItem = React.forwardRef<HTMLDivElement, UploadListItemProps>(
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
          'group flex gap-3 rounded-lg border bg-white p-3 transition-colors dark:bg-gray-900',
          isFocused
            ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/50 dark:border-blue-600 dark:bg-blue-900/20'
            : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800',
        )}
      >
        {/* Thumbnail */}
        <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          {video.thumbnail ? (
            <img
              src={video.thumbnail}
              alt={video.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <span className="text-2xl text-gray-400">▶</span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="line-clamp-2 text-sm font-medium text-gray-900 dark:text-gray-100">
            <a
              href={youtubeWatchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              {video.title}
            </a>
          </h4>

          <div className="mt-1 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
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
              className="h-6 px-2 text-xs text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
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
              className="h-6 px-2 text-xs text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              aria-label={
                watched
                  ? `Mark ${video.title} as new`
                  : `Mark ${video.title} as watched`
              }
            >
              {watched ? (
                <>
                  <CheckCircle className="mr-1 h-3.5 w-3.5 text-green-600 dark:text-green-500" />
                  Mark as new
                </>
              ) : (
                <>
                  <Circle className="mr-1 h-3.5 w-3.5 text-gray-400" />
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
                className="h-6 px-2 text-xs text-gray-600 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-60 dark:text-gray-400 dark:hover:text-gray-100"
                aria-label={
                  isQueued
                    ? `${video.title} is already queued`
                    : queueFull
                      ? `Queue is full — remove an upload to add ${video.title}`
                      : `Add ${video.title} to queue`
                }
              >
                <ListPlus className="mr-1 h-3.5 w-3.5 text-gray-400" />
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
                className="text-[10px] font-medium text-red-600 dark:text-red-400"
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
