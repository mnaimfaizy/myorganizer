import type { Meta, StoryObj } from '@storybook/react';
import { expect, waitFor, within } from '@storybook/test';

import { toast } from '../../hooks/use-toast';
import { Toaster } from './Toaster';

const meta: Meta<typeof Toaster> = {
  component: Toaster,
  title: 'Components/Toaster',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Toaster>;

export const ShowsToast: Story = {
  render: function Render() {
    return <Toaster />;
  },
  play: async () => {
    toast({
      title: 'Backup complete',
      description: 'Last snapshot is ready to restore.',
    });
    await waitFor(() => {
      expect(within(document.body).getByText('Backup complete')).toBeVisible();
    });
    await waitFor(() => {
      expect(
        within(document.body).getByText('Last snapshot is ready to restore.'),
      ).toBeVisible();
    });
  },
};
