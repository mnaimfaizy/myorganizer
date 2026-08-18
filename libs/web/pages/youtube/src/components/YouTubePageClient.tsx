'use client';

import { Button, Card, CardContent, CardTitle } from '@myorganizer/web-ui';
import { RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import {
  formatRetryAt,
  useVideoQueue,
  useYouTubeCarousel,
  useYouTubeConnect,
  useYouTubeStatus,
  useYouTubeSubscriptions,
  useYouTubeSyncStatus,
} from '../hooks';
import { SubscriptionManager } from './SubscriptionManager';
import { ChannelDirectory } from './ChannelDirectory';
import { QueueRail } from './QueueRail';
import { SyncFreshnessIndicator } from './SyncFreshnessIndicator';
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
        <p className="text-sm text-gray-500">Loading…</p>
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
  const subs = useYouTubeSubscriptions();
  const carouselData = useYouTubeCarousel();
  const syncStatus = useYouTubeSyncStatus();
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const isCooldownActive = !!syncStatus.isCooldownActive;

  const library = useMemo(
    () => carouselData.channels.flatMap((channel) => channel.videos),
    [carouselData.channels],
  );

  const queue = useVideoQueue(library);

  const handleWatchedToggle = useCallback(
    (videoId: string, watched: boolean) => {
      carouselData.updateWatched(videoId, watched);
    },
    [carouselData],
  );

  const handleSync = useCallback(async () => {
    if (isCooldownActive) return;
    setSyncing(true);
    setSyncError(null);
    try {
      // Use the authoritative trigger so we get sync-status details
      await syncStatus.triggerSync();
      // Refresh lists but don't fail the whole flow — preserve cached data on failures
      const results = await Promise.allSettled([
        subs.refresh(),
        carouselData.refresh(),
      ]);
      const hadFailure = results.some((r) => r.status === 'rejected');
      if (hadFailure) {
        setSyncError('Refresh failed — showing cached data');
      }
      // Refresh authoritative sync status
      await syncStatus.refresh();
    } catch (err: unknown) {
      setSyncError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  }, [isCooldownActive, syncStatus, subs, carouselData]);

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
        loading={subs.loading || syncing}
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
                syncing ||
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
                className={`h-4 w-4 ${carouselData.loading || syncStatus.loading || syncing ? 'animate-spin' : ''}`}
              />
            </Button>
          </div>
        </div>
        <CardContent className="mt-4 space-y-6">
          {syncError && (
            <div
              role="alert"
              aria-live="assertive"
              className="mb-2 text-sm text-red-600 dark:text-red-400"
            >
              {syncError}
            </div>
          )}
          <QueueRail queue={queue} onWatchedToggle={handleWatchedToggle} />
          <ChannelDirectory
            channels={carouselData.channels}
            loading={carouselData.loading}
            error={carouselData.error}
            onRetry={handleDirectoryRetry}
            onWatchedToggle={handleWatchedToggle}
            onAddToQueue={queue.add}
            isQueued={queue.isQueued}
            queueFull={queue.isFull}
          />
        </CardContent>
      </Card>
    </div>
  );
}
