import type { Meta, StoryObj } from '@storybook/react';
import { Input } from './Input';
import { Label } from '../Label/Label';

const meta: Meta<typeof Input> = {
  component: Input,
  title: 'Components/Input',
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'email', 'password', 'file'],
      description: 'The native input type',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the input is disabled',
    },
    'aria-invalid': {
      control: 'boolean',
      description: 'Whether the input is in an invalid state',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: {
    type: 'text',
    placeholder: 'Task title',
  },
};

function WithLabelExample() {
  return (
    <div className="grid w-full max-w-sm items-center gap-1.5">
      <Label htmlFor="email">Email</Label>
      <Input type="email" id="email" placeholder="you@example.com" />
    </div>
  );
}

export const WithLabel: Story = {
  render: () => <WithLabelExample />,
};

export const Empty: Story = {
  args: {
    type: 'text',
    placeholder: 'Search tasks, notes, or tags',
  },
};

export const Filled: Story = {
  args: {
    type: 'text',
    defaultValue: 'Weekly planning session',
  },
};

export const LongContent: Story = {
  args: {
    type: 'text',
    defaultValue:
      'Prepare agenda for quarterly review with stakeholders across product, design, and engineering',
    className: 'max-w-[16rem]',
  },
};

export const Disabled: Story = {
  args: {
    type: 'text',
    defaultValue: 'Read-only workspace name',
    disabled: true,
  },
};

function InvalidExample() {
  return (
    <div className="grid w-full max-w-sm items-center gap-1.5">
      <Label htmlFor="signup-email">Email</Label>
      <Input
        type="email"
        id="signup-email"
        defaultValue="not-an-email"
        aria-invalid
      />
    </div>
  );
}

export const Invalid: Story = {
  render: () => <InvalidExample />,
};

function PasswordExample() {
  return (
    <div className="grid w-full max-w-sm items-center gap-1.5">
      <Label htmlFor="password">Password</Label>
      <Input type="password" id="password" defaultValue="hunter2" />
    </div>
  );
}

export const Password: Story = {
  render: () => <PasswordExample />,
};

function FileExample() {
  return (
    <div className="grid w-full max-w-sm items-center gap-1.5">
      <Label htmlFor="attachment">Attachment</Label>
      <Input type="file" id="attachment" />
    </div>
  );
}

export const File: Story = {
  render: () => <FileExample />,
};
