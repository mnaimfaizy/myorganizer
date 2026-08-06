'use client';

import { Button, Card, CardContent, CardTitle } from '@myorganizer/web-ui';
import { RefreshCw } from 'lucide-react';
import { useCallback, useState } from 'react';
import {
  formatRetryAt,
  useYouTubeCarousel,
  useYouTubeConnect,
  useYouTubeStatus,
  useYouTubeSubscriptions,
  useYouTubeSyncStatus,
  useYouTubeVideos,
} from '../hooks';
import type { SortOption, ViewMode } from '../types';
import { SubscriptionManager } from './SubscriptionManager';
import { VideoCarousel } from './VideoCarousel';
import { VideoGrid } from './VideoGrid';

export function YouTubePageClient() {
  const { connected, status, refresh: refreshStatus } = useYouTubeStatus();
  const { connect, disconnect } = useYouTubeConnect();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const handleViewModeChange = useCallback(
    (mode: ViewMode) => {
      setViewMode(mode);
    },
    [setViewMode],
  );
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
    return <ConnectPrompt status={status} onConnect={connect} />;
  }

  return (
    <ConnectedDashboard
      viewMode={viewMode}
      onViewModeChange={handleViewModeChange}
      onDisconnect={handleDisconnect}
    />
  );
}

interface ConnectPromptProps {
  status: string;
  onConnect: () => void;
}

function ConnectPrompt({ status, onConnect }: ConnectPromptProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <div className="rounded-full bg-red-100 p-4 dark:bg-red-900/30">
        <svg
          viewBox="0 0 24 24"
          className="h-12 w-12 text-red-600 dark:text-red-400"
          fill="currentColor"
        >
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
        Connect Your YouTube Account
      </h2>
      <p className="max-w-md text-center text-sm text-gray-500">
        Link your YouTube account to view and manage videos from your subscribed
        channels. We only request read-only access.
      </p>
      {status === 'revoked' && (
        <p className="text-sm text-yellow-600 dark:text-yellow-400">
          Your previous connection was revoked. Please reconnect.
        </p>
      )}
      <Button onClick={onConnect}>Connect YouTube</Button>
    </div>
  );
}

interface ConnectedDashboardProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onDisconnect: () => void;
}

function ConnectedDashboard({
  viewMode,
  onViewModeChange,
  onDisconnect,
}: ConnectedDashboardProps) {
  const subs = useYouTubeSubscriptions();
  const gridData = useYouTubeVideos();
  const carouselData = useYouTubeCarousel();
  const syncStatus = useYouTubeSyncStatus();
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Stabilized handlers for VideoGrid/ChannelVideosClient
  const { setSort, setSearch, setPage } = gridData;
  const handleSortChange = useCallback(
    (sort: SortOption) => setSort(sort),
    [setSort],
  );
  const handleSearchChange = useCallback(
    (query: string) => setSearch(query),
    [setSearch],
  );
  const handlePageChange = useCallback(
    (page: number) => setPage(page),
    [setPage],
  );

  const isCooldownActive = !!syncStatus.isCooldownActive;

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
        gridData.refresh(),
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
  }, [isCooldownActive, syncStatus, subs, gridData, carouselData]);

  const onGridClick = useCallback(
    () => onViewModeChange('grid'),
    [onViewModeChange],
  );
  const onCarouselClick = useCallback(
    () => onViewModeChange('carousel'),
    [onViewModeChange],
  );
  const handleRetryClick = useCallback(async () => {
    if (isCooldownActive) return;
    await handleSync();
  }, [isCooldownActive, handleSync]);

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
        <div className="flex items-center justify-between">
          <CardTitle>Videos</CardTitle>
          <div className="flex gap-2">
            <div className="flex items-center gap-2">
              {/* Freshness/status */}
              {syncStatus.status && syncStatus.status.lastSyncedAt ? (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Last synced{' '}
                  {new Date(syncStatus.status.lastSyncedAt).toLocaleString()}
                </div>
              ) : (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Never synced
                </div>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={handleRetryClick}
                disabled={
                  gridData.loading ||
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
                  className={`h-4 w-4 ${gridData.loading || carouselData.loading || syncStatus.loading || syncing ? 'animate-spin' : ''}`}
                />
              </Button>
            </div>
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={onGridClick}
            >
              Grid
            </Button>
            <Button
              variant={viewMode === 'carousel' ? 'default' : 'outline'}
              size="sm"
              onClick={onCarouselClick}
            >
              Carousel
            </Button>
          </div>
        </div>
        {gridData.total === 0 && !gridData.loading && (
          <p className="mt-2 text-sm text-gray-500">
            No videos yet. Click &quot;Sync from YouTube&quot; above to fetch
            your subscriptions and their latest videos.
          </p>
        )}
        <CardContent className="mt-4">
          {/* Freshness/error display */}
          {syncError && (
            <div
              role="alert"
              aria-live="assertive"
              className="mb-2 text-sm text-red-600 dark:text-red-400"
            >
              {syncError}
            </div>
          )}
          {viewMode === 'grid' ? (
            <VideoGrid
              videos={gridData.videos}
              loading={gridData.loading}
              sort={gridData.sort}
              onSortChange={handleSortChange}
              search={gridData.search}
              onSearchChange={handleSearchChange}
              page={gridData.page}
              totalPages={gridData.totalPages}
              onPageChange={handlePageChange}
              total={gridData.total}
            />
          ) : (
            <VideoCarousel
              channels={carouselData.channels}
              loading={carouselData.loading}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
