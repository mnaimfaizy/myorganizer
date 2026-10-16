import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { ServerUnreachableNotice } from './ServerUnreachableNotice';

const meta: Meta<typeof ServerUnreachableNotice> = {
  component: ServerUnreachableNotice,
  title: 'Components/ServerUnreachableNotice',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: [
          'Full-viewport panel the dashboard and admin route guards show when the',
          'client holds a Restorable Session but the session refresh could not be',
          'completed (offline, server 5xx, 408, or 429).',
          '',
          'It deliberately offers no sign-in prompt: the session is kept on this',
          'device, so the only actions are "Try again" and the automatic retry the',
          'guard runs in the background.',
          '',
          'Accessibility: the wrapper has `role="alert"`, so assistive technology',
          'announces the title and description when the panel mounts. While a retry',
          'is in flight (`retrying`), the button is disabled and marked `aria-busy`.',
        ].join('\n'),
      },
    },
  },
  argTypes: {
    onRetry: {
      description: 'Called when the User asks to try the connection again',
    },
    retrying: {
      control: 'boolean',
      description:
        'True while a retry is in flight: the button is disabled and marked busy',
    },
    className: {
      control: 'text',
      description:
        'Additional CSS classes merged onto the full-viewport wrapper',
    },
  },
  args: {
    onRetry: fn(),
    retrying: false,
  },
};

export default meta;
type Story = StoryObj<typeof ServerUnreachableNotice>;

export const Default: Story = {};

export const Retrying: Story = {
  args: {
    retrying: true,
  },
};
