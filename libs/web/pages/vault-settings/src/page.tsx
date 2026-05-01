'use client';

import { useCallback, useMemo } from 'react';

import {
  ExportVaultCard,
  ImportVaultCard,
} from '@myorganizer/web-pages/vault-export';
import {
  GoogleDriveCloudBackupProvider,
  createVaultBackupsApi,
} from '@myorganizer/web-vault';
import { CloudBackupCard, LastBackupCard } from '@myorganizer/web-vault-ui';

import { useCloudBackup } from './hooks/useCloudBackup';
import { useGoogleIdentityScript } from './hooks/useGoogleIdentityScript';
import { useLatestBackup } from './hooks/useLatestBackup';
import { useLatestCloudBackup } from './hooks/useLatestCloudBackup';

export default function VaultSettingsPage() {
  const latest = useLatestBackup();

  const cardRecord =
    latest.status === 'loaded'
      ? latest.record
      : latest.status === 'empty'
        ? null
        : undefined;

  const gisStatus = useGoogleIdentityScript();
  const clientId =
    typeof process !== 'undefined' && process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
      ? process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
      : typeof window !== 'undefined'
        ? ((window as { __MYORG_GOOGLE_CLIENT_ID__?: string })
            .__MYORG_GOOGLE_CLIENT_ID__ ?? '')
        : '';

  const provider = useMemo(() => {
    if (!clientId || gisStatus !== 'ready') return null;
    return new GoogleDriveCloudBackupProvider({ clientId });
  }, [clientId, gisStatus]);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <LastBackupCard
        record={cardRecord}
        isLoading={latest.status === 'loading'}
      />
      {provider ? (
        <CloudBackupSection provider={provider} />
      ) : (
        <CloudBackupUnavailable
          reason={
            !clientId
              ? 'Cloud backup is not configured. Set NEXT_PUBLIC_GOOGLE_CLIENT_ID to enable Google Drive backup.'
              : gisStatus === 'error'
                ? 'Google Identity Services failed to load. Check your network and try again.'
                : 'Loading Google Drive integration…'
          }
        />
      )}
      <ExportVaultCard />
      <ImportVaultCard />
    </div>
  );
}

function CloudBackupSection({
  provider,
}: {
  provider: GoogleDriveCloudBackupProvider;
}) {
  const getLastSuccessMs = useCallback(async () => {
    try {
      const api = createVaultBackupsApi();
      const response = await api.getLatestBackup({
        status: 'success',
        source: 'google-drive',
      });
      const created = response.data?.createdAt;
      return created ? Date.parse(created) : null;
    } catch (err: unknown) {
      const e = err as { response?: { status?: number } };
      if (e?.response?.status === 404) return null;
      // On unexpected errors, treat as unknown last-success and let the
      // scheduler skip this tick.
      return null;
    }
  }, []);

  const cloud = useCloudBackup({
    providerId: 'google-drive',
    provider,
    getLastSuccessMs,
  });
  const latestCloud = useLatestCloudBackup(cloud.backupCounter);

  const latestRecord =
    latestCloud.status === 'loaded'
      ? latestCloud.record
      : latestCloud.status === 'empty'
        ? null
        : undefined;

  return (
    <CloudBackupCard
      providerLabel="Google Drive"
      connection={cloud.connection}
      autoInterval={cloud.autoInterval}
      latestRecord={latestRecord}
      isLatestLoading={latestCloud.status === 'loading'}
      isBusy={cloud.isBusy}
      lastError={cloud.lastError}
      onConnect={() => {
        void cloud.connect();
      }}
      onDisconnect={() => {
        void cloud.disconnect();
      }}
      onBackupNow={() => {
        void cloud.backupNow();
      }}
      onRestoreLatest={() => {
        void cloud.restoreLatest();
      }}
      onAutoIntervalChange={cloud.setAutoInterval}
    />
  );
}

function CloudBackupUnavailable({ reason }: { reason: string }) {
  return (
    <div
      data-testid="cloud-backup-unavailable"
      className="rounded-md border border-dashed p-4 text-sm text-muted-foreground"
    >
      {reason}
    </div>
  );
}
