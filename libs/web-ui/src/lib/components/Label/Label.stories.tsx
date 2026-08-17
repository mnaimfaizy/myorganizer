import type { Meta, StoryObj } from '@storybook/react';
import { Input } from '../Input/Input';
import { Label } from './Label';

const meta: Meta<typeof Label> = {
  component: Label,
  title: 'Components/Label',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Label>;

export const Default: Story = {
  args: {
    children: 'Task title',
  },
};

function WithInputExample() {
  return (
    <div className="grid w-full max-w-sm items-center gap-1.5">
      <Label htmlFor="task-title">Task title</Label>
      <Input id="task-title" type="text" placeholder="What needs doing?" />
    </div>
  );
}

export const WithInput: Story = {
  render: () => <WithInputExample />,
};

function PeerDisabledExample() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-1.5">
      <Input
        id="workspace-name"
        className="peer order-2"
        disabled
        defaultValue="Personal workspace"
      />
      <Label htmlFor="workspace-name" className="order-1">
        Workspace name
      </Label>
    </div>
  );
}

export const PeerDisabled: Story = {
  render: () => <PeerDisabledExample />,
};

export const LongContent: Story = {
  render: () => (
    <div className="grid w-full max-w-xs items-center gap-1.5">
      <Label htmlFor="description">
        Include any context your future self will need when this task resurfaces
      </Label>
      <Input id="description" type="text" placeholder="Optional details" />
    </div>
  ),
};
