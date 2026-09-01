import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from '@storybook/test';

import { RecoverySetNewPassphraseForm } from './RecoverySetNewPassphraseForm';

const meta: Meta<typeof RecoverySetNewPassphraseForm> = {
  component: RecoverySetNewPassphraseForm,
  title: 'Vault/RecoverySetNewPassphraseForm',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof RecoverySetNewPassphraseForm>;

export const Default: Story = {
  args: {
    masterKeyBytes: new Uint8Array([1, 2, 3, 4, 5]),
    onSubmit: fn(),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Initial state with a recovered Master Key. Both passphrase fields are empty, so the submit button is disabled due to validation failure. This is the state a user first sees when entering the recovery passphrase step.',
      },
    },
  },
};

export const NoMasterKey: Story = {
  args: {
    masterKeyBytes: null,
    onSubmit: fn(),
  },
  parameters: {
    docs: {
      description: {
        story:
          'The Master Key has not yet been recovered. The submit button is disabled regardless of what is typed in the passphrase fields, because there is nothing to rewrap and nothing to submit. This state precedes the recovery unlock process.',
      },
    },
  },
};

export const ValidPassphraseEntered: Story = {
  args: {
    masterKeyBytes: new Uint8Array([1, 2, 3, 4, 5]),
    onSubmit: fn(),
  },
  parameters: {
    docs: {
      description: {
        story:
          'User has entered a valid new passphrase (10+ characters) in both fields and they match. The submit button is now enabled and ready to be clicked. This demonstrates the goal state of the recovery passphrase step.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Fill in the first passphrase field with a valid passphrase (10+ characters)
    const newPassphraseInput = canvas.getByPlaceholderText('New passphrase');
    await userEvent.type(newPassphraseInput, 'RecoveryPassphrase123');

    // Fill in the confirmation field with the same passphrase
    const confirmInput = canvas.getByPlaceholderText('Confirm new passphrase');
    await userEvent.type(confirmInput, 'RecoveryPassphrase123');

    // Verify the submit button is now enabled
    await waitFor(() => {
      const submitButton = canvas.getByRole('button', {
        name: /Set new passphrase/i,
      });
      expect(submitButton).not.toBeDisabled();
    });
  },
};

export const MismatchedPassphrases: Story = {
  args: {
    masterKeyBytes: new Uint8Array([1, 2, 3, 4, 5]),
    onSubmit: fn(),
  },
  parameters: {
    docs: {
      description: {
        story:
          'User has entered a valid passphrase in the first field but typed something different in the confirmation field. The submit button remains disabled because the passphrases do not match, preventing accidental mismatches from being submitted.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Fill in the first passphrase field
    const newPassphraseInput = canvas.getByPlaceholderText('New passphrase');
    await userEvent.type(newPassphraseInput, 'ValidPassphrase123');

    // Fill in the confirmation field with a different value
    const confirmInput = canvas.getByPlaceholderText('Confirm new passphrase');
    await userEvent.type(confirmInput, 'DifferentPassphrase456');

    // Verify the submit button remains disabled
    await waitFor(() => {
      const submitButton = canvas.getByRole('button', {
        name: /Set new passphrase/i,
      });
      expect(submitButton).toBeDisabled();
    });
  },
};
