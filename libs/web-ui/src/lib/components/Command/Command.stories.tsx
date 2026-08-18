import type { Meta, StoryObj } from '@storybook/react';

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './Command';

function CommandExample() {
  return (
    <Command className="rounded-lg border shadow-md">
      <CommandInput placeholder="Search tasks, folders, or people..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Tasks">
          <CommandItem>Review launch checklist</CommandItem>
          <CommandItem>Send stakeholder update</CommandItem>
          <CommandItem>Archive completed sprint board</CommandItem>
        </CommandGroup>
        <CommandGroup heading="Folders">
          <CommandItem>Marketing assets</CommandItem>
          <CommandItem>Client onboarding</CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

function CommandEmptyExample() {
  return (
    <Command className="rounded-lg border shadow-md">
      <CommandInput
        placeholder="Search tasks, folders, or people..."
        defaultValue="quarterly budget forecast"
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Tasks">
          <CommandItem>Review launch checklist</CommandItem>
          <CommandItem>Send stakeholder update</CommandItem>
          <CommandItem>Archive completed sprint board</CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

const meta: Meta<typeof CommandExample> = {
  component: CommandExample,
  title: 'Components/Command',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof CommandExample>;

export const Default: Story = {};

export const Empty: Story = {
  render: function Render() {
    return <CommandEmptyExample />;
  },
};
