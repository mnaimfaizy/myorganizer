'use client';

import { useCallback } from 'react';

import { CloudBackupCard } from '@myorganizer/web-vault-ui';
import { createVaultBackupsApi } from '@myorganizer/web-vault';
import type { GoogleDriveCloudBackupProvider } from '@myorganizer/web-vault';

import { useCloudBackup, useLatestCloudBackup } from '../hooks';

interface CloudBackupLiveCardProps {
  provider: GoogleDriveCloudBackupProvider;
}

export function CloudBackupLiveCard({ provider }: CloudBackupLiveCardProps) {
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
