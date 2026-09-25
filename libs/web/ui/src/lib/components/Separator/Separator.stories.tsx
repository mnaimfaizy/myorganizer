import type { Meta, StoryObj } from '@storybook/react';
import { Separator } from './Separator';

const meta: Meta<typeof Separator> = {
  component: Separator,
  title: 'Components/Separator',
  tags: ['autodocs'],
  argTypes: {
    orientation: {
      control: 'select',
      options: ['horizontal', 'vertical'],
      description: 'The orientation of the separator',
    },
    decorative: {
      control: 'boolean',
      description: 'Whether the separator is purely decorative',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Separator>;

export const Horizontal: Story = {
  render: () => (
    <div className="w-[20rem] space-y-4">
      <p className="text-sm text-muted-foreground">Upcoming tasks</p>
      <Separator />
      <p className="text-sm text-muted-foreground">Completed this week</p>
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div className="flex h-32 items-stretch gap-4">
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Inbox
      </div>
      <Separator orientation="vertical" />
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Archive
      </div>
    </div>
  ),
};
