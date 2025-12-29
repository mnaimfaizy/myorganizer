import bodyParser from 'body-parser';
import express from 'express';
import request from 'supertest';
import userController from '../controllers/UserController';
import userRouter from './user';

jest.mock('../utils/passport', () => ({
  __esModule: true,
  default: {
    authenticate: () => (req: any, _res: any, next: any) => {
      req.user = { id: 'test-user' };
      next();
    },
  },
}));

jest.mock('../controllers/UserController');

beforeEach(() => {
  jest.clearAllMocks();
});

const app = express();
app.use(bodyParser.json());
app.use('/users', userRouter);

describe('User Routes', () => {
  describe('GET /users', () => {
    test('should return all users', async () => {
      const users = [{ id: 1, name: 'John Doe' }];
      (userController.getAllUsers as jest.Mock).mockResolvedValue(users);

      const response = await request(app).get('/users');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(users);
      expect(userController.getAllUsers).toHaveBeenCalledTimes(1);
    });

    test('should handle errors', async () => {
      const errorMessage = 'Error fetching users';
      (userController.getAllUsers as jest.Mock).mockRejectedValue(
        new Error(errorMessage)
      );

      const response = await request(app).get('/users');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        message: `Failed to fetch users: ${errorMessage}`,
      });
      expect(userController.getAllUsers).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /users/:userId', () => {
    test('should return a user by ID', async () => {
      const user = { id: 1, name: 'John Doe' };
      (userController.getUserById as jest.Mock).mockResolvedValue(user);

      const response = await request(app).get('/users/1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(user);
      expect(userController.getUserById).toHaveBeenCalledTimes(1);
      expect(userController.getUserById).toHaveBeenCalledWith('1');
    });

    test('should handle errors', async () => {
      const errorMessage = 'Error fetching user';
      (userController.getUserById as jest.Mock).mockRejectedValue(
        new Error(errorMessage)
      );

      const response = await request(app).get('/users/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        message: `Failed to fetch user: ${errorMessage}`,
      });
      expect(userController.getUserById).toHaveBeenCalledTimes(1);
      expect(userController.getUserById).toHaveBeenCalledWith('1');
    });
  });

  describe('POST /users', () => {
    test('should create a new user', async () => {
      const newUser = { id: 1, name: 'John Doe' };
      (userController.createUser as jest.Mock).mockResolvedValue(newUser);

      const response = await request(app)
        .post('/users')
        .send({ name: 'John Doe' });

      expect(response.status).toBe(201);
      expect(response.body).toEqual(newUser);
      expect(userController.createUser).toHaveBeenCalledTimes(1);
      expect(userController.createUser).toHaveBeenCalledWith({
        name: 'John Doe',
      });
    });

    test('should handle errors', async () => {
      const errorMessage = 'Error creating user';
      (userController.createUser as jest.Mock).mockRejectedValue(
        new Error(errorMessage)
      );

      const response = await request(app)
        .post('/users')
        .send({ name: 'John Doe' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        message: `Failed to create user: ${errorMessage}`,
      });
      expect(userController.createUser).toHaveBeenCalledTimes(1);
      expect(userController.createUser).toHaveBeenCalledWith({
        name: 'John Doe',
      });
    });
  });
});
