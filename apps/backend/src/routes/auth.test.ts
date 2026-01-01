import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import authRouter from './auth';

import userController from '../controllers/UserController';
import userService from '../services/UserService';
import passport from '../utils/passport';

jest.mock('../utils/passport', () => ({
  __esModule: true,
  default: {
    authenticate: jest.fn(() => (_req: any, _res: any, next: any) => next()),
  },
}));

jest.mock('../services/UserService', () => ({
  __esModule: true,
  default: {
    refreshToken: jest.fn(),
    getByEmail: jest.fn(),
    sendVerificationMail: jest.fn(),
  },
}));

jest.mock('../controllers/UserController', () => ({
  __esModule: true,
  default: {
    createUser: jest.fn(),
  },
}));

describe('Auth Routes', () => {
  const app = express();
  app.use(bodyParser.json());
  app.use(cookieParser());
  app.use('/auth', authRouter);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /auth/login', () => {
    test('returns 403 when user email is not verified', async () => {
      (passport.authenticate as jest.Mock).mockImplementation(
        (_strategy: string, _options: any, cb: any) => {
          return (_req: any, _res: any, _next: any) => {
            cb(null, { id: 'user-1', email: 'test@example.com' }, undefined);
          };
        }
      );

      const response = await request(app).post('/auth/login').send({
        email: 'test@example.com',
        password: 'password',
      });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        message: 'Email not verified. Please verify your email first.',
      });
    });
  });

  describe('POST /auth/refresh', () => {
    test('returns 403 and clears refresh cookie when user email is not verified', async () => {
      (userService.refreshToken as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        email_verification_timestamp: null,
        blacklisted_tokens: [],
      });

      const response = await request(app)
        .post('/auth/refresh')
        .set('Cookie', ['refresh_cookie=refresh-token']);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        message: 'Email not verified. Please verify your email first.',
      });

      const rawSetCookie = response.headers['set-cookie'] as
        | string
        | string[]
        | undefined;
      const setCookie = Array.isArray(rawSetCookie)
        ? rawSetCookie
        : rawSetCookie
        ? [rawSetCookie]
        : [];

      expect(setCookie.some((c) => c.startsWith('refresh_cookie='))).toBe(true);
    });
  });

  describe('POST /auth/register', () => {
    test('returns 409 when email already registered and verified', async () => {
      (userService.getByEmail as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        email_verification_timestamp: new Date(),
      });

      const response = await request(app).post('/auth/register').send({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: 'password',
      });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        message: 'Email already registered. Please log in.',
      });
    });

    test('resends verification and returns 409 when email already registered but unverified', async () => {
      (userService.getByEmail as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        email_verification_timestamp: null,
      });
      (userService.sendVerificationMail as jest.Mock).mockResolvedValue(
        undefined
      );

      const response = await request(app).post('/auth/register').send({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: 'password',
      });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        message:
          "Email already registered but isn't verified yet. We've resent the verification email.",
        user: expect.any(Object),
      });
      expect(userService.sendVerificationMail).toHaveBeenCalledTimes(1);
      expect(userController.createUser).not.toHaveBeenCalled();
    });
  });
});
