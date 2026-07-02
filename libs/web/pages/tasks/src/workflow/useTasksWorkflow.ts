'use client';

import type { Task } from '@myorganizer/core';
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
  masterKeyBytes: Uint8Array;
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
  masterKeyBytes,
  adapter,
}: UseTasksWorkflowOptions): UseTasksWorkflowResult {
  const vaultAdapter = useMemo(
    () => adapter ?? createProductionTasksVaultAdapter(masterKeyBytes),
    [adapter, masterKeyBytes],
  );

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<TaskWorkflowError | null>(null);

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
  }, [vaultAdapter]);

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
