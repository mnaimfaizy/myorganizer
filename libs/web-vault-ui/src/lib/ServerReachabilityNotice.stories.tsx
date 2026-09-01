'use client';

import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';

import { ServerReachabilityNotice } from './ServerReachabilityNotice';

const meta: Meta<typeof ServerReachabilityNotice> = {
  component: ServerReachabilityNotice,
  title: 'Vault/ServerReachabilityNotice',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ServerReachabilityNotice>;

/**
 * Server is reachable and there is nothing to warn about. Renders an empty
 * container with an empty screen-reader status region — an affirmative "server
 * reachable" would promise the next write will land, which no reading can
 * promise. A third device can write between the read and the push. The absence
 * of chrome is the correct design.
 */
export const Reachable: Story = {
  args: {
    reachability: 'reachable',
  },
};

/**
 * The server cannot be reached right now. The warning tells the user they can
 * still rotate now (the new key works immediately on this device), but other
 * devices will not receive the change until this device reconnects. The "Check
 * again" action lets them probe the network again without leaving the page.
 */
export const Unreachable: Story = {
  args: {
    reachability: 'unreachable',
    onRecheck: fn(),
  },
};

/**
 * The user's session has ended (logged out or session expired). The warning
 * tells them they can still rotate now, but other devices will not receive the
 * change until they sign in again. No "Check again" button appears: re-probing
 * cannot fix an ended session, and the repair (signing in) happens on another
 * screen. Including this story demonstrates that canRecheck is correctly
 * ignored even when onRecheck would be called.
 */
export const SignedOut: Story = {
  args: {
    reachability: 'signed-out',
    onRecheck: fn(),
  },
};

/**
 * No probe has resolved yet — loading state. Renders an empty container with
 * an empty screen-reader status region. No spinner, no "checking" message:
 * a spinner above a confirm button tells a user to wait, and waiting is
 * precisely what this component must never ask for. The absence of any chrome
 * is the correct design.
 */
export const Loading: Story = {
  args: {
    reachability: null,
  },
};

/**
 * The server cannot be reached, but no `onRecheck` callback has been supplied.
 * The warning appears, but the "Check again" button is correctly hidden even
 * though the component could normally show one. This confirms the action
 * visibility is controlled by both the reachability state (canRecheck) and the
 * presence of the callback.
 */
export const UnreachableWithoutRecheck: Story = {
  args: {
    reachability: 'unreachable',
    // onRecheck is deliberately omitted — no callback, no button
  },
};
