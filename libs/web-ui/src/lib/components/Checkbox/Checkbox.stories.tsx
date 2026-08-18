import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';

import { Label } from '../Label/Label';
import { Checkbox } from './Checkbox';

const meta: Meta<typeof Checkbox> = {
  component: Checkbox,
  title: 'Components/Checkbox',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Checkbox>;

export const Interactive: Story = {
  render: function Render() {
    const [checked, setChecked] = useState(false);
    return (
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => setChecked(value === true)}
        aria-label="Mark task complete"
      />
    );
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    'aria-label': 'Mark task complete',
  },
};

export const WithLabel: Story = {
  render: function Render() {
    const [checked, setChecked] = useState(false);
    return (
      <div className="flex items-center space-x-2">
        <Checkbox
          id="email-notifications"
          checked={checked}
          onCheckedChange={(value) => setChecked(value === true)}
        />
        <Label htmlFor="email-notifications">
          Email me when a shared task is updated
        </Label>
      </div>
    );
  },
};
