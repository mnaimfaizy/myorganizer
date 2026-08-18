import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from '@storybook/test';
import { MoreVertical } from 'lucide-react';

import { Button } from '../Button/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './DropdownMenu';

function DropdownMenuExample() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Task actions</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel>Task options</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Mark complete</DropdownMenuItem>
        <DropdownMenuItem>Assign collaborator</DropdownMenuItem>
        <DropdownMenuItem>Move to folder</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DropdownMenuOpenExample() {
  return (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Task actions</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel>Task options</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Mark complete</DropdownMenuItem>
        <DropdownMenuItem>Assign collaborator</DropdownMenuItem>
        <DropdownMenuItem>Move to folder</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DropdownMenuWithDisabledItemExample() {
  return (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Task actions</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel>Task options</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Mark complete</DropdownMenuItem>
        <DropdownMenuItem disabled>Archive (locked)</DropdownMenuItem>
        <DropdownMenuItem>Move to folder</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DropdownMenuIconTriggerExample() {
  return (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Open task actions">
          <MoreVertical aria-hidden="true" className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <DropdownMenuLabel>Task options</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Mark complete</DropdownMenuItem>
        <DropdownMenuItem>Assign collaborator</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const meta: Meta<typeof DropdownMenuExample> = {
  component: DropdownMenuExample,
  title: 'Components/DropdownMenu',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof DropdownMenuExample>;

export const Default: Story = {};

export const Open: Story = {
  render: function Render() {
    return <DropdownMenuOpenExample />;
  },
};

export const WithDisabledItem: Story = {
  render: function Render() {
    return <DropdownMenuWithDisabledItemExample />;
  },
};

export const IconTrigger: Story = {
  render: function Render() {
    return <DropdownMenuIconTriggerExample />;
  },
};

export const OpensOnClick: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Task actions' }));
    await waitFor(() => {
      expect(within(document.body).getByText('Mark complete')).toBeVisible();
    });
  },
};
