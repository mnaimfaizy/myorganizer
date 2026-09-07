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

import { useOptionalVaultSession } from '@myorganizer/web-vault-ui';

import { getErrorMessage } from '../utils/getErrorMessage';
import { useExportVault, useLatestCloudBackup } from '../hooks';

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

  const [open, setOpen] = useState(false);
  const { exporting, exportVaultNow } = useExportVault();
  const latestCloud = useLatestCloudBackup();

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

  // Render nothing if there's no vault or this vault is not owned by this user
  if (!handle || !handle.hasOwnedVault()) {
    return null;
  }

  /**
   * Render the confirmation dialog description based on backup status.
   * Always returns plain text/inline content (no block elements or buttons).
   * Note: DialogDescription renders as <p>, so we return text/inline fragments only.
   */
  function renderDescription(): React.ReactNode {
    switch (latestCloud.status) {
      case 'loading':
        return 'Checking whether this Vault has ever been backed up…';

      case 'loaded':
        return (
          <>
            This Vault was last backed up on{' '}
            {formatDate(latestCloud.record.createdAt)}. Removing it deletes only
            the copy on this device — your cloud backup is unaffected.
          </>
        );

      case 'empty':
        return (
          <>
            This Vault has never been backed up. Removing it deletes the only
            copy of this data, and this cannot be undone.
          </>
        );

      case 'error':
      default:
        return (
          <>
            Backup status could not be confirmed. Removing this Vault deletes
            its only copy on this device.
          </>
        );
    }
  }

  /**
   * Render the export button only when the vault has never been backed up.
   * Returned as children content of the dialog, rendered outside the description.
   */
  function renderDialogChildren(): React.ReactNode {
    if (latestCloud.status !== 'empty') {
      return undefined;
    }

    return (
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
          <div className="flex gap-2">
            <Button
              variant="destructive"
              data-testid="remove-vault-button"
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
