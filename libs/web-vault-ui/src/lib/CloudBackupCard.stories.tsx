import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';

import { CloudBackupCard } from './CloudBackupCard';

/** Fixed "now" timestamp for deterministic relative age display. */
const PINNED_NOW = 1713365600000; // 2026-04-16T12:00:00Z

/** Copy created 2 hours before PINNED_NOW. */
const COPY_2_HOURS_OLD = '2026-04-16T10:00:00Z';

/** Copy created 12 days before PINNED_NOW. */
const COPY_12_DAYS_OLD = '2026-04-04T12:00:00Z';

const meta: Meta<typeof CloudBackupCard> = {
  component: CloudBackupCard,
  title: 'Vault/CloudBackupCard',
  tags: ['autodocs'],
  args: {
    now: PINNED_NOW,
    onConnect: fn(),
    onReconnect: fn(),
    onDisconnect: fn(),
    onBackupNow: fn(),
    onRestore: fn(),
    onAgeLimitChange: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof CloudBackupCard>;

/**
 * Not Linked state: no Escape Copy connection has been set up.
 * The Link button is shown and all action buttons are disabled.
 */
export const NotLinked: Story = {
  args: {
    connection: { status: 'not-linked' },
    ageLimit: 'off',
    latestRecord: null,
  },
};

/**
 * Linked with a recent Escape Copy: connected to the provider,
 * and the newest copy was created 2 hours ago. All action buttons are enabled.
 */
export const LinkedWithRecentCopy: Story = {
  args: {
    connection: { status: 'linked' },
    ageLimit: '1-week',
    latestRecord: {
      source: 'google-drive',
      status: 'success',
      createdAt: COPY_2_HOURS_OLD,
    },
  },
};

/**
 * Linked but no Escape Copy yet: the user has connected the provider
 * but has not made a backup to it yet.
 */
export const LinkedNoCopyYet: Story = {
  args: {
    connection: { status: 'linked' },
    ageLimit: 'off',
    latestRecord: null,
  },
};

/**
 * Linked and Overdue with an old copy: the newest Escape Copy is older than
 * the user's age limit (1 week), so a warning is shown and "Back up now"
 * is suggested. Example: copy is 12 days old, limit is 1 week.
 */
export const LinkedOverdueWithOldCopy: Story = {
  args: {
    connection: { status: 'linked' },
    ageLimit: '1-week',
    isOverdue: true,
    latestRecord: {
      source: 'google-drive',
      status: 'success',
      createdAt: COPY_12_DAYS_OLD,
    },
  },
};

/**
 * Linked and Overdue with no copy: the user wants backups but has never
 * made one yet. The warning tells them they have no copy.
 */
export const LinkedOverdueNoCopy: Story = {
  args: {
    connection: { status: 'linked' },
    ageLimit: '1-week',
    isOverdue: true,
    latestRecord: null,
  },
};

/**
 * Reconnect Needed: the provider's token was lost or revoked.
 * A Reconnect button is shown alongside Unlink. A reason is provided
 * (typically from the provider's error).
 */
export const ReconnectNeeded: Story = {
  args: {
    connection: {
      status: 'reconnect-needed',
      reason: 'OAuth token expired',
    },
    ageLimit: 'off',
    latestRecord: null,
  },
};

/**
 * Busy: a backup or restore operation is in flight.
 * All action buttons are disabled and "Back up now" shows "Working…".
 */
export const Busy: Story = {
  args: {
    connection: { status: 'linked' },
    ageLimit: 'off',
    isBusy: true,
    latestRecord: {
      source: 'google-drive',
      status: 'success',
      createdAt: COPY_2_HOURS_OLD,
    },
  },
};

/**
 * Loading Latest: the component is fetching the newest copy's timestamp
 * from the provider. A skeleton placeholder is shown in place of the
 * "Newest copy" text.
 */
export const LoadingLatest: Story = {
  args: {
    connection: { status: 'linked' },
    ageLimit: 'off',
    isLatestLoading: true,
    latestRecord: null,
  },
};

/**
 * Latest Unknown: the component cannot determine whether a copy exists
 * (e.g., the provider was queried but no result was returned).
 * Shows "Newest copy: unknown".
 */
export const LatestUnknown: Story = {
  args: {
    connection: { status: 'linked' },
    ageLimit: 'off',
    latestRecord: undefined,
  },
};

/**
 * Error Message: the last action (backup or restore) failed.
 * An error message is displayed below the action buttons with role=alert.
 */
export const Error: Story = {
  args: {
    connection: { status: 'linked' },
    ageLimit: 'off',
    latestRecord: {
      source: 'google-drive',
      status: 'success',
      createdAt: COPY_2_HOURS_OLD,
    },
    lastError: 'Upload failed: provider quota exceeded.',
  },
};

/**
 * Long Content: error messages can be lengthy and should wrap gracefully
 * without breaking the layout.
 */
export const LongContent: Story = {
  args: {
    connection: { status: 'linked' },
    ageLimit: 'off',
    latestRecord: {
      source: 'google-drive',
      status: 'success',
      createdAt: COPY_2_HOURS_OLD,
    },
    lastError:
      'Restore failed: the encrypted bundle checksum did not match after download. Retry when your network is stable, or contact support with request id 00000000-0000-0000-0000-000000000000.',
  },
};
