import { describe, expect, jest, test } from '@jest/globals';
import { Todo } from '../models/Todo';
import todoService from '../services/TodoService';
import { TodoController } from './TodoController';

jest.mock('../services/TodoService');

describe('Todo Controller', () => {
  let todoController: TodoController;

  beforeEach(() => {
    todoController = new TodoController();
    jest.clearAllMocks();
  });

  describe('getAllTodos', () => {
    test('should return all todos', async () => {
      const todos: Todo[] = [
        { id: 1, todo: 'Test Todo 1', createdAt: new Date() },
        { id: 2, todo: 'Test Todo 2', createdAt: new Date() },
      ];
      (todoService.getAllTodos as jest.Mock).mockReturnValueOnce(todos);

      const result = await todoController.getAllTodos();

      expect(result).toEqual(todos);
      expect(todoService.getAllTodos).toHaveBeenCalledTimes(1);
    });

    test('should handle errors', async () => {
      const errorMessage = 'Error fetching todos';
      (todoService.getAllTodos as jest.Mock).mockRejectedValue(
        new Error(errorMessage) as never
      );

      await expect(todoController.getAllTodos()).rejects.toThrow(errorMessage);
      expect(todoService.getAllTodos).toHaveBeenCalledTimes(1);
    });
  });
});
