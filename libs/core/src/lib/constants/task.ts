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
}
