import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from '@storybook/test';
import { useState } from 'react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './Select';

function SelectExample() {
  return (
    <Select defaultValue="in-progress">
      <SelectTrigger className="w-[240px]">
        <SelectValue placeholder="Select status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todo">To do</SelectItem>
        <SelectItem value="in-progress">In progress</SelectItem>
        <SelectItem value="done">Done</SelectItem>
      </SelectContent>
    </Select>
  );
}

function SelectOpenExample() {
  return (
    <Select defaultOpen defaultValue="in-progress">
      <SelectTrigger className="w-[240px]">
        <SelectValue placeholder="Select status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todo">To do</SelectItem>
        <SelectItem value="in-progress">In progress</SelectItem>
        <SelectItem value="done">Done</SelectItem>
      </SelectContent>
    </Select>
  );
}

function SelectDisabledExample() {
  return (
    <Select defaultValue="in-progress" disabled>
      <SelectTrigger className="w-[240px]">
        <SelectValue placeholder="Select status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todo">To do</SelectItem>
        <SelectItem value="in-progress">In progress</SelectItem>
        <SelectItem value="done">Done</SelectItem>
      </SelectContent>
    </Select>
  );
}

const meta: Meta<typeof SelectExample> = {
  component: SelectExample,
  title: 'Components/Select',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof SelectExample>;

export const Default: Story = {};

export const Open: Story = {
  render: function Render() {
    return <SelectOpenExample />;
  },
};

export const Disabled: Story = {
  render: function Render() {
    return <SelectDisabledExample />;
  },
};

export const Interactive: Story = {
  render: function Render() {
    const [value, setValue] = useState('in-progress');

    return (
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger className="w-[240px]">
          <SelectValue placeholder="Select status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todo">To do</SelectItem>
          <SelectItem value="in-progress">In progress</SelectItem>
          <SelectItem value="done">Done</SelectItem>
        </SelectContent>
      </Select>
    );
  },
};

export const OpensOnClick: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('combobox'));
    await waitFor(() => {
      expect(within(document.body).getByText('To do')).toBeVisible();
    });
  },
};
