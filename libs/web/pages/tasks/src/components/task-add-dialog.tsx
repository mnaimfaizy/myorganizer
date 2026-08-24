'use client';

import type { Task } from '@myorganizer/core';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@myorganizer/web-ui';
import { useCallback, useState } from 'react';
import { TaskForm } from './task-form';

interface TaskAddDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: {
    title: string;
    description?: string;
    priority: Task['priority'];
    status: Task['status'];
    context?: Task['context'];
    dueDate?: string;
  }) => Promise<void>;
}

export function TaskAddDialog({
  isOpen,
  onClose,
  onSubmit,
}: TaskAddDialogProps) {
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = useCallback(
    async (values: {
      title: string;
      description?: string;
      priority: Task['priority'];
      status: Task['status'];
      context?: Task['context'];
      dueDate?: string;
    }) => {
      setIsSaving(true);
      try {
        await onSubmit(values);
        onClose();
      } catch {
        // onSubmit rejection means save failed; dialog stays open for retry
      } finally {
        setIsSaving(false);
      }
    },
    [onSubmit, onClose],
  );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        onClose();
      }
    },
    [onClose],
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={!isSaving}>
        <DialogHeader>
          <DialogTitle>Add Task</DialogTitle>
          <DialogDescription>Create a new task</DialogDescription>
        </DialogHeader>
        <TaskForm onSubmit={handleSubmit} submitLabel="Add Task" />
      </DialogContent>
    </Dialog>
  );
}
