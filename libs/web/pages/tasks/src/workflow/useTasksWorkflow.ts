'use client';

import type { Task } from '@myorganizer/core';
import type { VaultHandle } from '@myorganizer/web-vault';
import { useLocalVaultRevision } from '@myorganizer/web-vault-ui';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  addTaskToWorkflow,
  archiveTaskInWorkflow,
  deleteTaskFromWorkflow,
  loadTasksFromVault,
  unarchiveTaskInWorkflow,
  updateTaskInWorkflow,
} from './task-workflow';
import type {
  TaskFormInput,
  TaskUpdateInput,
  TaskWorkflowError,
  TaskWorkflowMutationResult,
} from './task-workflow-types';
import {
  createProductionTasksVaultAdapter,
  type TasksVaultAdapter,
} from './tasks-vault-adapter';

export interface UseTasksWorkflowOptions {
  handle: VaultHandle;
  adapter?: TasksVaultAdapter;
}

export interface UseTasksWorkflowResult {
  tasks: Task[];
  loading: boolean;
  loadError: TaskWorkflowError | null;
  addTask: (formData: TaskFormInput) => Promise<TaskWorkflowMutationResult>;
  updateTask: (
    taskId: string,
    values: TaskUpdateInput,
  ) => Promise<TaskWorkflowMutationResult>;
  deleteTask: (taskId: string) => Promise<TaskWorkflowMutationResult>;
  archiveTask: (taskId: string) => Promise<TaskWorkflowMutationResult>;
  unarchiveTask: (taskId: string) => Promise<TaskWorkflowMutationResult>;
}

export function useTasksWorkflow({
  handle,
  adapter,
}: UseTasksWorkflowOptions): UseTasksWorkflowResult {
  const vaultAdapter = useMemo(
    () => adapter ?? createProductionTasksVaultAdapter(handle),
    [adapter, handle],
  );

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<TaskWorkflowError | null>(null);

  // Convergence replaces the Local Vault without passing through this hook, so
  // the revision is the only thing that says the Ciphertext behind `tasks`
  // moved. Reloading matters more for the write path than the read one: every
  // mutation below saves the whole array, so a stale `tasks` does not just
  // render out of date — it is what gets written back over the record that
  // arrived (#587).
  const revision = useLocalVaultRevision();

  useEffect(() => {
    let cancelled = false;

    loadTasksFromVault(vaultAdapter).then(
      ({ tasks: loaded, loadError: error }) => {
        if (cancelled) return;
        setTasks(loaded);
        setLoadError(error);
        setLoading(false);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [vaultAdapter, revision]);

  const addTask = useCallback(
    async (formData: TaskFormInput) => {
      const { tasks: next, result } = await addTaskToWorkflow(
        vaultAdapter,
        tasks,
        formData,
      );
      setTasks(next);
      return result;
    },
    [tasks, vaultAdapter],
  );

  const updateTask = useCallback(
    async (taskId: string, values: TaskUpdateInput) => {
      const { tasks: next, result } = await updateTaskInWorkflow(
        vaultAdapter,
        tasks,
        taskId,
        values,
      );
      setTasks(next);
      return result;
    },
    [tasks, vaultAdapter],
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      const { tasks: next, result } = await deleteTaskFromWorkflow(
        vaultAdapter,
        tasks,
        taskId,
      );
      setTasks(next);
      return result;
    },
    [tasks, vaultAdapter],
  );

  const archiveTask = useCallback(
    async (taskId: string) => {
      const { tasks: next, result } = await archiveTaskInWorkflow(
        vaultAdapter,
        tasks,
        taskId,
      );
      setTasks(next);
      return result;
    },
    [tasks, vaultAdapter],
  );

  const unarchiveTask = useCallback(
    async (taskId: string) => {
      const { tasks: next, result } = await unarchiveTaskInWorkflow(
        vaultAdapter,
        tasks,
        taskId,
      );
      setTasks(next);
      return result;
    },
    [tasks, vaultAdapter],
  );

  return {
    tasks,
    loading,
    loadError,
    addTask,
    updateTask,
    deleteTask,
    archiveTask,
    unarchiveTask,
  };
}
