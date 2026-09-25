import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from './Badge';

const meta: Meta<typeof Badge> = {
  component: Badge,
  title: 'Components/Badge',
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'secondary', 'destructive', 'outline'],
      description: 'The visual style variant of the badge',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {
  args: {
    children: 'Active',
    variant: 'default',
  },
};

export const Secondary: Story = {
  args: {
    children: 'Draft',
    variant: 'secondary',
  },
};

export const Destructive: Story = {
  args: {
    children: 'Overdue',
    variant: 'destructive',
  },
};

export const Outline: Story = {
  args: {
    children: 'Archived',
    variant: 'outline',
  },
};

export const LongContent: Story = {
  args: {
    children: 'Waiting for calendar sync confirmation from Google Workspace',
    className: 'max-w-[12rem]',
  },
};
