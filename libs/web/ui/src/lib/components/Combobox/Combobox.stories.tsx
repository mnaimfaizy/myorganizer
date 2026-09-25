import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from '@storybook/test';
import { useState } from 'react';

import { Combobox, type ComboboxOption } from './Combobox';

const taskContextOptions: ComboboxOption[] = [
  { value: 'work', label: 'Work' },
  { value: 'home', label: 'Home' },
  { value: 'errands', label: 'Errands' },
  { value: 'health', label: 'Health' },
  { value: 'learning', label: 'Learning' },
];

const meta: Meta<typeof Combobox> = {
  component: Combobox,
  title: 'Components/Combobox',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Combobox>;

export const Interactive: Story = {
  render: function Render() {
    const [value, setValue] = useState('');
    return (
      <Combobox
        value={value}
        onValueChange={setValue}
        options={taskContextOptions}
        placeholder="Select a context…"
        searchPlaceholder="Search contexts…"
      />
    );
  },
};

export const WithValue: Story = {
  render: function Render() {
    const [value, setValue] = useState('work');
    return (
      <Combobox
        value={value}
        onValueChange={setValue}
        options={taskContextOptions}
        placeholder="Select a context…"
        searchPlaceholder="Search contexts…"
      />
    );
  },
};

export const EmptyOptions: Story = {
  render: function Render() {
    const [value, setValue] = useState('');
    return (
      <Combobox
        value={value}
        onValueChange={setValue}
        options={[]}
        placeholder="No contexts available"
        emptyText="No contexts have been created yet."
      />
    );
  },
};

export const EmptySearchResult: Story = {
  render: function Render() {
    const [value, setValue] = useState('');
    return (
      <Combobox
        value={value}
        onValueChange={setValue}
        options={taskContextOptions}
        placeholder="Select a context…"
        searchPlaceholder="Search contexts…"
        emptyText="No matching contexts."
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('combobox'));
    await waitFor(() => {
      expect(
        within(document.body).getByPlaceholderText('Search contexts…'),
      ).toBeVisible();
    });
    await userEvent.type(
      within(document.body).getByPlaceholderText('Search contexts…'),
      'zzzz-no-match',
    );
    await waitFor(() => {
      expect(
        within(document.body).getByText('No matching contexts.'),
      ).toBeVisible();
    });
  },
};

export const Disabled: Story = {
  render: function Render() {
    const [value, setValue] = useState('home');
    return (
      <Combobox
        value={value}
        onValueChange={setValue}
        options={taskContextOptions}
        placeholder="Select a context…"
        disabled
      />
    );
  },
};

export const OpensOnClick: Story = {
  render: function Render() {
    const [value, setValue] = useState('');
    return (
      <Combobox
        value={value}
        onValueChange={setValue}
        options={taskContextOptions}
        placeholder="Select a context…"
        searchPlaceholder="Search contexts…"
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('combobox'));
    await waitFor(() => {
      expect(within(document.body).getByText('Work')).toBeVisible();
    });
  },
};
