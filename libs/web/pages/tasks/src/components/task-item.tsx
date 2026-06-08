'use client';

import { Task } from '@myorganizer/core';
import { TrashIcon } from 'lucide-react';
import { useCallback } from 'react';

interface TaskItemProps {
  task: Task;
  onDeleteTask: (id: string) => void;
}

const priorityStyles: Record<Task['priority'], string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-green-100 text-green-700',
};

const TaskItem = ({ task, onDeleteTask }: TaskItemProps) => {
  const handleDeleteTask = useCallback(() => {
    onDeleteTask(task.id);
  }, [task.id, onDeleteTask]);

  return (
    <div className="flex items-center justify-between gap-2 border border-gray-200 rounded-lg p-3 hover:bg-gray-200">
      <div className="flex-1">
        <h3 className="text-lg">{task.title}</h3>
        <div className="flex items-center gap-2 mt-2">
          <span
            className={`text-xs px-2 py-1 rounded ${priorityStyles[task.priority]}`}
          >
            {task.priority}
          </span>
          {task.dueDate && (
            <span className="text-xs text-gray-600">Due: {task.dueDate}</span>
          )}
        </div>
      </div>
      <div className="flex flex-row items-center justify-between gap-2">
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
