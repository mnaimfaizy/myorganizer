import { NextFunction, Router } from 'express';
import userController from '../controllers/UserController';
import passport from '../utils/passport';

const router = Router();

router.get(
  '/',
  passport.authenticate('jwt', { session: false }),
  async (req, res, next: NextFunction) => {
    try {
      const users = await userController.getAllUsers();
      res.status(200).json(users);
    } catch (error) {
      res
        .status(500)
        .json({ message: `Failed to fetch users: ${error.message}` });
      next(error);
    }
  }
);

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
