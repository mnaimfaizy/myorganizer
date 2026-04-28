'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@myorganizer/web-ui';
import * as React from 'react';

/**
 * Minimal subset of {@link GetLatestVaultBackupResponse} required to render the
 * "Last backup" summary. Kept local so this component does not pull a hard
 * dependency on `@myorganizer/app-api-client` types that change on regeneration.
 */
export interface LastBackupCardRecord {
  event: string;
  source: string;
  status: string;
  createdAt: string;
}

export interface LastBackupCardProps {
  /**
   * The latest successful backup record. `null` means no record was found
   * (the API returned 404). `undefined` means the record could not be
   * determined (network error, still loading after error, etc.).
   */
  record: LastBackupCardRecord | null | undefined;
  /** Render a loading skeleton instead of the resolved state. */
  isLoading?: boolean;
  /** Optional className for layout overrides. */
  className?: string;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      return iso;
    }
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

/**
 * Renders a one-line summary of the user's most recent vault backup event.
 *
 * States:
 * - Loading: shimmer placeholder.
 * - `record` is `null`: "No backups recorded yet".
 * - `record` is `undefined`: "Last backup: unknown".
 * - `record` is provided: "Last backup: <date> via <source>".
 */
export function LastBackupCard({
  record,
  isLoading,
  className,
}: LastBackupCardProps) {
  let body: React.ReactNode;

  if (isLoading) {
    body = (
      <div
        data-testid="last-backup-loading"
        className="h-4 w-48 animate-pulse rounded bg-muted"
      />
    );
  } else if (record === null) {
    body = <p data-testid="last-backup-empty">No backups recorded yet</p>;
  } else if (record === undefined) {
    body = <p data-testid="last-backup-unknown">Last backup: unknown</p>;
  } else {
    body = (
      <p data-testid="last-backup-recorded">
        Last backup: <strong>{formatDate(record.createdAt)}</strong> via{' '}
        <span>{record.source}</span>
      </p>
    );
  }

  return (
    <Card className={className} data-testid="last-backup-card">
      <CardHeader>
        <CardTitle>Vault backups</CardTitle>
        <CardDescription>
          Showing your most recent successful backup activity.
        </CardDescription>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
