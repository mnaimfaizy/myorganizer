import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from '@storybook/test';

import { Button } from '../Button/Button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './Sheet';

function SheetExample() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Edit task details</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit task</SheetTitle>
          <SheetDescription>
            Update the title, due date, and assignee for this task.
          </SheetDescription>
        </SheetHeader>
        <div className="py-4 text-sm text-muted-foreground">
          Changes are saved to your workspace immediately.
        </div>
        <SheetFooter>
          <SheetClose asChild>
            <Button variant="outline">Cancel</Button>
          </SheetClose>
          <Button>Save changes</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function SheetOpenExample() {
  return (
    <Sheet defaultOpen>
      <SheetTrigger asChild>
        <Button variant="outline">Edit task details</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit task</SheetTitle>
          <SheetDescription>
            Update the title, due date, and assignee for this task.
          </SheetDescription>
        </SheetHeader>
        <div className="py-4 text-sm text-muted-foreground">
          Changes are saved to your workspace immediately.
        </div>
        <SheetFooter>
          <SheetClose asChild>
            <Button variant="outline">Cancel</Button>
          </SheetClose>
          <Button>Save changes</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function SheetOpenLeftExample() {
  return (
    <Sheet defaultOpen>
      <SheetTrigger asChild>
        <Button variant="outline">Browse folders</Button>
      </SheetTrigger>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>Folder navigation</SheetTitle>
          <SheetDescription>
            Jump between shared folders and personal task lists.
          </SheetDescription>
        </SheetHeader>
        <div className="py-4 text-sm text-muted-foreground">
          Marketing assets, Client onboarding, Sprint archive
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SheetLongContentExample() {
  return (
    <Sheet defaultOpen>
      <SheetTrigger asChild>
        <Button variant="outline">Review export details</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>
            Export archived workspace projects and shared folders
          </SheetTitle>
          <SheetDescription>
            This export includes task titles, due dates, collaborator lists,
            folder permissions, and notification settings tied to archived
            projects. Large workspaces may take several minutes to compile.
          </SheetDescription>
        </SheetHeader>
        <div className="py-4 text-sm text-muted-foreground">
          You will receive an email when the archive is ready to download. The
          link expires after seven days. Contact support if you need extended
          retention or a partial export of specific folders only.
        </div>
        <SheetFooter>
          <SheetClose asChild>
            <Button variant="outline">Cancel</Button>
          </SheetClose>
          <Button>Start export</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

const meta: Meta<typeof SheetExample> = {
  component: SheetExample,
  title: 'Components/Sheet',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof SheetExample>;

export const Default: Story = {};

export const Open: Story = {
  render: function Render() {
    return <SheetOpenExample />;
  },
};

export const OpenLeft: Story = {
  render: function Render() {
    return <SheetOpenLeftExample />;
  },
};

export const LongContent: Story = {
  render: function Render() {
    return <SheetLongContentExample />;
  },
};

export const OpensOnClick: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Edit task details' }),
    );
    await waitFor(() => {
      expect(within(document.body).getByRole('dialog')).toBeVisible();
    });
  },
};
