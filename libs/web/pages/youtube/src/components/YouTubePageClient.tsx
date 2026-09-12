'use client';

import { Button, Card, CardContent, CardTitle } from '@myorganizer/web-ui';
import { RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import {
  formatRetryAt,
  useChannelUploads,
  useVideoQueue,
  useYouTubeCarousel,
  useYouTubeConnect,
  useYouTubeStatus,
  useYouTubeSubscriptions,
  useYouTubeSyncStatus,
} from '../hooks';
import { useSyncRun } from '../hooks/useSyncRun';
import { isRunLive } from '../lib/syncProgress';
import { SubscriptionManager } from './SubscriptionManager';
import { ChannelDirectory } from './ChannelDirectory';
import { QueueRail } from './QueueRail';
import { SyncFreshnessIndicator } from './SyncFreshnessIndicator';
import { SyncProgressPanel } from './SyncProgressPanel';
import { YouTubeConnectPrompt } from './YouTubeConnectPrompt';

export function YouTubePageClient() {
  const { connected, status, refresh: refreshStatus } = useYouTubeStatus();
  const { connect, disconnect } = useYouTubeConnect();
  const handleDisconnect = useCallback(async () => {
    await disconnect();
    await refreshStatus();
  }, [disconnect, refreshStatus]);

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

  return <ConnectedDashboard onDisconnect={handleDisconnect} />;
}

interface ConnectedDashboardProps {
  onDisconnect: () => void;
}

function ConnectedDashboard({ onDisconnect }: ConnectedDashboardProps) {
  // Digest mail and the subscription list deep-link a channel here. Read once
  // as the directory's initial selection rather than driving it from the URL,
  // so the User's own clicks are not fighting a stale query string.
  const deepLinkedChannelId = useSearchParams().get('channel');
  const subs = useYouTubeSubscriptions();
  const carouselData = useYouTubeCarousel();
  const syncStatus = useYouTubeSyncStatus();
  const [syncError, setSyncError] = useState<string | null>(null);

  const isCooldownActive = !!syncStatus.isCooldownActive;

  // Refresh lists when the sync run completes. This is the terminal transition only;
  // incremental refresh during the run is deferred per ADR 0080 decision 1.
  const handleRunComplete = useCallback(async () => {
    setSyncError(null);
    // Refresh lists but don't fail the whole flow — preserve cached data on failures
    const results = await Promise.allSettled([
      subs.refresh(),
      carouselData.refresh(),
    ]);
    const hadFailure = results.some((r) => r.status === 'rejected');
    if (hadFailure) {
      setSyncError('Refresh failed — showing cached data');
    }
  }, [subs, carouselData]);

  // Poll loop: starts on mount if run is already live, continues every 2s while live,
  // pauses on tab-hidden, resumes with immediate poll on tab-visible.
  useSyncRun(syncStatus.status, {
    poll: syncStatus.refresh,
    onRunComplete: handleRunComplete,
  });

  const channelUploads = useChannelUploads();

  // A channel the User expanded shows its full cached snapshot; every other
  // channel keeps the bounded slice the list endpoint returned.
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

  // Which surface owns the single active player. The queue rail and the
  // channel directory each carry their own player per the locked Variant B
  // and Variant C models, but only one of them may be playing: two YouTube
  // embeds running at once means two audio streams and two near-end handlers
  // racing to mark uploads Watched. Nothing plays on arrival, so the
  // directory — the home surface — holds the claim until the rail takes it.
  const [playbackOwner, setPlaybackOwner] = useState<'directory' | 'queue'>(
    'directory',
  );

  const handleDirectoryPlaybackClaim = useCallback(() => {
    setPlaybackOwner('directory');
    // Leaves the queue contents alone — only the playing pointer is cleared,
    // so the rail keeps its order and the User can resume it.
    queue.stop();
  }, [queue]);

  const handleQueuePlaybackClaim = useCallback(() => {
    setPlaybackOwner('queue');
  }, []);

  const handleWatchedToggle = useCallback(
    (videoId: string, watched: boolean) => {
      // Both stores hold their own copy of an upload, so a Watched change has
      // to land in each or an expanded channel would show a stale badge.
      carouselData.updateWatched(videoId, watched);
      channelUploads.updateWatched(videoId, watched);
    },
    [carouselData, channelUploads],
  );

  // Invert the sync trigger per ADR 0080 decision 1:
  // 1. Fire the PUT without awaiting (unblock UI)
  // 2. Start polling immediately (polled status is authoritative)
  // 3. Swallow PUT errors (504 from long-running connection is cosmetic)
  // 4. Refresh lists on terminal transition only
  const handleSync = useCallback(async () => {
    if (isCooldownActive) return;

    // Check cooldown before attempting PUT
    if (syncStatus.status && syncStatus.status.retryAt) {
      const retryTime = Date.parse(syncStatus.status.retryAt);
      if (!Number.isNaN(retryTime) && retryTime > Date.now()) {
        return;
      }
    }

    // Fire the PUT without awaiting — the polling loop will catch its outcome.
    // Errors (504, connection drop) are swallowed; the loop will report what happened.
    void syncStatus.triggerSync().catch(() => {
      // Swallow errors; the polled status is authoritative.
    });

    // Start polling immediately so the UI updates without waiting for PUT response.
    // The useSyncRun hook will see the live status and begin the 2s poll cycle.
    void syncStatus.refresh();
  }, [isCooldownActive, syncStatus]);

  const handleRetryClick = useCallback(async () => {
    if (isCooldownActive) return;
    await handleSync();
  }, [isCooldownActive, handleSync]);

  const handleDirectoryRetry = useCallback(() => {
    carouselData.refresh();
  }, [carouselData]);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <SubscriptionManager
        subscriptions={subs.subscriptions}
        loading={subs.loading}
        onSync={handleSync}
        onToggle={subs.toggle}
        onDisconnect={onDisconnect}
        syncRetryAt={syncStatus.status?.retryAt}
      />

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
          </div>
          <div className="flex items-start gap-2">
            <SyncFreshnessIndicator status={syncStatus.status} />

            <Button
              variant="ghost"
              size="sm"
              onClick={handleRetryClick}
              disabled={
                carouselData.loading ||
                syncStatus.loading ||
                isRunLive(syncStatus.status) ||
                isCooldownActive
              }
              aria-label={
                isCooldownActive && syncStatus.status?.retryAt
                  ? `Retry disabled until ${formatRetryAt(syncStatus.status?.retryAt) ?? syncStatus.status?.retryAt}`
                  : 'Retry sync'
              }
              title={
                isCooldownActive && syncStatus.status?.retryAt
                  ? `Retry disabled until ${formatRetryAt(syncStatus.status?.retryAt) ?? syncStatus.status?.retryAt}`
                  : 'Retry sync'
              }
            >
              <RefreshCw
                className={`h-4 w-4 ${carouselData.loading || syncStatus.loading || isRunLive(syncStatus.status) ? 'animate-spin' : ''}`}
              />
            </Button>
          </div>
        </div>
        <CardContent className="mt-4 space-y-6">
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
