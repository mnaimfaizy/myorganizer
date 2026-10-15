'use client';

import { useCallback } from 'react';

import { Button, DialogFooter } from '@myorganiser/web-ui';
import { useExportVault } from '@myorganiser/web-vault-ui';

interface DeleteAccountEscapeCopyStepProps {
  escapeCopyDownloaded: boolean;
  onEscapeCopyDownloaded: () => void;
  onContinue: () => void;
  onCancel: () => void;
}

export function DeleteAccountEscapeCopyStep({
  escapeCopyDownloaded,
  onEscapeCopyDownloaded,
  onContinue,
  onCancel,
}: DeleteAccountEscapeCopyStepProps) {
  const { exporting, exportVaultNow } = useExportVault();

  const handleDownload = useCallback(async () => {
    const ok = await exportVaultNow();
    if (ok) {
      onEscapeCopyDownloaded();
    }
  }, [exportVaultNow, onEscapeCopyDownloaded]);

  return (
    <>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Deleting your account removes the server copy of your vault. To keep
          your data, download an Escape Copy first.
        </p>
        <div>
          <Button
            type="button"
            variant="outline"
            data-testid="escape-copy-button"
            onClick={handleDownload}
            disabled={exporting}
          >
            {exporting ? 'Downloading…' : 'Download an Escape Copy'}
          </Button>
        </div>
        {escapeCopyDownloaded && (
          <p role="status" className="text-sm text-foreground">
            Escape Copy downloaded.
          </p>
        )}
      </div>
      <DialogFooter className="gap-2 sm:gap-0">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          variant={escapeCopyDownloaded ? 'default' : 'outline'}
          data-testid="delete-account-continue"
          onClick={onContinue}
        >
          {escapeCopyDownloaded ? 'Continue' : 'Continue without a copy'}
        </Button>
      </DialogFooter>
    </>
  );
}
