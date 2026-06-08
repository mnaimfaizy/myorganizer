'use client';

import type { Task, TaskPriority } from '@myorganizer/core';
import { randomId } from '@myorganizer/core';
import { useToast } from '@myorganizer/web-ui';
import {
  loadDecryptedData,
  migrateFromTodos,
  normalizeTasks,
  saveEncryptedData,
} from '@myorganizer/web-vault';
import { VaultGate } from '@myorganizer/web-vault-ui';
import { useCallback, useEffect, useState } from 'react';

import { TaskDeleteDialog } from './task-delete-dialog';
import { TaskEditDialog } from './task-edit-dialog';
import { TaskForm } from './task-form';
import TaskItem from './task-item';

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (pa !== 0) return pa;
    const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    if (da !== db) return da - db;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

function TasksInner(props: { masterKeyBytes: Uint8Array }) {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [contextFilter, setContextFilter] = useState<
    'all' | 'personal' | 'work'
  >('all');

  useEffect(() => {
    loadDecryptedData<unknown>({
      masterKeyBytes: props.masterKeyBytes,
      type: 'tasks',
      defaultValue: null,
    })
      .then(async (raw) => {
        if (raw === null) {
          const todos = await loadDecryptedData<unknown>({
            masterKeyBytes: props.masterKeyBytes,
            type: 'todos',
            defaultValue: [],
          });

          if (Array.isArray(todos) && todos.length > 0) {
            const migrated = migrateFromTodos(todos);
            await saveEncryptedData({
              masterKeyBytes: props.masterKeyBytes,
              type: 'tasks',
              value: migrated,
            });
            setTasks(sortTasks(migrated));
          } else {
            setTasks([]);
          }
        } else {
          const normalized = normalizeTasks(raw);
          if (normalized.changed) {
            await saveEncryptedData({
              masterKeyBytes: props.masterKeyBytes,
              type: 'tasks',
              value: normalized.value,
            });
          }
          setTasks(sortTasks(normalized.value));
        }
      })
      .catch(() => {
        toast({
          title: 'Failed to load tasks',
          description: 'Could not decrypt saved data.',
          variant: 'destructive',
        });
      });
  }, [props.masterKeyBytes, toast]);

  const persist = useCallback(
    async (next: Task[]) => {
      const sorted = sortTasks(next);
      setTasks(sorted);
      try {
        await saveEncryptedData({
          masterKeyBytes: props.masterKeyBytes,
          type: 'tasks',
          value: sorted,
        });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        toast({
          title: 'Failed to save',
          description: message,
          variant: 'destructive',
        });
      }
    },
    [props.masterKeyBytes, toast],
  );

  const handleAddTask = useCallback(
    async (formData: {
      title: string;
      description?: string;
      priority: TaskPriority;
      status: Task['status'];
      context?: Task['context'];
      dueDate?: string;
    }) => {
      const newTask: Task = {
        id: randomId(),
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        status: formData.status,
        context: formData.context,
        dueDate: formData.dueDate,
        archived: false,
        createdAt: new Date().toISOString(),
      };
      await persist([newTask, ...tasks]);
      toast({
        title: 'Task created',
        description: 'Your task has been saved (encrypted).',
      });
    },
    [persist, tasks, toast],
  );

  const handleRequestDelete = useCallback(
    (id: string) => {
      const task = tasks.find((t) => t.id === id);
      if (task) setDeletingTask(task);
    },
    [tasks],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingTask) return;
    const next = tasks.filter((t) => t.id !== deletingTask.id);
    await persist(next);
    toast({
      title: 'Task deleted',
      description: 'Your task has been deleted.',
    });
    setDeletingTask(null);
  }, [deletingTask, tasks, persist, toast]);

  const handleRequestEdit = useCallback(
    (id: string) => {
      const task = tasks.find((t) => t.id === id);
      if (task) setEditingTask(task);
    },
    [tasks],
  );

  const handleSaveEdit = useCallback(
    async (
      taskId: string,
      values: {
        title: string;
        description?: string;
        priority: Task['priority'];
        status: Task['status'];
        context?: Task['context'];
        dueDate?: string;
      },
    ) => {
      const next = tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              ...values,
              updatedAt: new Date().toISOString(),
            }
          : t,
      );
      await persist(next);
      toast({
        title: 'Task updated',
        description: 'Changes saved (encrypted).',
      });
      setEditingTask(null);
    },
    [tasks, persist, toast],
  );

  const handleArchiveTask = useCallback(
    async (id: string) => {
      const next = tasks.map((t) =>
        t.id === id
          ? { ...t, archived: true, updatedAt: new Date().toISOString() }
          : t,
      );
      await persist(next);
      toast({
        title: 'Task archived',
        description: 'Task moved to archive.',
      });
    },
    [tasks, persist, toast],
  );

  const handleUnarchiveTask = useCallback(
    async (id: string) => {
      const next = tasks.map((t) =>
        t.id === id
          ? { ...t, archived: false, updatedAt: new Date().toISOString() }
          : t,
      );
      await persist(next);
      toast({
        title: 'Task restored',
        description: 'Task moved back to active.',
      });
    },
    [tasks, persist, toast],
  );

  const displayedTasks = tasks.filter((t) => {
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
