import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from '@storybook/test';

import { RecoveryKeyClaimOffer } from './RecoveryKeyClaimOffer';

const meta: Meta<typeof RecoveryKeyClaimOffer> = {
  component: RecoveryKeyClaimOffer,
  title: 'Vault/RecoveryKeyClaimOffer',
  tags: ['autodocs'],
  args: {
    onClaim: async () => 'no-match',
  },
};

export default meta;
type Story = StoryObj<typeof RecoveryKeyClaimOffer>;

export const Collapsed: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Default state. Renders only the button that initiates the claim flow. No form, input, or message is visible until the user clicks.',
      },
    },
  },
};

export const KeyMatchesAVaultHere: Story = {
  args: {
    onClaim: async () => 'claimed',
  },
  parameters: {
    docs: {
      description: {
        story:
          'The recovery key successfully unlocks a vault on this device. The form expands, the user submits the key, and on success the component returns to collapsed state, clearing all input and messages. The parent is now responsible for rendering the claimed vault.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Click to expand the form
    const expandButton = canvas.getByRole('button', {
      name: /I have a recovery key/i,
    });
    await userEvent.click(expandButton);

    // Type a recovery key into the input
    const input = canvas.getByPlaceholderText('Paste your recovery key');
    await userEvent.type(input, 'valid-recovery-key-here');

    // Submit the form
    const submitButton = canvas.getByRole('button', {
      name: 'Claim this vault',
    });
    await userEvent.click(submitButton);

    // After successful claim, the component collapses back to the button state
    await waitFor(() => {
      const collapsedButton = canvas.getByRole('button', {
        name: /I have a recovery key/i,
      });
      expect(collapsedButton).toBeVisible();
    });
  },
};

export const KeyMatchesNothing: Story = {
  args: {
    onClaim: async () => 'no-match',
  },
  parameters: {
    docs: {
      description: {
        story:
          'The supplied recovery key does not match any vault on this device. The form stays expanded with the typed key visible, and a fixed error message is displayed. The user can try again with a different key or cancel.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Click to expand the form
    const expandButton = canvas.getByRole('button', {
      name: /I have a recovery key/i,
    });
    await userEvent.click(expandButton);

    // Type an invalid recovery key
    const input = canvas.getByPlaceholderText('Paste your recovery key');
    await userEvent.type(input, 'invalid-key');

    // Submit the form
    const submitButton = canvas.getByRole('button', {
      name: 'Claim this vault',
    });
    await userEvent.click(submitButton);

    // Error message should appear
    await waitFor(() => {
      const alert = canvas.getByRole('alert');
      expect(alert).toBeVisible();
      expect(
        canvas.getByText(/That recovery key did not unlock a vault/i),
      ).toBeInTheDocument();
    });
  },
};

export const DeviceHoldsNoVault: Story = {
  args: {
    onClaim: async () => 'no-match',
  },
  parameters: {
    docs: {
      description: {
        story:
          'The device holds no vault, so the submitted key cannot match anything. This story renders pixel-for-pixel identically to KeyMatchesNothing because the component intentionally cannot distinguish between "key was wrong" and "no vault exists here"—both answers are \'no-match\', producing the same message and UI state. This visual equivalence is the disclosure guarantee (ADR 0061): a user cannot infer vault presence from the component\'s response.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Click to expand the form
    const expandButton = canvas.getByRole('button', {
      name: /I have a recovery key/i,
    });
    await userEvent.click(expandButton);

    // Type a key (any key is wrong when no vault exists)
    const input = canvas.getByPlaceholderText('Paste your recovery key');
    await userEvent.type(input, 'any-recovery-key');

    // Submit the form
    const submitButton = canvas.getByRole('button', {
      name: 'Claim this vault',
    });
    await userEvent.click(submitButton);

    // Error message should appear—identical to KeyMatchesNothing
    await waitFor(() => {
      const alert = canvas.getByRole('alert');
      expect(alert).toBeVisible();
      expect(
        canvas.getByText(/That recovery key did not unlock a vault/i),
      ).toBeInTheDocument();
    });
  },
};

export const ClaimInFlight: Story = {
  args: {
    onClaim: async () =>
      new Promise(() => {
        // Never resolves
      }),
  },
  parameters: {
    docs: {
      description: {
        story:
          'The claim request is pending. The submit button is disabled to prevent accidental double-submission. The form remains open and the user can cancel at any time.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Click to expand the form
    const expandButton = canvas.getByRole('button', {
      name: /I have a recovery key/i,
    });
    await userEvent.click(expandButton);

    // Type a recovery key
    const input = canvas.getByPlaceholderText('Paste your recovery key');
    await userEvent.type(input, 'recovery-key');

    // Click submit (the onClaim promise never settles)
    const submitButton = canvas.getByRole('button', {
      name: 'Claim this vault',
    });
    await userEvent.click(submitButton);

    // Submit button should become disabled while the request is pending
    await waitFor(() => {
      const disabledButton = canvas.getByRole('button', {
        name: 'Claim this vault',
      });
      expect(disabledButton).toBeDisabled();
    });
  },
};
