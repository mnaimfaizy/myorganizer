import type { Meta, StoryObj } from '@storybook/react';

import { LastBackupCard } from './LastBackupCard';

const meta: Meta<typeof LastBackupCard> = {
  component: LastBackupCard,
  title: 'Vault/LastBackupCard',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof LastBackupCard>;

export const Recorded: Story = {
  args: {
    record: {
      event: 'export',
      source: 'local-file',
      status: 'success',
      createdAt: new Date().toISOString(),
    },
  },
};

export const Empty: Story = {
  args: {
    record: null,
  },
};

export const Unknown: Story = {
  args: {
    record: undefined,
  },
};

export const Loading: Story = {
  args: {
    record: null,
    isLoading: true,
  },
};
