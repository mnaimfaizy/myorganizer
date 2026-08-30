'use client';

/**
 * Wires the live Vault Session to `SyncStatusIndicator`. Not a Vault UI
 * Component itself — it reads `useVaultSyncStatus`, which is live state, so
 * it cannot be expressed with mock props alone (GUIDELINES §1) — the same
 * reason `pullRunner.tsx` and `reconcileRunner.tsx` sit beside the Vault UI
 * Components in this library rather than among them.
 *
 * The widget also decides *placement*, which is why the Popover lives here
 * rather than in the indicator. `SyncStatusIndicator` is a panel: a label, a
 * sentence of detail, and a retry action stacked vertically. The dashboard
 * header is a fixed `h-16` row, so that panel rendered inline overflowed it
 * and covered the page beneath. The header gets a one-line chip; the panel
 * keeps its shape inside the Popover, where a portal puts it outside the
 * header's bounds entirely.
 */
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  cn,
} from '@myorganizer/web-ui';

import {
  SyncStatusIndicator,
  SYNC_TONE_ICON,
  SYNC_TONE_TEXT_CLASS,
} from './SyncStatusIndicator';
import { useVaultSyncStatus } from './useVaultSyncStatus';
import { describeVaultSyncStatus } from './vaultSyncMessages';

export function SyncStatusWidget({ className }: { className?: string }) {
  const { status, retry } = useVaultSyncStatus();
  const reading = describeVaultSyncStatus(status);

  // A healthy sync adds no chrome to the page, so there is no chip to open.
  // The indicator is still rendered, and renders nothing: its live region is
  // left empty rather than announcing success, so a screen reader is told no
  // more than a sighted User is shown.
  if (!reading.label) {
    return <SyncStatusIndicator status={status} className={className} />;
  }

  const Icon = SYNC_TONE_ICON[reading.tone];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn('h-8 gap-1.5 px-2', className)}
          data-testid="sync-status-trigger"
        >
          {Icon && (
            <Icon
              className={cn(
                'h-4 w-4 shrink-0',
                SYNC_TONE_TEXT_CLASS[reading.tone],
              )}
              aria-hidden="true"
            />
          )}
          {/* The label is the chip on a wide header and the icon carries it on
              a narrow one, so the accessible name comes from the sr-only copy
              below rather than from text that disappears at `sm`. */}
          <span
            className={cn(
              'hidden text-sm font-medium sm:inline',
              SYNC_TONE_TEXT_CLASS[reading.tone],
            )}
            aria-hidden="true"
          >
            {reading.label}
          </span>
          <span className="sr-only">{`${reading.label}. Show sync details.`}</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80">
        <SyncStatusIndicator status={status} onRetry={retry} />
      </PopoverContent>
    </Popover>
  );
}
