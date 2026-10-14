'use client';

import { cn, useOnlineStatus } from '@myorganizer/web-ui';
import { WifiOff } from 'lucide-react';

export interface OfflineNoticeProps {
  /** Additional CSS classes merged onto the visible bar. */
  className?: string;
}

const OFFLINE_COPY =
  "You're offline. Vault changes are saved on this device and sync when you reconnect. Other changes may need a connection.";

/**
 * Slim bar shown while the browser is offline. It is not dismissible and does
 * not take focus. Announcements go through a live region that stays mounted at
 * all times: a polite region only announces a change to content it already
 * contains, so the text is written into it only while offline.
 */
export function OfflineNotice({ className }: OfflineNoticeProps) {
  const online = useOnlineStatus();

  return (
    <>
      <p
        className="sr-only"
        role="status"
        aria-live="polite"
        data-testid="offline-notice-status"
      >
        {online ? '' : OFFLINE_COPY}
      </p>
      {!online && (
        <div
          className={cn(
            'flex items-center gap-2 border-b border-warning bg-warning/10 px-4 py-1.5 text-sm text-warning',
            className,
          )}
          aria-hidden="true"
          data-testid="offline-notice"
        >
          <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{OFFLINE_COPY}</p>
        </div>
      )}
    </>
  );
}
