'use client';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@myorganizer/web-ui';
import * as React from 'react';

/**
 * Connection state shown by {@link CloudBackupCard}. Mirrors the discriminated
 * union exported by `@myorganizer/web-vault` but kept local so this component
 * has no runtime dependency on the vault library.
 */
export type CloudBackupCardConnection =
  | { status: 'disconnected' }
  | { status: 'connected'; account?: { email?: string; displayName?: string } }
  | { status: 'needs-reconnect'; reason?: string };

export type CloudBackupCardAutoInterval =
  | 'off'
  | 'daily'
  | 'weekly'
  | 'monthly';

/** Minimal record shape for showing the latest cloud backup timestamp. */
export interface CloudBackupCardRecord {
  source: string;
  status: string;
  createdAt: string;
}

export interface CloudBackupCardProps {
  /** Display name for the provider. Defaults to `'Google Drive'`. */
  providerLabel?: string;
  connection: CloudBackupCardConnection;
  autoInterval: CloudBackupCardAutoInterval;
  /** Latest successful provider-scoped backup record. */
  latestRecord: CloudBackupCardRecord | null | undefined;
  /** Loading flag for the latest backup record fetch. */
  isLatestLoading?: boolean;
  /** Master busy flag; disables all action buttons. */
  isBusy?: boolean;
  /** Last action error to surface inline. */
  lastError?: string | null;

  onConnect: () => void;
  onDisconnect: () => void;
  onBackupNow: () => void;
  onRestoreLatest: () => void;
  onAutoIntervalChange: (next: CloudBackupCardAutoInterval) => void;

  className?: string;
}

const INTERVAL_LABELS: Record<CloudBackupCardAutoInterval, string> = {
  off: 'Off',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

/**
 * Encrypted cloud backup management card. Pure presentational component;
 * all state and side effects are owned by the parent (typically a hook
 * such as `useCloudBackup`).
 */
export function CloudBackupCard({
  providerLabel = 'Google Drive',
  connection,
  autoInterval,
  latestRecord,
  isLatestLoading,
  isBusy,
  lastError,
  onConnect,
  onDisconnect,
  onBackupNow,
  onRestoreLatest,
  onAutoIntervalChange,
  className,
}: CloudBackupCardProps) {
  const isConnected = connection.status === 'connected';
  const needsReconnect = connection.status === 'needs-reconnect';

  let connectionBadge: React.ReactNode;
  if (isConnected) {
    const acct = connection.account;
    connectionBadge = (
      <span data-testid="cloud-backup-connection-connected">
        Connected{acct?.email ? ` as ${acct.email}` : ''}
      </span>
    );
  } else if (needsReconnect) {
    connectionBadge = (
      <span data-testid="cloud-backup-connection-needs-reconnect">
        Reconnect required
        {connection.reason ? ` — ${connection.reason}` : ''}
      </span>
    );
  } else {
    connectionBadge = (
      <span data-testid="cloud-backup-connection-disconnected">
        Not connected
      </span>
    );
  }

  let latestBody: React.ReactNode;
  if (isLatestLoading) {
    latestBody = (
      <div
        data-testid="cloud-backup-latest-loading"
        className="h-4 w-48 animate-pulse rounded bg-muted"
      />
    );
  } else if (latestRecord === null) {
    latestBody = (
      <p data-testid="cloud-backup-latest-empty">
        No cloud backups recorded yet
      </p>
    );
  } else if (latestRecord === undefined) {
    latestBody = (
      <p data-testid="cloud-backup-latest-unknown">
        Last cloud backup: unknown
      </p>
    );
  } else {
    latestBody = (
      <p data-testid="cloud-backup-latest-recorded">
        Last cloud backup: <strong>{formatDate(latestRecord.createdAt)}</strong>
      </p>
    );
  }

  return (
    <Card className={className} data-testid="cloud-backup-card">
      <CardHeader>
        <CardTitle>Encrypted cloud backup</CardTitle>
        <CardDescription>
          Store ciphertext-only vault bundles in {providerLabel}. Plaintext
          never leaves this device.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm">{connectionBadge}</span>
          {isConnected || needsReconnect ? (
            <Button
              data-testid="cloud-backup-disconnect-button"
              variant="outline"
              size="sm"
              disabled={isBusy}
              onClick={onDisconnect}
            >
              Disconnect
            </Button>
          ) : (
            <Button
              data-testid="cloud-backup-connect-button"
              size="sm"
              disabled={isBusy}
              onClick={onConnect}
            >
              Connect {providerLabel}
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="cloud-backup-interval">Automatic backup</Label>
          <Select
            value={autoInterval}
            onValueChange={(value) =>
              onAutoIntervalChange(value as CloudBackupCardAutoInterval)
            }
          >
            <SelectTrigger
              id="cloud-backup-interval"
              data-testid="cloud-backup-interval-trigger"
              disabled={isBusy}
            >
              <SelectValue placeholder="Off" />
            </SelectTrigger>
            <SelectContent>
              {(
                Object.keys(INTERVAL_LABELS) as CloudBackupCardAutoInterval[]
              ).map((value) => (
                <SelectItem
                  key={value}
                  value={value}
                  data-testid={`cloud-backup-interval-${value}`}
                >
                  {INTERVAL_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            data-testid="cloud-backup-now-button"
            disabled={isBusy || !isConnected}
            onClick={onBackupNow}
          >
            {isBusy ? 'Working…' : 'Back up now'}
          </Button>
          <Button
            data-testid="cloud-backup-restore-button"
            variant="outline"
            disabled={isBusy || !isConnected}
            onClick={onRestoreLatest}
          >
            Restore from cloud
          </Button>
        </div>

        <div data-testid="cloud-backup-latest">{latestBody}</div>

        {lastError ? (
          <p
            data-testid="cloud-backup-error"
            className="text-sm text-destructive"
          >
            {lastError}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
