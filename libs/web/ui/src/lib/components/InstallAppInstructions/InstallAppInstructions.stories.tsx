import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';

import { Card, CardContent, CardHeader, CardTitle } from '../Card/Card';
import { InstallAppInstructions } from './InstallAppInstructions';

// Click and step-list assertions for this primitive live in
// InstallAppInstructions.spec.tsx. These stories are visual only.
const meta: Meta<typeof InstallAppInstructions> = {
  component: InstallAppInstructions,
  title: 'Components/InstallAppInstructions',
  tags: ['autodocs'],
  argTypes: {
    mode: {
      control: 'select',
      options: ['prompt', 'ios', 'mac-safari'],
      description:
        "'prompt' offers a one-tap install; 'ios' and 'mac-safari' explain the Safari steps",
    },
  },
  args: {
    mode: 'prompt',
    onInstall: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof InstallAppInstructions>;

export const ChromiumPrompt: Story = {
  args: {
    mode: 'prompt',
  },
};

export const IosInstructions: Story = {
  args: {
    mode: 'ios',
  },
};

export const MacSafariInstructions: Story = {
  args: {
    mode: 'mac-safari',
  },
};

// Mirrors the dashboard home widget (InstallAppCard) framing. The dismiss
// control in that card belongs to the widget, not to this primitive, so it is
// left out here.
export const InDashboardCard: Story = {
  args: {
    mode: 'prompt',
  },
  render: function Render(args) {
    return (
      <Card className="max-w-xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Install MyOrganiser
          </CardTitle>
        </CardHeader>
        <CardContent>
          <InstallAppInstructions {...args} />
        </CardContent>
      </Card>
    );
  },
};
