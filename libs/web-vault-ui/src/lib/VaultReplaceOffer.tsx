'use client';

import { Button, Checkbox, Label } from '@myorganizer/web-ui';
import { useCallback, useState } from 'react';

export type VaultReplaceOfferProps = {
  /** Export the Vault about to be replaced. Parent handles the actual download/audit/toast. */
  onExport: () => Promise<void>;
  /** Carry out the replace. Only enabled once the User has checked the acknowledgement box. Parent handles the actual write/toast. */
  onConfirm: () => Promise<void>;
  /** Decline. Nothing is written on either side. */
  onDecline: () => void;
};

/**
 * The offer to replace the currently-owned Local Vault with an Unclaimed Local
 * Vault, when evidence (either server-meta or recovery-key) proves they are both
 * the signed-in User's.
 *
 * Renders an explanation, an export button for the vault about to be replaced
 * (so the User has a copy before deciding), an acknowledgement checkbox that
 * gates the confirm button, and the decline action.
 */
export function VaultReplaceOffer(props: VaultReplaceOfferProps): React.ReactNode {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportDone, setExportDone] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [isAcknowledged, setIsAcknowledged] = useState(false);

  const handleExport = useCallback(async () => {
    setExportError(null);
    setExportDone(false);
    setIsExporting(true);
    try {
      await props.onExport();
      setExportDone(true);
    } catch (e: unknown) {
      setExportError(
        e instanceof Error ? e.message : 'Failed to export vault',
      );
    } finally {
      setIsExporting(false);
    }
  }, [props]);

  const handleConfirm = useCallback(async () => {
    setConfirmError(null);
    setIsConfirming(true);
    try {
      await props.onConfirm();
    } catch (e: unknown) {
      setConfirmError(
        e instanceof Error ? e.message : 'Failed to replace vault',
      );
    } finally {
      setIsConfirming(false);
    }
  }, [props]);

  const handleDecline = useCallback(() => {
    props.onDecline();
  }, [props]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        This device holds two vaults that are both yours. The one you're using
        now, and another one that evidence just proved is also yours. Replacing
        will swap the other one in and overwrite the one you're using now.
      </p>

      <div>
        <Button
          type="button"
          variant="outline"
          onClick={handleExport}
          disabled={isExporting}
        >
          {isExporting ? 'Exporting…' : "Export the vault I'm using now"}
        </Button>
        {exportError && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {exportError}
          </p>
        )}
        {exportDone && (
          <p className="mt-2 text-sm text-green-600">Exported</p>
        )}
      </div>

      <div className="flex items-start gap-2">
        <Checkbox
          id="replace-acknowledge"
          checked={isAcknowledged}
          onCheckedChange={(checked) => setIsAcknowledged(checked === true)}
        />
        <Label
          htmlFor="replace-acknowledge"
          className="cursor-pointer text-sm font-normal leading-relaxed"
        >
          I understand this replaces the vault I&apos;m using on this device now.
        </Label>
      </div>

      {confirmError && (
        <p role="alert" className="text-sm text-destructive">
          {confirmError}
        </p>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          onClick={handleConfirm}
          disabled={!isAcknowledged || isConfirming}
        >
          {isConfirming ? 'Replacing…' : 'Confirm'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={handleDecline}
        >
          Decline
        </Button>
      </div>
    </div>
  );
}
