import { Request, Response} from 'express';
import { PrismaClient } from '@backend/prisma-schema';

class TodoController {

    constructor(private prisma: PrismaClient) {}

    public getAllTodos = async (req: Request, res: Response) => {
        // #swagger.tags = ['Todos Management']
        try {
            const todos = await this.prisma.todo.findMany();
            res.send(todos);
        } catch (error) {
            res.status(500).send({ error: `Failed to get todos: ${error.message}` });
        }
    }

    public createTodo = async (req: Request, res: Response) => {
        // #swagger.tags = ['Todos Management']
        try {
            const { todo } = req.body ?? {};
            const newTodo = await this.prisma.todo.create({
                data: {
                    todo: todo
                }
            });
            res.send(newTodo);
        } catch (error) {
            res.status(500).send({ error: `Failed to create todo: ${error.message}` });
        }
    }

    public deleteTodo = async (req: Request, res: Response) => {
        // #swagger.tags = ['Todos Management']
        try {
            const { id } = req.params;
            await this.prisma.todo.delete({
                where: {
                    id: parseInt(id)
                }
            });
            res.send({ message: 'Todo deleted successfully' });
        } catch (error) {
            res.status(500).send({ error: `Failed to delete todo: ${error.message}` });
        }
    }

}

const todoController = new TodoController(new PrismaClient());
export default todoController;