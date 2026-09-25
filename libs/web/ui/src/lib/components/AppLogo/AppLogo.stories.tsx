import type { Meta, StoryObj } from '@storybook/react';
import { AppLogo } from './AppLogo';

const meta: Meta<typeof AppLogo> = {
  component: AppLogo,
  title: 'Components/AppLogo',
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['full', 'icon'],
      description: 'Full wordmark or shield icon only',
    },
    height: {
      control: 'number',
      description: 'Logo height in pixels',
    },
    'aria-hidden': {
      control: 'boolean',
      description: 'Hide the logo from assistive technology',
    },
  },
};

export default meta;
type Story = StoryObj<typeof AppLogo>;

export const Full: Story = {
  args: {
    variant: 'full',
    height: 32,
  },
};

export const Icon: Story = {
  args: {
    variant: 'icon',
    height: 32,
  },
};

export const Height16: Story = {
  args: {
    variant: 'full',
    height: 16,
  },
};

export const Height48: Story = {
  args: {
    variant: 'full',
    height: 48,
  },
};

export const Decorative: Story = {
  args: {
    variant: 'icon',
    height: 32,
    'aria-hidden': true,
  },
};
