import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from '@storybook/test';
import { useState } from 'react';

import { Button } from '../Button/Button';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';

function ConfirmDeleteDialogTriggerExample() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Delete address</Button>
      <ConfirmDeleteDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete this address?"
        description="This will permanently delete the address at 123 Main St. This cannot be undone."
        onConfirm={() => {
          setOpen(false);
        }}
      />
    </>
  );
}

function ConfirmDeleteDialogOpenExample() {
  const [open, setOpen] = useState(true);

  return (
    <ConfirmDeleteDialog
      open={open}
      onOpenChange={setOpen}
      title="Delete this address?"
      description="This will permanently delete the address at 123 Main St. This cannot be undone."
      onConfirm={() => {
        setOpen(false);
      }}
    />
  );
}

function ConfirmDeleteDialogLongContentExample() {
  const [open, setOpen] = useState(true);

  return (
    <ConfirmDeleteDialog
      open={open}
      onOpenChange={setOpen}
      title="Delete archived workspace and all associated data?"
      description="This action cannot be undone. All archived projects, shared folders, collaborator permissions, and linked notification settings will be permanently removed from your organizer workspace. Any active collaborations will be ended. Export anything you may need before continuing. This includes all data, attachments, and shared access history."
      onConfirm={() => {
        setOpen(false);
      }}
    />
  );
}

function ConfirmDeleteDialogPendingExample() {
  const [open, setOpen] = useState(true);

  return (
    <ConfirmDeleteDialog
      open={open}
      onOpenChange={setOpen}
      title="Delete this item?"
      description="This action will be processed and cannot be undone."
      onConfirm={async () => {
        // Simulate async deletion operation
        await new Promise((resolve) => {
          setTimeout(resolve, 2000);
        });
        setOpen(false);
      }}
    />
  );
}

const meta: Meta<typeof ConfirmDeleteDialogTriggerExample> = {
  component: ConfirmDeleteDialogTriggerExample,
  title: 'Components/ConfirmDeleteDialog',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ConfirmDeleteDialogTriggerExample>;

export const Default: Story = {};

export const Open: Story = {
  render: function Render() {
    return <ConfirmDeleteDialogOpenExample />;
  },
};

export const LongContent: Story = {
  render: function Render() {
    return <ConfirmDeleteDialogLongContentExample />;
  },
};

export const PendingState: Story = {
  render: function Render() {
    return <ConfirmDeleteDialogPendingExample />;
  },
  play: async () => {
    // Find the confirm button in the portalled dialog content
    const confirmButton = within(document.body).getByRole('button', {
      name: 'Delete',
    });
    expect(confirmButton).toBeEnabled();

    // Find the cancel button to verify it is also initially enabled
    const cancelButton = within(document.body).getByRole('button', {
      name: 'Cancel',
    });
    expect(cancelButton).toBeEnabled();

    // Click the confirm button
    await userEvent.click(confirmButton);

    // Assert that the confirm button is now disabled and shows pending state
    const pendingButton = within(document.body).getByRole('button', {
      name: 'Delete…',
    });
    expect(pendingButton).toBeDisabled();

    // Assert that the cancel button is also disabled during the pending operation
    expect(cancelButton).toBeDisabled();

    // Wait for the async operation to complete and the dialog to close
    await waitFor(
      () => {
        expect(
          within(document.body).queryByRole('dialog'),
        ).not.toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  },
};
