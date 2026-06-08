export type TaskStatus =
  | 'pending'
  | 'in_progress'
  | 'done'
  | 'cancelled'
  | 'blocked';

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  archived: boolean;
}
