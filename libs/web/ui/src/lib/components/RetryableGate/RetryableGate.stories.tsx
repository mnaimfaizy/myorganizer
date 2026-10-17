import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from '@storybook/test';
import { RetryableGate, type GateDecision } from './RetryableGate';

const protectedContent = (
  <p className="p-6">Your tasks for today appear here.</p>
);

const meta: Meta<typeof RetryableGate> = {
  component: RetryableGate,
  title: 'Components/RetryableGate',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: [
          'Route-guard gate used by the dashboard and admin shells. It runs an',
          'async `check` and renders nothing while that check is pending.',
          '',
          '- `allow`: the children render.',
          '- `unavailable`: the server could not be reached, so the',
          '  ServerUnreachableNotice renders. It retries on "Try again" and',
          '  automatically on the browser `online`, window `focus`, and',
          '  `visibilitychange` events.',
          '- `redirect`: the gate calls `navigate(to)` and renders nothing.',
          '',
          'Accessibility: the unreachable state inherits `role="alert"` from',
          'ServerUnreachableNotice, so assistive technology announces it on mount.',
          '',
          'The pending and redirect states render nothing, so they have no story.',
          'Their absence is asserted in the component spec.',
        ].join('\n'),
      },
    },
  },
  argTypes: {
    check: {
      description:
        'Resolves to the gate decision. Re-run on Try again and on reconnect while unavailable.',
    },
    navigate: {
      description:
        'Performs navigation for a redirect decision. Callers pass router.replace.',
    },
  },
  args: {
    check: async (): Promise<GateDecision> => ({ kind: 'allow' }),
    navigate: fn(),
    children: protectedContent,
  },
};

export default meta;
type Story = StoryObj<typeof RetryableGate>;

export const Allowed: Story = {};

export const Unavailable: Story = {
  args: {
    check: async (): Promise<GateDecision> => ({ kind: 'unavailable' }),
  },
};

export const UnavailableThenRecovers: Story = {
  render: function Render(args) {
    // Fresh per mount: the first check fails, every later check allows.
    const attempts = React.useRef(0);
    const check = async (): Promise<GateDecision> => {
      attempts.current += 1;
      return attempts.current === 1
        ? { kind: 'unavailable' }
        : { kind: 'allow' };
    };
    return <RetryableGate {...args} check={check} />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Try again' }),
    );
    expect(
      await canvas.findByText('Your tasks for today appear here.'),
    ).toBeVisible();
    expect(
      canvas.queryByRole('button', { name: 'Try again' }),
    ).not.toBeInTheDocument();
  },
};
