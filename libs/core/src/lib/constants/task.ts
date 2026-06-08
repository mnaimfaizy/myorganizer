export type TaskPriority = 'high' | 'medium' | 'low';

export interface Task {
  id: string;
  title: string;
  priority: TaskPriority;
  dueDate?: string;
  createdAt: string;
}
