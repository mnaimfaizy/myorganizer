import { PrismaClient } from '@backend/prisma-schema';
import { TodoRequestBody } from '../models/Todo';

export class TodoService {
  constructor(private prisma: PrismaClient) {}

  public getAllTodos = async () => {
    try {
      const todos = await this.prisma.todo.findMany();
      return todos;
    } catch (error) {
      throw new Error(`Failed to get todos: ${error.message}`);
    }
  };

  public createTodo = async (requestBody: TodoRequestBody) => {
    try {
      const todo = await this.prisma.todo.create({
        data: {
          todo: requestBody.todo,
        },
      });
      return todo;
    } catch (error) {
      throw new Error(`Failed to create todo: ${error.message}`);
    }
  };

  public deleteTodo = async (id: number) => {
    try {
      const todo = await this.prisma.todo.delete({
        where: {
          id,
        },
      });
      return todo;
    } catch (error) {
      throw new Error(`Failed to delete todo: ${error.message}`);
    }
  };
}

const todoService = new TodoService(new PrismaClient());
export default todoService;
