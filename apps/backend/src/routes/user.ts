import { Router } from 'express';
import { Route } from 'tsoa';
import userController from '../controllers/UserController';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const users = await userController.getAllUsers();
    res.status(200).json(users);
  } catch (error) {
    res
      .status(500)
      .json({ message: `Failed to fetch users: ${error.message}` });
  }
});

router.get('/:userId', async (req, res) => {
  try {
    const user = await userController.getUserById(req.params.userId);
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: `Failed to fetch user: ${error.message}` });
  }
});

router.post('/', async (req, res) => {
  try {
    const user = await userController.createUser(req.body);
    res.status(201).json(user);
  } catch (error) {
    res
      .status(500)
      .json({ message: `Failed to create user: ${error.message}` });
  }
});

export default router;
