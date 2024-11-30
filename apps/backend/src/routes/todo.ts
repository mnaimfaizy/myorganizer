import { Request, Response, Router } from 'express';
import todoController from '../controllers/TodoController';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const todos = await todoController.getAllTodos();
    res.status(200).json(todos);
  } catch (error) {
    res
      .status(500)
      .json({ message: `Failed to fetch todos: ${error.message}` });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const todo = await todoController.createTodo(req.body);
    res.status(201).json(todo);
  } catch (error) {
    res
      .status(500)
      .json({ message: `Failed to create todo: ${error.message}` });
  }
});

router.delete('/:todoId', async (req: Request, res: Response) => {
  try {
    await todoController.deleteTodo(parseInt(req.params.todoId));
    res.status(204).json({ message: 'Todo deleted successfully' });
  } catch (error) {
    res
      .status(500)
      .json({ message: `Failed to delete todo: ${error.message}` });
  }
});

export default router;
