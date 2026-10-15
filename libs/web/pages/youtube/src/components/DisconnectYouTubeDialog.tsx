import { ConfirmDeleteDialog } from '@myorganiser/web-ui';

export interface DisconnectYouTubeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when the user confirms. Must throw on failure so ConfirmDeleteDialog stays open. */
  onConfirm: () => Promise<void>;
  /** Error message to show inside the dialog (role="alert"). Cleared by parent when dialog closes or confirm starts. */
  error?: string | null;
}

export function DisconnectYouTubeDialog({
  open,
  onOpenChange,
  onConfirm,
  error,
}: DisconnectYouTubeDialogProps) {
  return (
    <ConfirmDeleteDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Disconnect YouTube?"
      description={
        <>
          Disconnecting revokes MyOrganiser&apos;s access and deletes your
          Followed Channels, Cached Uploads, Watched marks, notification and
          digest settings, and OAuth tokens from MyOrganiser. Watched marks are
          deleted and will not return if you reconnect.
        </>
      }
      confirmLabel="Disconnect"
      onConfirm={onConfirm}
    >
      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="py-2 text-sm text-destructive"
        >
          {error}
        </div>
      )}
    </ConfirmDeleteDialog>
  );
}
