'use client';

import { Skeleton } from '@myorganizer/web-ui';
import { useCallback } from 'react';
import type { ChannelCarousel, YouTubeVideo } from '../types';
import { ChannelUploadsRow } from './ChannelUploadsRow';

interface ChannelDirectoryProps {
  channels: ChannelCarousel[];
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  onWatchedToggle?: (videoId: string, watched: boolean) => void;
  onAddToQueue?: (video: YouTubeVideo) => void;
  isQueued?: (videoId: string) => boolean;
}

export function ChannelDirectory({
  channels,
  loading,
  error,
  onRetry,
  onWatchedToggle,
  onAddToQueue,
  isQueued,
}: ChannelDirectoryProps) {
  const handleRetryClick = useCallback(() => {
    onRetry?.();
  }, [onRetry]);

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
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-6 w-48 rounded" />
            <div className="flex gap-3">
              {Array.from({ length: 4 }).map((__, j) => (
                <Skeleton key={j} className="h-36 w-56 rounded-lg" />
              ))}
            </div>
          </div>
        ))}
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
    <div className="space-y-6">
      {channels.map((channel) => (
        <section
          key={channel.channelId}
          aria-labelledby={`channel-title-${channel.channelId}`}
        >
          <ChannelUploadsRow
            channel={channel}
            onWatchedToggle={onWatchedToggle}
            onAddToQueue={onAddToQueue}
            isQueued={isQueued}
          />
        </section>
      ))}
    </div>
  );
}
