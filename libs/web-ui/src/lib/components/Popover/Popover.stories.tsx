import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from '@storybook/test';

import { Button } from '../Button/Button';
import { Popover, PopoverContent, PopoverTrigger } from './Popover';

function PopoverExample() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Filter tasks</Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-2">
          <h4 className="font-medium leading-none">Quick filters</h4>
          <p className="text-sm text-muted-foreground">
            Show tasks due this week, overdue items, or those waiting on a
            collaborator response.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PopoverOpenExample() {
  return (
    <Popover defaultOpen>
      <PopoverTrigger asChild>
        <Button variant="outline">Filter tasks</Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-2">
          <h4 className="font-medium leading-none">Quick filters</h4>
          <p className="text-sm text-muted-foreground">
            Show tasks due this week, overdue items, or those waiting on a
            collaborator response.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PopoverLongContentExample() {
  return (
    <Popover defaultOpen>
      <PopoverTrigger asChild>
        <Button variant="outline">Export summary</Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-2">
          <h4 className="font-medium leading-none">Export weekly summary</h4>
          <p className="text-sm text-muted-foreground">
            Include completed tasks, overdue reminders, and shared-folder
            activity from the last seven days. Large workspaces may take longer
            to compile and will email you when the export is ready to download.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const meta: Meta<typeof PopoverExample> = {
  component: PopoverExample,
  title: 'Components/Popover',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof PopoverExample>;

export const Default: Story = {};

export const Open: Story = {
  render: function Render() {
    return <PopoverOpenExample />;
  },
};

export const LongContent: Story = {
  render: function Render() {
    return <PopoverLongContentExample />;
  },
};

export const OpensOnClick: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Filter tasks' }));
    await waitFor(() => {
      expect(within(document.body).getByText('Quick filters')).toBeVisible();
    });
  },
};
