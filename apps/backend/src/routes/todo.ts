import { PrismaClient } from '@backend/prisma-schema';
import { Router } from 'express';
import todoController from '../controllers/TodoController';

const prisma = new PrismaClient();
const router = Router();

/**
 * @swagger
 * /todos:
 *   get:
 *     summary: Retrieve a list of todos
 *     responses:
 *       200:
 *         description: A list of todos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   todo:
 *                     type: string
 */
router.get('/', todoController.getAllTodos);

/**
 * @swagger
 * /todos:
 *   post:
 *     summary: Create a new todo
 *     responses:
 *       200:
 *         description: The created todo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 todo:
 *                  type: string
 */
router.post('/', todoController.createTodo);

/**
 * @swagger
 * /todos/{id}:
 *   delete:
 *     summary: Delete a todo
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: The deleted todo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 * */
router.delete('/:id', todoController.deleteTodo);

export default router;