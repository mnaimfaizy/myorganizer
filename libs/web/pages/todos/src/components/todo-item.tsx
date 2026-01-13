'use client';

import { Todo } from '@myorganizer/core';
import { useToast } from '@myorganizer/web-ui';
import { TrashIcon } from 'lucide-react';

interface TodoItemProps {
  todo: Todo;
  onDeleteTodo: (todoID: string) => void;
}

const TodoItem = ({ todo, onDeleteTodo }: TodoItemProps) => {
  const { toast } = useToast();

  const handleDeleteTodo = (id: string) => {
    onDeleteTodo(id);
    toast({
      title: 'Todo deleted',
      description: 'Your todo has been deleted',
    });
  };

  return (
    <div className="flex items-center justify-between gap-2 border border-gray-200 rounded-lg p-3 hover:bg-gray-200">
      <h3 className="text-lg">{todo.todo}</h3>
      <div className="flex flex-row items-center justify-between gap-2">
        <TrashIcon
          className="cursor-pointer"
          onClick={() => handleDeleteTodo(todo.id)}
        />
      </div>
    </div>
  );
};

export default TodoItem;
