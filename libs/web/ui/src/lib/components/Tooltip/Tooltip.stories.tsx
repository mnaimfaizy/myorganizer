import type { Meta, StoryObj } from '@storybook/react';
import { Info } from 'lucide-react';

import { Button } from '../Button/Button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './Tooltip';

function TooltipExample() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline">Due date</Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Tasks without a due date stay in your inbox until scheduled.</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function TooltipOpenExample() {
  return (
    <TooltipProvider>
      <Tooltip defaultOpen>
        <TooltipTrigger asChild>
          <Button variant="outline">Due date</Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Tasks without a due date stay in your inbox until scheduled.</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function TooltipIconExample() {
  return (
    <TooltipProvider>
      <Tooltip defaultOpen>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="About task contexts">
            <Info aria-hidden="true" className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Contexts group related tasks across projects and grocery lists.</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const meta: Meta<typeof TooltipExample> = {
  component: TooltipExample,
  title: 'Components/Tooltip',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof TooltipExample>;

export const Default: Story = {};

export const Open: Story = {
  render: function Render() {
    return <TooltipOpenExample />;
  },
};

export const IconTrigger: Story = {
  render: function Render() {
    return <TooltipIconExample />;
  },
};
