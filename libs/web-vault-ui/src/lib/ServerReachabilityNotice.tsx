'use client';

import { Button, cn } from '@myorganizer/web-ui';
import { TriangleAlert } from 'lucide-react';
import type { ServerReachability } from '@myorganizer/web-vault';
import {
  serverReachabilityReading,
  type ServerReachabilityTone,
} from './serverReachabilityMessages';

export interface ServerReachabilityNoticeProps {
  /** The reading, or null while no probe has resolved yet. */
  reachability: ServerReachability | null;
  /** Called when the User asks for a fresh reading. Omit to hide the action entirely even when the reading says canRecheck. */
  onRecheck?: () => void;
  /** Additional CSS classes merged onto the root element. */
  className?: string;
}

/**
 * The icon each tone carries, exported so a compact presentation of the same
 * reading can show the same icon rather than choosing a second one that can
 * drift from this.
 */
export const SERVER_REACHABILITY_TONE_ICON = {
  ok: null,
  attention: TriangleAlert,
} as const;

/**
 * `attention` reaches the semantic `warning` role rather than a raw palette
 * amber. The role carries its own light/dark pair, so there is no `dark:`
 * variant here — and it is a caution, deliberately not `destructive`: nothing
 * has failed when this renders, and nothing here is irreversible.
 */
export const SERVER_REACHABILITY_TONE_TEXT_CLASS: Record<
  ServerReachabilityTone,
  string
> = {
  ok: 'text-muted-foreground',
  attention: 'text-warning',
} as const;

/**
 * Server reachability notice. Warns a User before they commit a Recovery Key
 * Rotation that the change will not reach their other devices yet. Shows when
 * there is a reachability issue (unreachable, signed-out) and renders nothing
 * when the server is reachable — an affirmative "server reachable" would promise
 * a write will land, which no reading can promise.
 *
 * No live Vault access, no decryption, no network calls — fully expressible
 * with mock props.
 */
export function ServerReachabilityNotice({
  reachability,
  onRecheck,
  className,
}: ServerReachabilityNoticeProps) {
  const reading = serverReachabilityReading(reachability);
  const Icon = reading.label
    ? SERVER_REACHABILITY_TONE_ICON[reading.tone]
    : null;

  // Build announcement for screen reader: only when there's something to say
  const announcement = reading.label
    ? [reading.label, reading.detail].filter(Boolean).join('. ')
    : '';

  return (
    <div
      className={cn('flex flex-col gap-2', className)}
      data-testid="server-reachability-notice"
    >
      {reading.label && (
        <>
          <div className="flex items-center gap-1.5">
            {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
            <p
              className={cn(
                'text-sm font-medium',
                SERVER_REACHABILITY_TONE_TEXT_CLASS[reading.tone],
              )}
              data-testid="server-reachability-label"
            >
              {reading.label}
            </p>
          </div>
          {reading.detail && (
            <p
              className="text-xs text-muted-foreground"
              data-testid="server-reachability-detail"
            >
              {reading.detail}
            </p>
          )}
          {reading.canRecheck && onRecheck && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRecheck}
              data-testid="server-reachability-recheck-button"
            >
              Check again
            </Button>
          )}
        </>
      )}
      {/*
        The announcement repeats the label and detail rendered above, because
        visible text alone is not announced at the moment it appears — which is
        the whole job of a live region here.

        The duplication has a consequence for tests: every string shown is in
        the DOM twice, so a Playwright `getByText` substring match resolves to
        two elements and fails strict mode. Assert against the `data-testid`
        attributes on this component, not its copy. The same duplication in the
        toaster's announcer is what
        `apps/myorganizer-e2e/src/e2e/vault-recovery-key-rotation.spec.ts` had
        to add `{ exact: true }` for.
      */}
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
