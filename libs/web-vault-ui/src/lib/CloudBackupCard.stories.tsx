import type { Meta, StoryObj } from '@storybook/react';

import { CloudBackupCard } from './CloudBackupCard';

const noop = () => undefined;

/** Pinned ISO date — matches CloudBackupCard.spec.tsx for deterministic locale output. */
const PINNED_LATEST_DATE = '2026-04-15T00:00:00Z';

const meta: Meta<typeof CloudBackupCard> = {
  component: CloudBackupCard,
  title: 'Vault/CloudBackupCard',
  tags: ['autodocs'],
  args: {
    connection: { status: 'disconnected' },
    autoInterval: 'off',
    latestRecord: null,
    onConnect: noop,
    onDisconnect: noop,
    onBackupNow: noop,
    onRestoreLatest: noop,
    onAutoIntervalChange: noop,
  },
};

export default meta;
type Story = StoryObj<typeof CloudBackupCard>;

export const Disconnected: Story = {};

export const Connected: Story = {
  args: {
    connection: {
      status: 'connected',
      account: { email: 'vault.user@example.com' },
    },
    latestRecord: {
      source: 'google-drive',
      status: 'success',
      createdAt: PINNED_LATEST_DATE,
    },
  },
};

export const ConnectedWithoutEmail: Story = {
  args: {
    connection: { status: 'connected' },
    latestRecord: {
      source: 'google-drive',
      status: 'success',
      createdAt: PINNED_LATEST_DATE,
    },
  },
};

export const NeedsReconnect: Story = {
  args: {
    connection: {
      status: 'needs-reconnect',
      reason: 'OAuth token expired',
    },
    latestRecord: {
      source: 'google-drive',
      status: 'success',
      createdAt: PINNED_LATEST_DATE,
    },
  },
};

export const Busy: Story = {
  args: {
    connection: {
      status: 'connected',
      account: { email: 'vault.user@example.com' },
    },
    isBusy: true,
    latestRecord: {
      source: 'google-drive',
      status: 'success',
      createdAt: PINNED_LATEST_DATE,
    },
  },
};

export const LatestLoading: Story = {
  args: {
    connection: {
      status: 'connected',
      account: { email: 'vault.user@example.com' },
    },
    isLatestLoading: true,
  },
};

export const LatestEmpty: Story = {
  args: {
    connection: {
      status: 'connected',
      account: { email: 'vault.user@example.com' },
    },
    latestRecord: null,
  },
};

export const LatestUnknown: Story = {
  args: {
    connection: {
      status: 'connected',
      account: { email: 'vault.user@example.com' },
    },
  },
  render: function Render(args) {
    return <CloudBackupCard {...args} latestRecord={undefined} />;
  },
};

export const LastError: Story = {
  args: {
    connection: {
      status: 'connected',
      account: { email: 'vault.user@example.com' },
    },
    latestRecord: {
      source: 'google-drive',
      status: 'success',
      createdAt: PINNED_LATEST_DATE,
    },
    lastError: 'Upload failed: provider quota exceeded.',
  },
};

export const LongContent: Story = {
  args: {
    connection: {
      status: 'connected',
      account: {
        email:
          'very.long.vault.account.name.with.many.segments@enterprise-cloud-backup.example.com',
      },
    },
    latestRecord: {
      source: 'google-drive',
      status: 'success',
      createdAt: PINNED_LATEST_DATE,
    },
    lastError:
      'Restore failed: the encrypted bundle checksum did not match after download. Retry when your network is stable, or contact support with request id 00000000-0000-0000-0000-000000000000.',
  },
};
