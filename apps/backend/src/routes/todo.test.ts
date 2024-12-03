import bodyParser from 'body-parser';
import express from 'express';
import request from 'supertest';
import todoController from '../controllers/TodoController';
import todoRouter from './todo';

jest.mock('../controllers/TodoController');

const app = express();
app.use(bodyParser.json());
app.use('/todos', todoRouter);

describe('Todo Routes', () => {
  describe('GET /todos', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });
    test('should return all todos', async () => {
      const todos = [{ id: 1, title: 'Test Todo 1', completed: false }];
      (todoController.getAllTodos as jest.Mock).mockResolvedValue(todos);

      const response = await request(app).get('/todos');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(todos);
      expect(todoController.getAllTodos).toHaveBeenCalledTimes(1);
    });

    test('should handle errors', async () => {
      const errorMessage = 'Error fetching todos';
      (todoController.getAllTodos as jest.Mock).mockRejectedValue(
        new Error(errorMessage)
      );

      const response = await request(app).get('/todos');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        message: `Failed to fetch todos: ${errorMessage}`,
      });
      expect(todoController.getAllTodos).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /todos', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });
    test('should create a new todo', async () => {
      const newTodo = { id: 1, title: 'Test Todo', completed: false };
      (todoController.createTodo as jest.Mock).mockResolvedValue(newTodo);

      const response = await request(app)
        .post('/todos')
        .send({ title: 'Test Todo' });

      expect(response.status).toBe(201);
      expect(response.body).toEqual(newTodo);
      expect(todoController.createTodo).toHaveBeenCalledTimes(1);
      expect(todoController.createTodo).toHaveBeenCalledWith({
        title: 'Test Todo',
      });
    });

    test('should handle errors', async () => {
      const errorMessage = 'Error creating todo';
      (todoController.createTodo as jest.Mock).mockRejectedValue(
        new Error(errorMessage)
      );

      const response = await request(app)
        .post('/todos')
        .send({ title: 'Test Todo' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        message: `Failed to create todo: ${errorMessage}`,
      });
      expect(todoController.createTodo).toHaveBeenCalledTimes(1);
      expect(todoController.createTodo).toHaveBeenCalledWith({
        title: 'Test Todo',
      });
    });
  });

  describe('DELETE /todos/:todoId', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });
    test('should delete a todo by ID', async () => {
      (todoController.deleteTodo as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app).delete('/todos/1');

      expect(response.status).toBe(204);
      expect(response.body).toEqual({});
      expect(todoController.deleteTodo).toHaveBeenCalledTimes(1);
      expect(todoController.deleteTodo).toHaveBeenCalledWith(1);
    });

    test('should handle errors', async () => {
      const errorMessage = 'Error deleting todo';
      (todoController.deleteTodo as jest.Mock).mockRejectedValue(
        new Error(errorMessage)
      );

      const response = await request(app).delete('/todos/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        message: `Failed to delete todo: ${errorMessage}`,
      });
      expect(todoController.deleteTodo).toHaveBeenCalledTimes(1);
      expect(todoController.deleteTodo).toHaveBeenCalledWith(1);
    });
  });
});
