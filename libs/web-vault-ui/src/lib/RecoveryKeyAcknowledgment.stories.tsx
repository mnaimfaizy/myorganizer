'use client';

import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';

import { RecoveryKeyAcknowledgment } from './RecoveryKeyAcknowledgment';

/**
 * The acknowledgment screen shown immediately after a new Local Vault is created.
 * The User records their Recovery Key in a read-only display and confirms they
 * have saved it. The key is held in memory only and is never shown again after
 * this screen is dismissed.
 *
 * Recovery Keys are base64-encoded and can be long, so these stories include
 * a layout-stress case with an extended key to verify wrapping behavior.
 */
const meta: Meta<typeof RecoveryKeyAcknowledgment> = {
  component: RecoveryKeyAcknowledgment,
  title: 'Vault/RecoveryKeyAcknowledgment',
  tags: ['autodocs'],
  args: {
    onAcknowledge: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof RecoveryKeyAcknowledgment>;

/**
 * The default acknowledgment screen with a representative recovery key.
 * The user can download, copy, or confirm they have saved it. Once dismissed,
 * the key cannot be shown again.
 */
export const Default: Story = {
  args: {
    recoveryKey: 'EXAMPLE-RECOVERY-KEY-ABCDEF123456789GHIJKL987654321',
  },
};

/**
 * A recovery key at maximum typical length (base64-encoded, ~60+ characters).
 * This story verifies that the input wraps correctly without truncation and
 * that the layout remains stable and readable as the key text extends.
 */
export const LongKey: Story = {
  args: {
    recoveryKey:
      'aAbBcCdDeEfFgGhHiIjJkKlMmNnOoPpQqRrSsTtUuVvWwXxYyZz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  },
};
