'use client';

import { Button, Card, CardContent, CardTitle } from '@myorganizer/web-ui';
import { RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  formatRetryAt,
  useChannelUploads,
  useVideoQueue,
  useYouTubeAvailability,
  useYouTubeCarousel,
  useYouTubeConnect,
  useYouTubeStatus,
  useYouTubeSubscriptions,
  useYouTubeSyncStatus,
} from '../hooks';
import { useYouTubeSyncPoll } from '../hooks/useYouTubeSyncPoll';
import { isRunLive } from '../lib/syncProgress';
import { ChannelDirectory } from './ChannelDirectory';
import { QueueRail } from './QueueRail';
import { SyncFreshnessIndicator } from './SyncFreshnessIndicator';
import { SyncProgressPanel } from './SyncProgressPanel';
import { YouTubeConnectPrompt } from './YouTubeConnectPrompt';
import { YouTubeUnavailableNotice } from './YouTubeUnavailableNotice';

export function YouTubePageClient() {
  const { available } = useYouTubeAvailability();
  const { connected, status } = useYouTubeStatus();
  const { connect } = useYouTubeConnect();

  // Check availability first — if unavailable, show error state before
  // checking connection status or proceeding to connected dashboard
  if (available !== true) {
    return <YouTubeUnavailableNotice />;
  }

  if (status === 'loading') {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!connected) {
    return (
      <YouTubeConnectPrompt
        onConnect={connect}
        statusMessage={
          status === 'revoked'
            ? 'Your previous connection was revoked. Please reconnect.'
            : undefined
        }
      />
    );
  }

  return <ConnectedDashboard />;
}

function ConnectedDashboard() {
  // Digest mail and the subscription list deep-link a channel here. Read once
  // as the directory's initial selection rather than driving it from the URL,
  // so the User's own clicks are not fighting a stale query string.
  const deepLinkedChannelId = useSearchParams().get('channel');
  const subs = useYouTubeSubscriptions();
  const carouselData = useYouTubeCarousel();
  const syncStatus = useYouTubeSyncStatus();
  const [syncError, setSyncError] = useState<string | null>(null);
  const [waitingForClaim, setWaitingForClaim] = useState(false);

  const syncBusy = isRunLive(syncStatus.status);
  const isCooldownActive = !!syncStatus.isCooldownActive;

  const refreshSync = syncStatus.refresh;
  const triggerUploadSync = syncStatus.triggerUploadSync;
  const syncStatusValue = syncStatus.status;

  const handleRunComplete = useCallback(async () => {
    setSyncError(null);
    const results = await Promise.allSettled([
      subs.refresh(),
      carouselData.refresh(),
    ]);
    const hadFailure = results.some((r) => r.status === 'rejected');
    if (hadFailure) {
      setSyncError('Refresh failed — showing cached data');
    }
  }, [subs, carouselData]);

  useYouTubeSyncPoll(syncStatus.status, {
    poll: refreshSync,
    onRunComplete: handleRunComplete,
  });

  useEffect(() => {
    if (!waitingForClaim) return;

    let isMounted = true;
    let elapsedMs = 0;
    const pollIntervalMs = 1000;
    const maxWaitMs = 30000;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const doPoll = async () => {
      if (!isMounted) return;

      try {
        const status = await refreshSync();
        if (!isMounted) return;
        if (isRunLive(status)) {
          setWaitingForClaim(false);
          return;
        }
      } catch {
        if (!isMounted) return;
      }

      elapsedMs += pollIntervalMs;
      if (elapsedMs <= maxWaitMs && isMounted) {
        timeoutId = setTimeout(doPoll, pollIntervalMs);
      } else if (isMounted) {
        setWaitingForClaim(false);
      }
    };

    void doPoll();

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [waitingForClaim, refreshSync]);

  const channelUploads = useChannelUploads();

  const channels = useMemo(
    () =>
      carouselData.channels.map((channel) => {
        const expanded = channelUploads.uploadsByChannel[channel.channelId];
        return expanded ? { ...channel, videos: expanded } : channel;
      }),
    [carouselData.channels, channelUploads.uploadsByChannel],
  );

  const library = useMemo(
    () => channels.flatMap((channel) => channel.videos),
    [channels],
  );

  const queue = useVideoQueue(library);

  const [playbackOwner, setPlaybackOwner] = useState<'directory' | 'queue'>(
    'directory',
  );

  const handleDirectoryPlaybackClaim = useCallback(() => {
    setPlaybackOwner('directory');
    queue.stop();
  }, [queue]);

  const handleQueuePlaybackClaim = useCallback(() => {
    setPlaybackOwner('queue');
  }, []);

  const handleWatchedToggle = useCallback(
    (videoId: string, watched: boolean) => {
      carouselData.updateWatched(videoId, watched);
      channelUploads.updateWatched(videoId, watched);
    },
    [carouselData, channelUploads],
  );

  const handleSync = useCallback(() => {
    if (isCooldownActive || syncBusy) return;

    if (syncStatusValue?.retryAt) {
      const retryTime = Date.parse(syncStatusValue.retryAt);
      if (!Number.isNaN(retryTime) && retryTime > Date.now()) {
        return;
      }
    }

    void triggerUploadSync().catch(() => {
      // Swallow errors; the polled status is authoritative.
    });

    setWaitingForClaim(true);
  }, [isCooldownActive, syncBusy, triggerUploadSync, syncStatusValue]);

  const handleDirectoryRetry = useCallback(() => {
    carouselData.refresh();
  }, [carouselData]);

  const uploadSyncDisabled =
    carouselData.loading || syncStatus.loading || syncBusy || isCooldownActive;

  const retryLabel =
    isCooldownActive && syncStatus.status?.retryAt
      ? (formatRetryAt(syncStatus.status.retryAt) ?? syncStatus.status.retryAt)
      : null;

  const showNoChannelsNote = !subs.loading && subs.subscriptions.length === 0;

  const showNeverSyncedNote =
    !subs.loading &&
    subs.subscriptions.length > 0 &&
    syncStatus.status?.status === 'never';

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <Card className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <CardTitle>Videos</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              asChild
              aria-label="Shorts — daily time budget applies"
            >
              <Link href="/dashboard/youtube/shorts">Shorts</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/youtube/channels">Channels</Link>
            </Button>
          </div>
          <div className="flex items-start gap-2">
            <SyncFreshnessIndicator status={syncStatus.status} />

            <Button
              variant="ghost"
              size="sm"
              onClick={handleSync}
              disabled={uploadSyncDisabled}
              aria-label={
                retryLabel
                  ? `Sync uploads disabled until ${retryLabel}`
                  : 'Sync uploads'
              }
              title={
                retryLabel
                  ? `Sync uploads disabled until ${retryLabel}`
                  : 'Sync uploads'
              }
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${carouselData.loading || syncStatus.loading || syncBusy ? 'animate-spin' : ''}`}
              />
              Sync uploads
            </Button>
          </div>
        </div>
        <CardContent className="mt-4 space-y-6">
          {showNoChannelsNote && (
            <div role="status" className="text-sm text-muted-foreground">
              No channels yet.{' '}
              <Link href="/dashboard/youtube/channels" className="underline">
                Refresh channels
              </Link>
            </div>
          )}
          {showNeverSyncedNote && (
            <div role="status" className="text-sm text-muted-foreground">
              Uploads have not been synced yet. Sync uploads caches the latest
              100 from each enabled channel.
            </div>
          )}
          {syncStatus.status && (
            <SyncProgressPanel status={syncStatus.status} />
          )}
          {syncError && (
            <div
              role="alert"
              aria-live="assertive"
              className="text-sm text-destructive"
            >
              {syncError}
            </div>
          )}
          <QueueRail
            queue={queue}
            onWatchedToggle={handleWatchedToggle}
            onPlaybackClaim={handleQueuePlaybackClaim}
          />
          <ChannelDirectory
            channels={channels}
            loading={carouselData.loading}
            error={carouselData.error}
            onRetry={handleDirectoryRetry}
            onWatchedToggle={handleWatchedToggle}
            onAddToQueue={queue.add}
            isQueued={queue.isQueued}
            queueFull={queue.isFull}
            playbackSuspended={playbackOwner !== 'directory'}
            onPlaybackClaim={handleDirectoryPlaybackClaim}
            initialChannelId={deepLinkedChannelId}
            onLoadMoreUploads={channelUploads.loadChannel}
            loadingMoreChannelIds={channelUploads.loadingChannelIds}
            fullyLoadedChannelIds={channelUploads.fullyLoadedChannelIds}
          />
        </CardContent>
      </Card>
    </div>
  );
}
