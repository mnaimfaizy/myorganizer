import type { Meta, StoryObj } from '@storybook/react';

import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from './Toast';

function ToastDefaultExample() {
  return (
    <ToastProvider>
      <Toast defaultOpen>
        <div className="grid gap-1">
          <ToastTitle>Task saved</ToastTitle>
          <ToastDescription>
            Your changes were saved to the workspace.
          </ToastDescription>
        </div>
        <ToastClose />
      </Toast>
      <ToastViewport />
    </ToastProvider>
  );
}

function ToastDestructiveExample() {
  return (
    <ToastProvider>
      <Toast defaultOpen variant="destructive">
        <div className="grid gap-1">
          <ToastTitle>Unable to delete task</ToastTitle>
          <ToastDescription>
            This task is linked to an active shared folder and cannot be
            removed.
          </ToastDescription>
        </div>
        <ToastClose />
      </Toast>
      <ToastViewport />
    </ToastProvider>
  );
}

const meta: Meta<typeof ToastDefaultExample> = {
  component: ToastDefaultExample,
  title: 'Components/Toast',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ToastDefaultExample>;

export const Default: Story = {};

export const Destructive: Story = {
  render: function Render() {
    return <ToastDestructiveExample />;
  },
};
