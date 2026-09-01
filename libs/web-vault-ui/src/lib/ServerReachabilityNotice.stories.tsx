'use client';

import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';

import { ServerReachabilityNotice } from './ServerReachabilityNotice';

/**
 * There is deliberately no story for `reachability: 'reachable'` or for
 * `null`, and the absence is worth one note because a reader would otherwise
 * add them back.
 *
 * Both render no visible output, so under STORYBOOK-PATTERNS §8 they get no
 * story: a blank canvas is indistinguishable from one that failed to load, and
 * two of them are indistinguishable from each other. The absence is asserted
 * in `ServerReachabilityNotice.spec.tsx`, where an assertion can name the DOM
 * it expects.
 *
 * The silence is the component's contract, not an oversight. An affirmative
 * "server reachable" would promise the next write will land, which no reading
 * can — a third device can write between the check and the push. `null` reads
 * the same as `reachable` on purpose: a "checking" spinner above a confirm
 * button tells a User to wait, and waiting is what this must never ask for.
 */
const meta: Meta<typeof ServerReachabilityNotice> = {
  component: ServerReachabilityNotice,
  title: 'Vault/ServerReachabilityNotice',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ServerReachabilityNotice>;

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
