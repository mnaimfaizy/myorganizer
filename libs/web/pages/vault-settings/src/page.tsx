'use client';

import {
  ExportVaultCard,
  ImportVaultCard,
} from '@myorganizer/web-pages/vault-export';
import { LastBackupCard } from '@myorganizer/web-vault-ui';

import { useLatestBackup } from './hooks/useLatestBackup';

export default function VaultSettingsPage() {
  const latest = useLatestBackup();

  const cardRecord =
    latest.status === 'loaded'
      ? latest.record
      : latest.status === 'empty'
        ? null
        : undefined;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <LastBackupCard
        record={cardRecord}
        isLoading={latest.status === 'loading'}
      />
      <ExportVaultCard />
      <ImportVaultCard />
    </div>
  );
}
