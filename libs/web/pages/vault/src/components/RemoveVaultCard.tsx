'use client';

import { useCallback, useState } from 'react';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ConfirmDeleteDialog,
  useToast,
} from '@myorganizer/web-ui';

import {
  useOptionalVaultSession,
  vaultBlobTypeLabel,
} from '@myorganizer/web-vault-ui';

import { getErrorMessage } from '../utils/getErrorMessage';
import {
  useExportVault,
  useLatestCloudBackup,
  useUnsentVaultBlobTypes,
  useVaultOperationAvailability,
} from '../hooks';
import { VAULT_OPERATIONS } from '../policy';
import { VaultUnavailableNotice } from './VaultUnavailableNotice';

/**
 * Format an ISO date string to locale string, with fallback.
 */
function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

export function RemoveVaultCard() {
  const { toast } = useToast();
  const vaultSession = useOptionalVaultSession();
  const handle = vaultSession?.handle ?? null;
  const { allowed, unavailableReason } = useVaultOperationAvailability(
    VAULT_OPERATIONS.Removal,
  );

  const [open, setOpen] = useState(false);
  const { exporting, exportVaultNow } = useExportVault();
  const latestCloud = useLatestCloudBackup();
  const unsentTypes = useUnsentVaultBlobTypes(open);

  const handleOpenDialog = useCallback(() => {
    setOpen(true);
  }, []);

  const handleExportFirst = useCallback(() => {
    void exportVaultNow();
  }, [exportVaultNow]);

  const handleConfirmRemove = useCallback(async () => {
    if (!handle) return;

    try {
      handle.removeVault();

      toast({
        title: 'Vault removed',
        description: 'This Vault was removed from this device.',
      });

      setOpen(false);

      // Full page reload to reset vault-dependent surfaces and VaultGate state.
      //
      // The reconcile runner no longer needs it: `removeVault` moves the Local
      // Vault Revision and the runner passes on that alone (ADR 0066, decision
      // point 2). What still needs it is `VaultGate`, which seeds its status
      // from storage once and re-reads only when the handle identity changes —
      // and a removal does not change it. Decision point 4 is what makes the
      // gate answer for itself; this line goes with it, not before it.
      window.location.reload();
    } catch (error) {
      toast({
        title: 'Removal failed',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  }, [handle, toast]);

  /**
   * Render the confirmation dialog description based on unsent vault blob types.
   * Always returns plain text/inline content (no block elements or buttons).
   * Note: DialogDescription renders as <p>, so we return text/inline fragments only.
   */
  function renderDescription(): React.ReactNode {
    switch (unsentTypes.status) {
      case 'pending':
        return 'Checking what this device has not sent to the server yet…';

      case 'loaded': {
        if (unsentTypes.types.length === 0) {
          return (
            <>
              Every part of this Vault has already reached the server. Removing
              it deletes nothing that has not been synced.
            </>
          );
        }

        const typeNames = unsentTypes.types.map(vaultBlobTypeLabel).join(', ');
        return (
          <>
            This device holds changes it has not sent to the server yet, for:{' '}
            {typeNames}. Removing this Vault deletes that Ciphertext from this
            device, and it does not exist anywhere else.
          </>
        );
      }

      default:
        return null;
    }
  }

  /**
   * Render backup status and export button.
   * Returned as children content of the dialog, rendered as a separate block after description.
   * Status-only (does not claim backup is a safety mechanism), with export button only when empty.
   */
  function renderDialogChildren(): React.ReactNode {
    let backupStatus: React.ReactNode = null;

    switch (latestCloud.status) {
      case 'loading':
        backupStatus = 'Checking whether this Vault has an independent backup…';
        break;

      case 'loaded':
        backupStatus = `An independent backup of this Vault exists, last made on ${formatDate(latestCloud.record.createdAt)}.`;
        break;

      case 'empty':
        backupStatus = 'This Vault has no independent backup.';
        break;

      case 'error':
      default:
        backupStatus = 'Backup status could not be confirmed.';
        break;
    }

    const exportButton = latestCloud.status === 'empty' && (
      <Button
        type="button"
        variant="secondary"
        data-testid="remove-vault-export-first-button"
        disabled={exporting}
        onClick={handleExportFirst}
      >
        {exporting ? 'Exporting…' : 'Export vault JSON first'}
      </Button>
    );

    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">{backupStatus}</p>
        {exportButton}
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Remove local vault</CardTitle>
          <CardDescription>
            Delete this device's copy of your Vault. Your account and passphrase
            are unaffected.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            This only clears the encrypted copy stored in this browser. It does
            not delete your account, does not touch any other user's Local Vault
            on this device, and does not affect a cloud backup if one exists.
          </p>
          <VaultUnavailableNotice
            reason={unavailableReason}
            testId="remove-vault-unavailable"
          />
          <div className="flex gap-2">
            <Button
              variant="destructive"
              data-testid="remove-vault-button"
              disabled={!allowed}
              onClick={handleOpenDialog}
            >
              Remove local vault
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmDeleteDialog
        open={open}
        onOpenChange={setOpen}
        title="Remove this Vault from this device?"
        description={renderDescription()}
        onConfirm={handleConfirmRemove}
        children={renderDialogChildren()}
      />
    </>
  );
}
