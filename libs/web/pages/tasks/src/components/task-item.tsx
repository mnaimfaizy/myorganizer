'use client';

import { Task, TaskStatus } from '@myorganizer/core';
import { ArchiveIcon, PencilIcon, TrashIcon } from 'lucide-react';
import { useCallback } from 'react';

interface TaskItemProps {
  task: Task;
  onDeleteTask: (id: string) => void;
  onEditTask: (id: string) => void;
  onArchiveTask: (id: string) => void;
}

const priorityStyles: Record<Task['priority'], string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-green-100 text-green-700',
};

const contextStyles: Record<string, string> = {
  personal: 'bg-blue-100 text-blue-700',
  work: 'bg-purple-100 text-purple-700',
};

const statusLabels: Record<TaskStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  done: 'Done',
  cancelled: 'Cancelled',
  blocked: 'Blocked',
};

const TaskItem = ({
  task,
  onDeleteTask,
  onEditTask,
  onArchiveTask,
}: TaskItemProps) => {
  const handleEditTask = useCallback(() => {
    onEditTask(task.id);
  }, [task.id, onEditTask]);

  const handleArchiveTask = useCallback(() => {
    onArchiveTask(task.id);
  }, [task.id, onArchiveTask]);

  const handleDeleteTask = useCallback(() => {
    onDeleteTask(task.id);
  }, [task.id, onDeleteTask]);

  const containerClasses = task.archived
    ? 'opacity-70 flex items-center justify-between gap-2 border border-gray-200 rounded-lg p-3 hover:bg-gray-200'
    : 'flex items-center justify-between gap-2 border border-gray-200 rounded-lg p-3 hover:bg-gray-200';

  return (
    <div className={containerClasses}>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-lg">{task.title}</h3>
          {task.archived && (
            <span className="text-xs px-2 py-1 rounded bg-gray-200 text-gray-600">
              Archived
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span
            className={`text-xs px-2 py-1 rounded ${priorityStyles[task.priority]}`}
          >
            {task.priority}
          </span>
          {task.context && (
            <span
              className={`text-xs px-2 py-1 rounded ${contextStyles[task.context] || 'bg-gray-100 text-gray-700'}`}
            >
              {task.context}
            </span>
          )}
          {task.status !== 'pending' && (
            <span className="text-xs text-gray-600">
              {statusLabels[task.status]}
            </span>
          )}
          {task.dueDate && (
            <span className="text-xs text-gray-600">Due: {task.dueDate}</span>
          )}
        </div>
      </div>
      <div className="flex flex-row items-center justify-between gap-2">
        <button
          aria-label="Edit task"
          className="cursor-pointer"
          onClick={handleEditTask}
        >
          <PencilIcon />
        </button>
        {!task.archived && (
          <button
            aria-label="Archive task"
            className="cursor-pointer"
            onClick={handleArchiveTask}
          >
            <ArchiveIcon />
          </button>
        )}
        <button
          aria-label="Delete task"
          className="cursor-pointer"
          onClick={handleDeleteTask}
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
};

export default TaskItem;
