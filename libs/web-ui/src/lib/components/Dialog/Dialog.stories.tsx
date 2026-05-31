import type { Meta, StoryObj } from '@storybook/react';

import { Button } from '../Button/Button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './Dialog';

function DialogExample() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm action</DialogTitle>
          <DialogDescription>
            Review the details before confirming this action.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button>OK</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const meta: Meta<typeof DialogExample> = {
  component: DialogExample,
  title: 'Components/Dialog',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof DialogExample>;

export const Default: Story = {};
