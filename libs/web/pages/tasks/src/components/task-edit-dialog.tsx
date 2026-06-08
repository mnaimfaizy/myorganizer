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

interface TaskEditDialogProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    taskId: string,
    values: {
      title: string;
      description?: string;
      priority: Task['priority'];
      status: Task['status'];
      context?: Task['context'];
      dueDate?: string;
    },
  ) => Promise<void>;
}

export function TaskEditDialog({
  task,
  isOpen,
  onClose,
  onSave,
}: TaskEditDialogProps) {
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(
    async (values: {
      title: string;
      description?: string;
      priority: Task['priority'];
      status: Task['status'];
      context?: Task['context'];
      dueDate?: string;
    }) => {
      if (!task) return;
      setIsSaving(true);
      try {
        await onSave(task.id, values);
        onClose();
      } finally {
        setIsSaving(false);
      }
    },
    [task, onSave, onClose],
  );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        onClose();
      }
    },
    [onClose],
  );

  if (!task) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={!isSaving}>
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
          <DialogDescription>Update the task details below</DialogDescription>
        </DialogHeader>
        <TaskForm
          initialValues={{
            title: task.title,
            description: task.description,
            priority: task.priority,
            status: task.status,
            context: task.context,
            dueDate: task.dueDate,
          }}
          onSubmit={handleSave}
          submitLabel="Save Changes"
        />
      </DialogContent>
    </Dialog>
  );
}
