'use client';

import { Button, CardTitle } from '@myorganizer/web-ui';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  useYouTubeAvailability,
  useYouTubeConnect,
  useYouTubeStatus,
  useYouTubeSubscriptions,
  useYouTubeSyncStatus,
  YouTubeRequestError,
} from '../hooks';
import { useSyncRun } from '../hooks/useSyncRun';
import { isRunLive } from '../lib/syncProgress';
import { DisconnectYouTubeDialog } from './DisconnectYouTubeDialog';
import { SubscriptionManager } from './SubscriptionManager';
import { YouTubeConnectPrompt } from './YouTubeConnectPrompt';
import { YouTubeUnavailableNotice } from './YouTubeUnavailableNotice';

export function YouTubeChannelsPageClient() {
  const { available } = useYouTubeAvailability();
  const { connected, status, refresh: refreshStatus } = useYouTubeStatus();
  const { connect } = useYouTubeConnect();
  const [disconnectNotice, setDisconnectNotice] = useState<{
    message: string;
    googlePermissionsUrl: string;
  } | null>(null);

  const disconnectNoticeBanner =
    disconnectNotice === null ? null : (
      <div role="status" className="mx-4 mt-4 text-sm text-muted-foreground">
        {disconnectNotice.message}{' '}
        <a
          href={disconnectNotice.googlePermissionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Manage Google permissions
        </a>
      </div>
    );

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
      <>
        {disconnectNoticeBanner}
        <YouTubeConnectPrompt
          onConnect={connect}
          statusMessage={
            status === 'revoked'
              ? 'Your previous connection was revoked. Please reconnect.'
              : undefined
          }
        />
      </>
    );
  }

  return (
    <>
      {disconnectNoticeBanner}
      <ConnectedChannelsDashboard
        refreshStatus={refreshStatus}
        onDisconnectNotice={setDisconnectNotice}
      />
    </>
  );
}

interface ConnectedChannelsDashboardProps {
  refreshStatus: () => Promise<void>;
  onDisconnectNotice: (
    notice: { message: string; googlePermissionsUrl: string } | null,
  ) => void;
}

function ConnectedChannelsDashboard({
  refreshStatus,
  onDisconnectNotice,
}: ConnectedChannelsDashboardProps) {
  const { disconnect } = useYouTubeConnect();
  const subs = useYouTubeSubscriptions();
  const syncStatus = useYouTubeSyncStatus();
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);
  const [waitingForClaim, setWaitingForClaim] = useState(false);

  const syncBusy = isRunLive(syncStatus.status);
  const disconnectDisabledReason = syncBusy
    ? 'Disconnect unavailable while a sync is running'
    : undefined;

  const isChannelCooldownActive = !!syncStatus.isChannelCooldownActive;
  const channelSyncInFlight =
    waitingForClaim || syncStatus.status?.channelStatus === 'discovering';

  const refreshSync = syncStatus.refresh;
  const triggerChannelSync = syncStatus.triggerChannelSync;

  const handleRunComplete = useCallback(async () => {
    await subs.refresh();
  }, [subs]);

  useSyncRun(syncStatus.status, {
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

  const handleChannelSync = useCallback(() => {
    if (isChannelCooldownActive || syncBusy) return;

    void triggerChannelSync().catch(() => {
      // Swallow errors; the polled status is authoritative.
    });

    setWaitingForClaim(true);
  }, [isChannelCooldownActive, syncBusy, triggerChannelSync]);

  const handleRequestDisconnect = useCallback(() => {
    setDisconnectError(null);
    setDisconnectDialogOpen(true);
  }, []);

  const handleDisconnectDialogOpenChange = useCallback((open: boolean) => {
    setDisconnectDialogOpen(open);
    if (!open) {
      setDisconnectError(null);
    }
  }, []);

  const handleConfirmDisconnect = useCallback(
    async (deleteWatchedMarks: boolean) => {
      setDisconnectError(null);
      try {
        const result = await disconnect({ deleteWatchedMarks });
        setDisconnectDialogOpen(false);
        await refreshStatus();
        if (result.revokeFailed && result.googlePermissionsUrl) {
          onDisconnectNotice({
            message: result.message,
            googlePermissionsUrl: result.googlePermissionsUrl,
          });
        } else {
          onDisconnectNotice(null);
        }
      } catch (err: unknown) {
        const message =
          err instanceof YouTubeRequestError && err.code === 'sync_run_live'
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Disconnect failed';
        setDisconnectError(message);
        throw err instanceof Error ? err : new Error(message);
      }
    },
    [disconnect, onDisconnectNotice, refreshStatus],
  );

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="flex items-center gap-4">
        <CardTitle>Channels</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/youtube">Videos</Link>
        </Button>
      </div>

      <SubscriptionManager
        subscriptions={subs.subscriptions}
        loading={subs.loading || channelSyncInFlight}
        onSync={handleChannelSync}
        onToggle={subs.toggle}
        onRequestDisconnect={handleRequestDisconnect}
        disconnectDisabled={syncBusy}
        disconnectDisabledReason={disconnectDisabledReason}
        syncRetryAt={syncStatus.status?.channelRetryAt}
        syncBusy={syncBusy}
      />

      <DisconnectYouTubeDialog
        open={disconnectDialogOpen}
        onOpenChange={handleDisconnectDialogOpenChange}
        onConfirm={handleConfirmDisconnect}
        error={disconnectError}
      />
    </div>
  );
}
