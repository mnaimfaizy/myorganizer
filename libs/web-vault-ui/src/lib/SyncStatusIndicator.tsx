'use client';

import { Button, cn } from '@myorganizer/web-ui';
import { CircleAlert, Clock } from 'lucide-react';
import type { VaultSyncStatus } from '@myorganizer/web-vault';
import {
  describeVaultSyncStatus,
  type VaultSyncTone,
} from './vaultSyncMessages';

export interface SyncStatusIndicatorProps {
  /** The derived sync status, or null while it has not been computed yet. */
  status: VaultSyncStatus | null;
  /** Called when the User clicks the manual retry action. Omit to hide the action entirely even when the reading says canRetry. */
  onRetry?: () => void;
  /** Additional CSS classes to merge onto the root element. */
  className?: string;
}

/**
 * The icon each tone carries, exported so a compact presentation of the same
 * reading — the header chip in `syncStatusWidget.tsx` — shows the same icon
 * rather than choosing a second one that can drift from this.
 */
export const SYNC_TONE_ICON = {
  ok: null,
  pending: Clock,
  error: CircleAlert,
} as const;

/**
 * `ok` and `pending` reach the semantic `muted-foreground` role, which carries
 * its own light/dark pair — hence no `dark:` variant on them.
 *
 * `error` deliberately does not reach `destructive`. That role resolves to
 * `0 63% 31%` in dark mode, a dark red intended as a *background* behind
 * `destructive-foreground`. As text on the dark surface it lands at roughly
 * 2:1 contrast and fails WCAG AA outright, where the palette red below is
 * about 9:1. Retargeting it needs a foreground-safe error role that does not
 * exist yet, not a swap to the one that happens to be named for errors.
 */
export const SYNC_TONE_TEXT_CLASS: Record<VaultSyncTone, string> = {
  ok: 'text-muted-foreground',
  pending: 'text-muted-foreground',
  error: 'text-red-700 dark:text-red-300',
} as const;

/**
 * Vault sync status indicator. Shows whether changes are fully synced to the
 * server or if there are pending changes or failures. A healthy, synced state
 * renders minimally with only a screen-reader announcement.
 *
 * No live Vault access, no decryption, no network calls — fully expressible
 * with mock props.
 */
export function SyncStatusIndicator({
  status,
  onRetry,
  className,
}: SyncStatusIndicatorProps) {
  const reading = describeVaultSyncStatus(status);
  const Icon = reading.label ? SYNC_TONE_ICON[reading.tone] : null;

  // Build announcement for screen reader: only when there's something to say
  const announcement = reading.label
    ? [reading.label, reading.detail].filter(Boolean).join('. ')
    : '';

  return (
    <div
      className={cn('flex flex-col gap-2', className)}
      data-testid="sync-status-indicator"
    >
      {reading.label && (
        <>
          <div className="flex items-center gap-1.5">
            {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
            <p
              className={cn(
                'text-sm font-medium',
                SYNC_TONE_TEXT_CLASS[reading.tone],
              )}
              data-testid="sync-status-label"
            >
              {reading.label}
            </p>
          </div>
          {reading.detail && (
            <p
              className="text-xs text-gray-600 dark:text-gray-400"
              data-testid="sync-status-detail"
            >
              {reading.detail}
            </p>
          )}
          {reading.canRetry && onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              data-testid="sync-status-retry-button"
            >
              Retry now
            </Button>
          )}
        </>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
