'use client';

import { useMemo } from 'react';

import { GoogleDriveCloudBackupProvider } from '@myorganizer/web-vault';
import { useOptionalVaultSession } from '@myorganizer/web-vault-ui';

import { useGoogleIdentityScript } from '../hooks';
import { ClaimLocalVaultCard } from './ClaimLocalVaultCard';
import { CloudBackupLiveCard } from './CloudBackupLiveCard';
import { CloudBackupUnavailableCard } from './CloudBackupUnavailableCard';
import { ExportVaultCard } from './ExportVaultCard';
import { ImportVaultCard } from './ImportVaultCard';
import { RemoveVaultCard } from './RemoveVaultCard';

export function VaultPageClient() {
  const gisStatus = useGoogleIdentityScript();
  const vaultSession = useOptionalVaultSession();
  const handle = vaultSession?.handle ?? null;
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
      <ClaimLocalVaultCard />
      {provider && handle ? (
        <CloudBackupLiveCard provider={provider} handle={handle} />
      ) : (
        <CloudBackupUnavailableCard
          reason={
            !handle
              ? 'Sign in to enable cloud backup.'
              : !clientId
                ? 'Cloud backup is not configured. Set NEXT_PUBLIC_GOOGLE_CLIENT_ID to enable Google Drive backup.'
                : gisStatus === 'error'
                  ? 'Google Identity Services failed to load. Check your network and try again.'
                  : 'Loading Google Drive integration…'
          }
        />
      )}
      <ExportVaultCard />
      <RemoveVaultCard />
      <ImportVaultCard />
    </div>
  );
}
