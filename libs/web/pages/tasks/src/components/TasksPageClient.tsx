'use client';

import type { Task } from '@myorganizer/core';
import { useToast } from '@myorganizer/web-ui';
import { VaultGate } from '@myorganizer/web-vault-ui';
import { useCallback, useEffect, useState } from 'react';

import { useTasksWorkflow } from '../workflow';
import { TaskDeleteDialog } from './task-delete-dialog';
import { TaskEditDialog } from './task-edit-dialog';
import { TaskForm } from './task-form';
import TaskItem from './task-item';

interface TasksInnerProps {
  masterKeyBytes: Uint8Array;
}

function TasksInner({ masterKeyBytes }: TasksInnerProps) {
  const { toast } = useToast();
  const workflow = useTasksWorkflow({ masterKeyBytes });
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [contextFilter, setContextFilter] = useState<
    'all' | 'personal' | 'work'
  >('all');

  useEffect(() => {
    if (workflow.loadError) {
      toast({
        title: 'Failed to load tasks',
        description: 'Could not decrypt saved data.',
        variant: 'destructive',
      });
    }
  }, [workflow.loadError, toast]);

  const handleAddTask = useCallback(
    async (formData: Parameters<typeof workflow.addTask>[0]) => {
      const result = await workflow.addTask(formData);
      if (result.ok && result.kind === 'created') {
        toast({
          title: 'Task created',
          description: 'Your task has been saved (encrypted).',
        });
      } else if (!result.ok && result.error.code === 'save_failed') {
        toast({
          title: 'Failed to save',
          description: result.error.message,
          variant: 'destructive',
        });
      }
    },
    [workflow, toast],
  );

  const handleRequestDelete = useCallback(
    (id: string) => {
      const task = workflow.tasks.find((t) => t.id === id);
      if (task) setDeletingTask(task);
    },
    [workflow.tasks],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingTask) return;
    const result = await workflow.deleteTask(deletingTask.id);
    if (result.ok && result.kind === 'deleted') {
      toast({
        title: 'Task deleted',
        description: 'Your task has been deleted.',
      });
    } else if (!result.ok && result.error.code === 'save_failed') {
      toast({
        title: 'Failed to save',
        description: result.error.message,
        variant: 'destructive',
      });
    }
    setDeletingTask(null);
  }, [deletingTask, workflow, toast]);

  const handleRequestEdit = useCallback(
    (id: string) => {
      const task = workflow.tasks.find((t) => t.id === id);
      if (task) setEditingTask(task);
    },
    [workflow.tasks],
  );

  const handleSaveEdit = useCallback(
    async (
      taskId: string,
      values: Parameters<typeof workflow.updateTask>[1],
    ) => {
      const result = await workflow.updateTask(taskId, values);
      if (result.ok && result.kind === 'updated') {
        toast({
          title: 'Task updated',
          description: 'Changes saved (encrypted).',
        });
      } else if (!result.ok && result.error.code === 'save_failed') {
        toast({
          title: 'Failed to save',
          description: result.error.message,
          variant: 'destructive',
        });
      }
      setEditingTask(null);
    },
    [workflow, toast],
  );

  const handleArchiveTask = useCallback(
    async (id: string) => {
      const result = await workflow.archiveTask(id);
      if (result.ok && result.kind === 'archived') {
        toast({
          title: 'Task archived',
          description: 'Task moved to archive.',
        });
      } else if (!result.ok && result.error.code === 'save_failed') {
        toast({
          title: 'Failed to save',
          description: result.error.message,
          variant: 'destructive',
        });
      }
    },
    [workflow, toast],
  );

  const handleUnarchiveTask = useCallback(
    async (id: string) => {
      const result = await workflow.unarchiveTask(id);
      if (result.ok && result.kind === 'unarchived') {
        toast({
          title: 'Task restored',
          description: 'Task moved back to active.',
        });
      } else if (!result.ok && result.error.code === 'save_failed') {
        toast({
          title: 'Failed to save',
          description: result.error.message,
          variant: 'destructive',
        });
      }
    },
    [workflow, toast],
  );

  const displayedTasks = workflow.tasks.filter((t) => {
    if (!showArchived && t.archived) return false;
    if (contextFilter !== 'all' && t.context !== contextFilter) return false;
    return true;
  });

  return (
    <div className="flex sm:flex-row flex-col sm:justify-between gap-2 flex-1 p-2 pt-0">
      <div className="sm:w-1/2 w-full p-3 bg-slate-100 rounded-lg">
        <h2 className="text-center text-lg pt-3 font-semibold">Create task</h2>
        <div className="mt-8">
          <TaskForm onSubmit={handleAddTask} />
        </div>
      </div>

      <div className="sm:w-1/2 w-full rounded-lg border bg-white">
        <div className="flex items-center justify-between px-3 pt-3">
          <h2 className="text-lg font-semibold">Task List</h2>
          <div className="flex items-center gap-2">
            {(['all', 'personal', 'work'] as const).map((ctx) => (
              <button
                key={ctx}
                onClick={() => setContextFilter(ctx)}
                className={`text-xs px-2 py-1 rounded border ${
                  contextFilter === ctx
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-white text-slate-700 border-slate-300'
                }`}
              >
                {ctx === 'all'
                  ? 'All'
                  : ctx.charAt(0).toUpperCase() + ctx.slice(1)}
              </button>
            ))}
            <button
              onClick={() => setShowArchived((v) => !v)}
              className={`text-xs px-2 py-1 rounded border ${
                showArchived
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-700 border-slate-300'
              }`}
            >
              {showArchived ? 'Hide Archived' : 'Show Archived'}
            </button>
          </div>
        </div>
        <div className="py-3 space-y-2 px-3">
          {displayedTasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onDeleteTask={handleRequestDelete}
              onEditTask={handleRequestEdit}
              onArchiveTask={handleArchiveTask}
              onUnarchiveTask={handleUnarchiveTask}
            />
          ))}
        </div>
      </div>

      <TaskEditDialog
        task={editingTask}
        isOpen={editingTask !== null}
        onClose={() => setEditingTask(null)}
        onSave={handleSaveEdit}
      />
      <TaskDeleteDialog
        task={deletingTask}
        isOpen={deletingTask !== null}
        onClose={() => setDeletingTask(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

export function TasksPageClient() {
  return (
    <VaultGate title="Tasks">
      {({ masterKeyBytes }) => <TasksInner masterKeyBytes={masterKeyBytes} />}
    </VaultGate>
  );
}
