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
