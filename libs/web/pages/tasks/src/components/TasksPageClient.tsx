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

import TaskForm from './task-form';
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
      priority: TaskPriority;
      dueDate?: string;
    }) => {
      const newTask: Task = {
        id: randomId(),
        title: formData.title,
        priority: formData.priority,
        status: 'pending',
        archived: false,
        dueDate: formData.dueDate || undefined,
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

  const handleDeleteTask = useCallback(
    async (id: string) => {
      const next = tasks.filter((t) => t.id !== id);
      await persist(next);
      toast({
        title: 'Task deleted',
        description: 'Your task has been deleted.',
      });
    },
    [tasks, persist, toast],
  );

  return (
    <div className="flex sm:flex-row flex-col sm:justify-between gap-2 flex-1 p-2 pt-0">
      <div className="sm:w-1/2 w-full p-3 bg-slate-100 rounded-lg">
        <h2 className="text-center text-lg pt-3 font-semibold">Create task</h2>
        <div className="mt-8">
          <TaskForm onAddTask={handleAddTask} />
        </div>
      </div>

      <div className="sm:w-1/2 w-full rounded-lg border bg-white">
        <h2 className="text-center text-lg pt-3 font-semibold">Task List</h2>
        <div className="py-3 space-y-2 px-3">
          {tasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onDeleteTask={handleDeleteTask}
            />
          ))}
        </div>
      </div>
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
