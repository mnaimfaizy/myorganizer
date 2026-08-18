import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from '@storybook/test';
import { useState } from 'react';

import { DatePicker } from './DatePicker';

/** Pinned yyyy-MM-dd string — never use live dates in stories. */
const PINNED_DATE = '2024-06-15';

const meta: Meta<typeof DatePicker> = {
  component: DatePicker,
  title: 'Components/DatePicker',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof DatePicker>;

export const Interactive: Story = {
  render: function Render() {
    const [value, setValue] = useState('');
    return (
      <DatePicker
        value={value}
        onChange={setValue}
        placeholder="Pick a due date"
      />
    );
  },
};

export const WithValue: Story = {
  render: function Render() {
    const [value, setValue] = useState(PINNED_DATE);
    return <DatePicker value={value} onChange={setValue} />;
  },
};

export const Disabled: Story = {
  render: function Render() {
    const [value, setValue] = useState(PINNED_DATE);
    return <DatePicker value={value} onChange={setValue} disabled />;
  },
};

export const OpensOnClick: Story = {
  render: function Render() {
    const [value, setValue] = useState('');
    return (
      <DatePicker
        value={value}
        onChange={setValue}
        placeholder="Pick a due date"
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Pick a due date' }),
    );
    await waitFor(() => {
      expect(within(document.body).getByRole('grid')).toBeVisible();
    });
  },
};
