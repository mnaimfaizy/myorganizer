export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'done' | 'cancelled' | 'blocked';
  priority: 'low' | 'medium' | 'high';
  context: 'personal' | 'work';
  dueDate?: string;
  estimatedMinutes?: number;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}
