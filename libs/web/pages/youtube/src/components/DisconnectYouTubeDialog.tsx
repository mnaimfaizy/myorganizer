'use client';

import { Checkbox, ConfirmDeleteDialog, Label } from '@myorganizer/web-ui';
import { useCallback, useId, useState } from 'react';

export interface DisconnectYouTubeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when the user confirms. Receives whether they opted to delete Watched marks. Must throw on failure so ConfirmDeleteDialog stays open. */
  onConfirm: (deleteWatchedMarks: boolean) => Promise<void>;
  /** Error message to show inside the dialog (role="alert"). Cleared by parent when dialog closes or confirm starts. */
  error?: string | null;
}

export function DisconnectYouTubeDialog({
  open,
  onOpenChange,
  onConfirm,
  error,
}: DisconnectYouTubeDialogProps) {
  const [deleteWatchedMarks, setDeleteWatchedMarks] = useState(false);
  const deleteWatchedMarksCheckboxId = useId();

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setDeleteWatchedMarks(false);
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange],
  );

  const handleConfirm = useCallback(async () => {
    await onConfirm(deleteWatchedMarks);
  }, [deleteWatchedMarks, onConfirm]);

  return (
    <ConfirmDeleteDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Disconnect YouTube?"
      description={
        <>
          This removes your Followed Channels, Cached Uploads, notification and
          digest settings, and OAuth tokens from MyOrganizer. Watched marks are
          kept for 30 days unless you choose to delete them below.
        </>
      }
      confirmLabel="Disconnect"
      onConfirm={handleConfirm}
    >
      <div className="space-y-3 py-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id={deleteWatchedMarksCheckboxId}
            checked={deleteWatchedMarks}
            onCheckedChange={(checked) =>
              setDeleteWatchedMarks(checked === true)
            }
          />
          <Label htmlFor={deleteWatchedMarksCheckboxId}>
            Also delete my Watched marks
          </Label>
        </div>
        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="text-sm text-destructive"
          >
            {error}
          </div>
        )}
      </div>
    </ConfirmDeleteDialog>
  );
}
