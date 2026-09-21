'use client';

import { useMemo, useState, useCallback } from 'react';

import { GoogleDriveCloudBackupProvider } from '@myorganizer/web-vault';
import { useOptionalVaultSession } from '@myorganizer/web-vault-ui';

import {
  useGoogleIdentityScript,
  useVaultOperationAvailability,
} from '../hooks';
import { VAULT_OPERATIONS } from '../policy';
import { ChangePassphraseCard } from './ChangePassphraseCard';
import { CloudBackupLiveCard } from './CloudBackupLiveCard';
import { CloudBackupUnavailableCard } from './CloudBackupUnavailableCard';
import { EscapeCopyReaderCard } from './EscapeCopyReaderCard';
import { ExportVaultCard } from './ExportVaultCard';
import { ImportVaultCard } from './ImportVaultCard';
import { RecoveryKeyRotationCard } from './RecoveryKeyRotationCard';
import { RemoveVaultCard } from './RemoveVaultCard';
import { VaultUnlockCard } from './VaultUnlockCard';

export function VaultPageClient() {
  const [justMadeACopy, setJustMadeACopy] = useState(false);

  const handleEscapeCopyMade = useCallback(() => {
    setJustMadeACopy(true);
  }, []);

  const gisStatus = useGoogleIdentityScript();
  const vaultSession = useOptionalVaultSession();
  const handle = vaultSession?.handle ?? null;
  const cloudBackup = useVaultOperationAvailability(
    VAULT_OPERATIONS.CloudBackup,
  );
  const clientId =
    // Production and staging bake NEXT_PUBLIC_GOOGLE_CLIENT_ID in at
    // build time. window.__MYORG_GOOGLE_CLIENT_ID__ is an E2E/dev fallback
    // only — not a hosted configuration path (issue #751).
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

  function renderCloudBackupCard() {
    // The policy answers first: with no Local Vault to back up, how Google Drive
    // is configured is not the reason the card is unavailable.
    if (cloudBackup.unavailableReason !== null) {
      return (
        <CloudBackupUnavailableCard reason={cloudBackup.unavailableReason} />
      );
    }
    if (!clientId) {
      return (
        <CloudBackupUnavailableCard reason="Cloud backup is not configured. Set NEXT_PUBLIC_GOOGLE_CLIENT_ID to enable Google Drive backup." />
      );
    }
    if (gisStatus === 'error') {
      return (
        <CloudBackupUnavailableCard reason="Google Identity Services failed to load. Check your network and try again." />
      );
    }
    if (!provider || !handle) {
      return (
        <CloudBackupUnavailableCard reason="Loading Google Drive integration…" />
      );
    }
    return (
      <CloudBackupLiveCard
        provider={provider}
        handle={handle}
        onEscapeCopyMade={handleEscapeCopyMade}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <VaultUnlockCard />
      <ChangePassphraseCard />
      <RecoveryKeyRotationCard />
      {renderCloudBackupCard()}
      <ExportVaultCard onEscapeCopyMade={handleEscapeCopyMade} />
      <EscapeCopyReaderCard justMadeACopy={justMadeACopy} />
      <RemoveVaultCard />
      <ImportVaultCard />
    </div>
  );
}
