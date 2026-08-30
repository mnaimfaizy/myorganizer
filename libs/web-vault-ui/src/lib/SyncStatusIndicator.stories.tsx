'use client';

import type { Meta, StoryObj } from '@storybook/react';
import { VaultBlobType } from '@myorganizer/app-api-client';
import { VAULT_BLOB_TYPES } from '@myorganizer/web-vault';
import { fn } from '@storybook/test';

import { SyncStatusIndicator } from './SyncStatusIndicator';

// The individual `VaultBlobType.*` fixtures below are a few illustrative
// examples, not every member — reaching the Guarded Enum's pinned table here
// (ADR 0053) is what keeps that a reviewable choice rather than a silent
// partial enumeration.
void VAULT_BLOB_TYPES;

const meta: Meta<typeof SyncStatusIndicator> = {
  component: SyncStatusIndicator,
  title: 'Vault/SyncStatusIndicator',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof SyncStatusIndicator>;

/**
 * Annotates the two stories whose whole point is that nothing appears.
 *
 * `Synced` and `Loading` render byte-identical DOM — an empty flex container
 * holding an empty screen-reader paragraph — so on the canvas they are
 * indistinguishable both from each other and from a story that failed to
 * load. The note says which state you are looking at and why it is blank.
 *
 * Deliberately plain text above the component rather than a frame or border
 * around it: a box would read as chrome the component does not have, and this
 * component's entire contract here is that it adds none.
 *
 * Applied only to these two. The other stories render visible content, and
 * annotating those would put Storybook furniture next to output a reviewer is
 * meant to be judging on its own.
 */
const EmptyStateAnnotation = (message: string): Story['decorators'] => [
  (StoryComponent) => (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-gray-500 italic leading-relaxed">{message}</p>
      <StoryComponent />
    </div>
  ),
];

/**
 * Healthy synced state. Everything reached the server, so the indicator adds
 * nothing to the page: no label, no icon, no detail — and no screen-reader
 * announcement either, since the live region is left empty. Blank is the
 * assertion here, not a missing story.
 */
export const Synced: Story = {
  args: {
    status: {
      kind: 'synced',
      pendingTypes: [],
      terminalFailures: [],
      retrying: false,
    },
  },
  decorators: EmptyStateAnnotation(
    'Rendered, and deliberately empty. Everything reached the server, so the indicator adds no chrome — no label, no icon, and no screen-reader announcement: the live region is empty too. This state is final; nothing further appears.',
  ),
};

/**
 * No status computed yet — no Vault Session, or the first read still in
 * flight. Renders exactly what `Synced` renders, and for the opposite reason:
 * not "there is nothing to report" but "we do not know yet, so do not claim
 * success". The two are told apart by what happens next, never by their output.
 */
export const Loading: Story = {
  args: {
    status: null,
  },
  decorators: EmptyStateAnnotation(
    'Rendered, and deliberately empty — identical output to Synced, opposite meaning. No status has been computed yet, so claiming success would be a lie. Unlike Synced, this state resolves: a reading appears once one exists.',
  ),
};

/**
 * Changes are queued on the device but have not yet reached the server, and no
 * automatic retry is currently in progress. The label identifies unsent types.
 * The user can choose to manually retry, and the component will automatically
 * retry on its backoff schedule.
 */
export const PendingNotRetrying: Story = {
  args: {
    status: {
      kind: 'pending',
      pendingTypes: [VaultBlobType.Tasks],
      terminalFailures: [],
      retrying: false,
    },
  },
};

/**
 * Changes are queued on the device and the component is actively retrying to send
 * them. The detail text includes "Retrying automatically" to signal this is
 * transient — the user does not need to act. Multiple pending types are shown
 * to demonstrate that all affected data is named.
 */
export const PendingRetrying: Story = {
  args: {
    status: {
      kind: 'pending',
      pendingTypes: [VaultBlobType.Tasks, VaultBlobType.Addresses],
      terminalFailures: [],
      retrying: true,
    },
  },
};

/**
 * User session ended (401/403). Syncing has stopped and will not resume
 * automatically. The label and detail are specific to this state, signaling that
 * sign-in is required to resume. This is an error-tone reading requiring user action.
 */
export const SessionEnded: Story = {
  args: {
    status: {
      kind: 'session-ended',
      pendingTypes: [VaultBlobType.Tasks],
      terminalFailures: [],
      retrying: false,
    },
  },
};

/**
 * Terminal failure: the server rejected a specific data type with a 422 and will
 * not retry automatically. The failing type is named in the detail. This story
 * must be visibly and semantically **different** from the `PendingNotRetrying`
 * story to signal permanent failure vs. transient delay — a reviewer must be able
 * to see at a glance that "terminal" means "server said no, stop trying".
 */
export const TerminalSingleType: Story = {
  args: {
    status: {
      kind: 'terminal',
      pendingTypes: [],
      terminalFailures: [{ type: VaultBlobType.Groceries, status: 422 }],
      retrying: false,
    },
  },
};

/**
 * Terminal failure affecting multiple data types. Demonstrates that the component
 * names all affected data types in the detail, not just the first one, so a user
 * knows exactly which data was rejected.
 */
export const TerminalMultipleTypes: Story = {
  args: {
    status: {
      kind: 'terminal',
      pendingTypes: [],
      terminalFailures: [
        { type: VaultBlobType.Tasks, status: 422 },
        { type: VaultBlobType.Groceries, status: 422 },
      ],
      retrying: false,
    },
  },
};

/**
 * Pending state with retry callback provided. The "Retry now" button is visible
 * and wired to the `onRetry` callback, allowing manual retry. This story confirms
 * the button appears and is accessible to interaction.
 */
export const WithRetryAction: Story = {
  args: {
    status: {
      kind: 'pending',
      pendingTypes: [VaultBlobType.Tasks],
      terminalFailures: [],
      retrying: false,
    },
    onRetry: fn(),
  },
};

/**
 * Pending state without retry callback provided. The "Retry now" button is omitted
 * even though the component could normally show one, confirming that `onRetry` is
 * required to make the button visible. This supports use cases where manual retry
 * is not appropriate.
 */
export const WithoutRetryAction: Story = {
  args: {
    status: {
      kind: 'pending',
      pendingTypes: [VaultBlobType.Tasks],
      terminalFailures: [],
      retrying: false,
    },
    // onRetry is deliberately omitted — no callback, no button
  },
};
