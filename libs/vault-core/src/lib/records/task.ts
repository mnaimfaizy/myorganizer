import type { KnownKeys } from './unknownFields';

export type TaskStatus =
  | 'pending'
  | 'in_progress'
  | 'done'
  | 'cancelled'
  | 'blocked';

export type TaskPriority = 'high' | 'medium' | 'low';

export type TaskContext = 'personal' | 'work';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  context?: TaskContext;
  dueDate?: string;
  estimatedMinutes?: number;
  archived: boolean;
  createdAt: string;
  updatedAt?: string;
  /**
   * When this Task last entered `done` or `cancelled` — set and cleared by
   * `transitionTaskStatus`, never written directly. Absent on a Task that has
   * never been closed, and on one closed before this field existed.
   */
  closedAt?: string;
}

/**
 * Every Task key a reader understands, pinned to the type: a field added to
 * `Task` must be added here too. Keys not in this table are unknown fields,
 * which every writer carries through untouched (ADR 0114 decision 3).
 */
export const TASK_KEYS = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  context: true,
  dueDate: true,
  estimatedMinutes: true,
  archived: true,
  createdAt: true,
  updatedAt: true,
  closedAt: true,
} as const satisfies KnownKeys<Task>;
