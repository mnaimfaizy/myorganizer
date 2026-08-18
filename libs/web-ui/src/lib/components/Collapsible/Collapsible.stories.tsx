import type { Meta, StoryObj } from '@storybook/react';

import { Button } from '../Button/Button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from './Collapsible';

function CollapsibleExample() {
  return (
    <Collapsible className="w-[350px] space-y-2">
      <CollapsibleTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          Advanced filter options
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 rounded-md border p-4 text-sm">
        <p className="text-muted-foreground">
          Narrow tasks by due date, priority, or context before exporting your
          weekly summary.
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}

function CollapsibleOpenExample() {
  return (
    <Collapsible defaultOpen className="w-[350px] space-y-2">
      <CollapsibleTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          Advanced filter options
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 rounded-md border p-4 text-sm">
        <p className="text-muted-foreground">
          Narrow tasks by due date, priority, or context before exporting your
          weekly summary.
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}

function CollapsibleLongContentExample() {
  return (
    <Collapsible defaultOpen className="w-[350px] space-y-2">
      <CollapsibleTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          Workspace migration notes
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 rounded-md border p-4 text-sm">
        <p>
          Before importing archived projects, confirm that collaborator
          permissions, notification preferences, and linked calendar sync
          settings match your current workspace policy. Large imports may take
          several minutes and will temporarily disable inline editing for shared
          folders until indexing completes.
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}

const meta: Meta<typeof CollapsibleExample> = {
  component: CollapsibleExample,
  title: 'Components/Collapsible',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof CollapsibleExample>;

export const Default: Story = {};

export const Open: Story = {
  render: function Render() {
    return <CollapsibleOpenExample />;
  },
};

export const LongContent: Story = {
  render: function Render() {
    return <CollapsibleLongContentExample />;
  },
};
