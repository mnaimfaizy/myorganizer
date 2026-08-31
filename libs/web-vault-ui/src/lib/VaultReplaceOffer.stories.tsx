import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from '@storybook/test';

import { VaultReplaceOffer } from './VaultReplaceOffer';

const meta: Meta<typeof VaultReplaceOffer> = {
  component: VaultReplaceOffer,
  title: 'Vault/VaultReplaceOffer',
  tags: ['autodocs'],
  args: {
    onExport: async () => undefined,
    onConfirm: async () => undefined,
    onDecline: () => undefined,
  },
};

export default meta;
type Story = StoryObj<typeof VaultReplaceOffer>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Default idle state. The component is ready for user interaction. The acknowledgement checkbox is unchecked, and the confirm button is disabled until the user checks it.',
      },
    },
  },
};

export const AcknowledgementUnchecked: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The acknowledgement checkbox is intentionally shown unchecked. The confirm button is disabled to prevent accidental replacement without acknowledgement.',
      },
    },
  },
};

export const AcknowledgementChecked: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The user has checked the acknowledgement checkbox. The confirm button is now enabled and ready to be clicked.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Check the acknowledgement checkbox
    const checkbox = canvas.getByRole('checkbox');
    await userEvent.click(checkbox);

    // Confirm button should now be enabled
    await waitFor(() => {
      const confirmButton = canvas.getByRole('button', {
        name: /Confirm/i,
      });
      expect(confirmButton).not.toBeDisabled();
    });
  },
};

export const ExportingInProgress: Story = {
  args: {
    onExport: async () =>
      new Promise(() => {
        // Never resolves
      }),
    onConfirm: async () => undefined,
    onDecline: () => undefined,
  },
  parameters: {
    docs: {
      description: {
        story:
          'The export action is pending. The export button shows "Exporting…" and is disabled to prevent duplicate requests. The user can still check the acknowledgement or click decline.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Click the export button
    const exportButton = canvas.getByRole('button', {
      name: /Export the vault/i,
    });
    await userEvent.click(exportButton);

    // Export button should be disabled and show loading text
    await waitFor(() => {
      expect(canvas.getByText(/Exporting…/i)).toBeInTheDocument();
      expect(exportButton).toBeDisabled();
    });
  },
};

export const ExportedSuccessfully: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The export completed successfully. A success message appears below the export button. The user can now check acknowledgement and proceed with replacement.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Click the export button
    const exportButton = canvas.getByRole('button', {
      name: /Export the vault/i,
    });
    await userEvent.click(exportButton);

    // Success message should appear
    await waitFor(() => {
      expect(canvas.getByText('Exported')).toBeInTheDocument();
    });
  },
};

export const ExportFailed: Story = {
  args: {
    onExport: async () => {
      throw new Error('Failed to read vault from storage');
    },
    onConfirm: async () => undefined,
    onDecline: () => undefined,
  },
  parameters: {
    docs: {
      description: {
        story:
          'The export action failed. An error message is displayed below the export button. The user can retry or cancel.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Click the export button
    const exportButton = canvas.getByRole('button', {
      name: /Export the vault/i,
    });
    await userEvent.click(exportButton);

    // Error message should appear
    await waitFor(() => {
      const alert = canvas.getByRole('alert');
      expect(alert).toBeVisible();
      expect(alert).toHaveTextContent('Failed to read vault from storage');
    });
  },
};

export const ConfirmingInProgress: Story = {
  args: {
    onExport: async () => undefined,
    onConfirm: async () =>
      new Promise(() => {
        // Never resolves
      }),
    onDecline: () => undefined,
  },
  parameters: {
    docs: {
      description: {
        story:
          'The confirm action is pending. After the user checks acknowledgement and clicks confirm, the confirm button shows "Replacing…" and is disabled. The user can cancel but not retry until the request settles.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Check the acknowledgement checkbox
    const checkbox = canvas.getByRole('checkbox');
    await userEvent.click(checkbox);

    // Click the confirm button
    const confirmButton = canvas.getByRole('button', {
      name: /Confirm/i,
    });
    await userEvent.click(confirmButton);

    // Confirm button should be disabled and show loading text
    await waitFor(() => {
      expect(canvas.getByText(/Replacing…/i)).toBeInTheDocument();
      expect(confirmButton).toBeDisabled();
    });
  },
};

export const ConfirmFailed: Story = {
  args: {
    onExport: async () => undefined,
    onConfirm: async () => {
      throw new Error('Recovery key no longer matches');
    },
    onDecline: () => undefined,
  },
  parameters: {
    docs: {
      description: {
        story:
          'The confirm action failed. An error message is displayed below the action buttons. The user can retry or decline.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Check the acknowledgement checkbox
    const checkbox = canvas.getByRole('checkbox');
    await userEvent.click(checkbox);

    // Click the confirm button
    const confirmButton = canvas.getByRole('button', {
      name: /Confirm/i,
    });
    await userEvent.click(confirmButton);

    // Error message should appear
    await waitFor(() => {
      const alert = canvas.getByRole('alert');
      expect(alert).toBeVisible();
      expect(alert).toHaveTextContent('Recovery key no longer matches');
    });
  },
};
