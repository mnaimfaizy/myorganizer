import { Body, Controller, Delete, Get, Path, Post, Route, Tags } from 'tsoa';
import { Todo, TodoRequestBody } from '../models/Todo';
import todoService from '../services/TodoService';

@Tags('Todo Management')
@Route('/todo')
export class TodoController extends Controller {
  @Get()
  public async getAllTodos(): Promise<Todo[]> {
    return todoService.getAllTodos();
  }

  @Post()
  public async createTodo(@Body() requestBody: TodoRequestBody): Promise<Todo> {
    const todo = await todoService.createTodo(requestBody);
    this.setStatus(201);
    return Promise.resolve(todo);
  }

  @Delete('{todoId}')
  public async deleteTodo(@Path() todoId: number): Promise<void> {
    await todoService.deleteTodo(todoId);
    this.setStatus(204);
    return Promise.resolve();
  }
}

const todoController = new TodoController();
export default todoController;
