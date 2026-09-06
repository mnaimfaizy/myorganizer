'use client';

import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@myorganizer/web-ui';
import { TriangleAlert } from 'lucide-react';
import { useCallback, useState } from 'react';

export type UnacknowledgedRecoveryKeyBannerSurface = 'locked' | 'unlocked';

export type UnacknowledgedRecoveryKeyBannerProps = {
  /**
   * Where the banner is shown.
   * `locked` — unlock/recover screen: the fact only, no action, no dismissal.
   * `unlocked` — above children: the same fact plus Rotate and "I already have it".
   */
  surface: UnacknowledgedRecoveryKeyBannerSurface;
  /**
   * Called only after the User confirms "I already have it". Unlocked surface only.
   * Omit on the locked surface.
   */
  onAlreadyHaveIt?: () => void;
  /**
   * Destination for Rotate. Unlocked surface only.
   * Default: '/dashboard/vault' (the page that already hosts Recovery Key Rotation).
   */
  rotateHref?: string;
  className?: string;
};

const RECOVERY_KEY_FACT =
  'No Recovery Key was ever saved for this vault. If you forget your passphrase, there is no way back.';

const DEFAULT_ROTATE_HREF = '/dashboard/vault';

/**
 * Reminds the User that Recovery Key Acknowledgment was never recorded for this
 * vault. On the locked surface the fact is deliberately unclearable; on the
 * unlocked surface the User may rotate or claim they already hold the key.
 *
 * No live Vault access, no decryption, no persistence — fully expressible with
 * mock props. Distinct from {@link RecoveryKeyAcknowledgment}, which is the
 * one-time mint screen shown immediately after vault creation.
 */
export function UnacknowledgedRecoveryKeyBanner({
  surface,
  onAlreadyHaveIt,
  rotateHref = DEFAULT_ROTATE_HREF,
  className,
}: UnacknowledgedRecoveryKeyBannerProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleOpenConfirm = useCallback(() => {
    setConfirmOpen(true);
  }, []);

  const handleConfirmOpenChange = useCallback((open: boolean) => {
    setConfirmOpen(open);
  }, []);

  const handleCancel = useCallback(() => {
    setConfirmOpen(false);
  }, []);

  const handleConfirm = useCallback(() => {
    setConfirmOpen(false);
    onAlreadyHaveIt?.();
  }, [onAlreadyHaveIt]);

  return (
    <>
      <div
        className={cn('flex flex-col gap-2', className)}
        data-testid="unacknowledged-recovery-key-banner"
      >
        <div className="flex items-center gap-1.5">
          <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          <p
            className="text-sm font-medium text-warning"
            data-testid="unacknowledged-recovery-key-fact"
          >
            {RECOVERY_KEY_FACT}
          </p>
        </div>

        {surface === 'unlocked' && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <a
                href={rotateHref}
                data-testid="unacknowledged-recovery-key-rotate-link"
              >
                Rotate recovery key
              </a>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenConfirm}
              data-testid="unacknowledged-recovery-key-already-have-it-button"
            >
              I already have it
            </Button>
          </div>
        )}

        {/*
          The announcement repeats the fact rendered above, because visible text
          alone is not announced at the moment it appears — which is the whole
          job of a live region here.

          The duplication has a consequence for tests: every string shown is in
          the DOM twice, so a Playwright `getByText` substring match resolves to
          two elements and fails strict mode. Assert against the `data-testid`
          attributes on this component, not its copy.
        */}
        <p className="sr-only" role="status" aria-live="polite">
          {RECOVERY_KEY_FACT}
        </p>
      </div>

      {surface === 'unlocked' && (
        <Dialog open={confirmOpen} onOpenChange={handleConfirmOpenChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                You already have this vault's recovery key?
              </DialogTitle>
              <DialogDescription>
                The product cannot check that. If you are wrong, a forgotten
                passphrase has no way back.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="button" onClick={handleConfirm}>
                I already have it
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
