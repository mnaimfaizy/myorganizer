'use client';

import { Button, Card, CardContent, CardTitle } from '@myorganizer/web-ui';
import { useState } from 'react';
import {
  useYouTubeCarousel,
  useYouTubeConnect,
  useYouTubeStatus,
  useYouTubeSubscriptions,
  useYouTubeVideos,
} from '../hooks';
import type { ViewMode } from '../types';
import { SubscriptionManager } from './SubscriptionManager';
import { VideoCarousel } from './VideoCarousel';
import { VideoGrid } from './VideoGrid';

export function YouTubePageClient() {
  const { connected, status, refresh: refreshStatus } = useYouTubeStatus();
  const { connect, disconnect } = useYouTubeConnect();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

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
      onViewModeChange={setViewMode}
      onDisconnect={async () => {
        await disconnect();
        await refreshStatus();
      }}
    />
  );
}

function ConnectPrompt({
  status,
  onConnect,
}: {
  status: string;
  onConnect: () => void;
}) {
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

function ConnectedDashboard({
  viewMode,
  onViewModeChange,
  onDisconnect,
}: {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onDisconnect: () => void;
}) {
  const subs = useYouTubeSubscriptions();
  const gridData = useYouTubeVideos();
  const carouselData = useYouTubeCarousel();

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <SubscriptionManager
        subscriptions={subs.subscriptions}
        loading={subs.loading}
        onSync={subs.sync}
        onToggle={subs.toggle}
        onDisconnect={onDisconnect}
      />

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <CardTitle>Videos</CardTitle>
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onViewModeChange('grid')}
            >
              Grid
            </Button>
            <Button
              variant={viewMode === 'carousel' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onViewModeChange('carousel')}
            >
              Carousel
            </Button>
          </div>
        </div>
        <CardContent className="mt-4">
          {viewMode === 'grid' ? (
            <VideoGrid
              videos={gridData.videos}
              loading={gridData.loading}
              sort={gridData.sort}
              onSortChange={gridData.setSort}
              search={gridData.search}
              onSearchChange={gridData.setSearch}
              page={gridData.page}
              totalPages={gridData.totalPages}
              onPageChange={gridData.setPage}
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
