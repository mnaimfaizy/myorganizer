import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import authRouter from './auth';

import userController from '../controllers/UserController';
import userService from '../services/UserService';
import passport from '../utils/passport';

import { decodeToken } from '../helpers/jwtHelper';

jest.mock('../helpers/jwtHelper', () => ({
  __esModule: true,
  generateToken: jest.fn(),
  decodeToken: jest.fn(),
}));

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
    sendPasswordResetMail: jest.fn(),
    update: jest.fn(),
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
        'token'
      );
      (userService.update as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        email_verification_timestamp: null,
        email_verification_token: 'token',
      });

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
      expect(userService.update).toHaveBeenCalledTimes(1);
      expect(userController.createUser).not.toHaveBeenCalled();
    });
  });

  describe('POST /auth/verify/resend', () => {
    test('returns 429 when a verification email was already sent recently', async () => {
      (userService.getByEmail as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        email_verification_timestamp: null,
        email_verification_token: 'existing-verify-token',
      });
      (userService.sendVerificationMail as jest.Mock).mockResolvedValue(
        new Error('Verification email already sent recently')
      );

      const response = await request(app).post('/auth/verify/resend').send({
        email: 'test@example.com',
      });

      expect(response.status).toBe(429);
      expect(response.body).toEqual({
        message:
          'A verification email was already sent recently. Please check your inbox and try again later.',
      });
      expect(userService.sendVerificationMail).toHaveBeenCalledTimes(1);
      expect(userService.update).not.toHaveBeenCalled();
    });

    test('does not persist token when email send fails', async () => {
      (userService.getByEmail as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        email_verification_timestamp: null,
        email_verification_token: null,
      });
      (userService.sendVerificationMail as jest.Mock).mockResolvedValue(
        new Error('smtp down')
      );

      const response = await request(app).post('/auth/verify/resend').send({
        email: 'test@example.com',
      });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        message: 'Failed to send verification email.',
      });
      expect(userService.update).not.toHaveBeenCalled();
    });

    test('persists token only after email send succeeds', async () => {
      (userService.getByEmail as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        email_verification_timestamp: null,
        email_verification_token: null,
      });
      (userService.sendVerificationMail as jest.Mock).mockResolvedValue(
        'new-token'
      );
      (userService.update as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email_verification_token: 'new-token',
      });

      const response = await request(app).post('/auth/verify/resend').send({
        email: 'test@example.com',
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'Verification email sent successfully',
      });
      expect(userService.update).toHaveBeenCalledWith('user-1', {
        email_verification_token: 'new-token',
      });
    });
  });

  describe('POST /auth/password/reset', () => {
    test('returns 429 when a non-expired reset token already exists', async () => {
      (userService.getByEmail as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        reset_password_token: 'existing-token',
      });
      (decodeToken as jest.Mock).mockReturnValue({ userId: 'user-1' });

      const response = await request(app).post('/auth/password/reset').send({
        email: 'test@example.com',
      });

      expect(response.status).toBe(429);
      expect(response.body).toEqual({
        message:
          'A password reset email was already sent recently. Please check your inbox and try again later.',
      });
      expect(userService.sendPasswordResetMail).not.toHaveBeenCalled();
      expect(userService.update).not.toHaveBeenCalled();
    });

    test('does not persist token when email send fails', async () => {
      (userService.getByEmail as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        reset_password_token: null,
      });
      (userService.sendPasswordResetMail as jest.Mock).mockResolvedValue(
        new Error('smtp down')
      );

      const response = await request(app).post('/auth/password/reset').send({
        email: 'test@example.com',
      });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ message: 'Failed to reset password' });
      expect(userService.update).not.toHaveBeenCalled();
    });

    test('persists token only after email send succeeds', async () => {
      (userService.getByEmail as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        reset_password_token: null,
      });
      (userService.sendPasswordResetMail as jest.Mock).mockResolvedValue(
        'new-token'
      );
      (userService.update as jest.Mock).mockResolvedValue({
        id: 'user-1',
        reset_password_token: 'new-token',
      });

      const response = await request(app).post('/auth/password/reset').send({
        email: 'test@example.com',
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'Password reset email sent successfully',
      });
      expect(userService.update).toHaveBeenCalledWith('user-1', {
        reset_password_token: 'new-token',
      });
    });
  });
});
