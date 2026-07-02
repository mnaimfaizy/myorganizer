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

jest.mock('../helpers/ApiTokens', () => ({
  __esModule: true,
  default: {
    createTokens: jest.fn(() => ({
      token: 'access-token',
      refreshToken: 'refresh-token',
    })),
  },
}));

jest.mock('../helpers/filterUser', () => ({
  __esModule: true,
  default: jest.fn((user: any) => ({
    id: user.id,
    name: user.name || 'Test User',
    email: user.email,
    firstName: user.first_name || 'Test',
    lastName: user.last_name || 'User',
    phone: user.phone,
  })),
}));

jest.mock('../helpers/cookieHelper', () => ({
  __esModule: true,
  getExpiry: jest.fn(() => new Date('2026-06-17')),
}));

describe('Auth Routes', () => {
  const app = express();
  app.use(bodyParser.json());
  app.use(cookieParser());
  app.use('/auth', authRouter);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.setTimeout(30000);
  });

  describe('POST /auth/login', () => {
    test('returns 403 when user email is not verified', async () => {
      (passport.authenticate as jest.Mock).mockImplementation(
        (_strategy: string, _options: any, cb: any) => {
          return (_req: any, _res: any, _next: any) => {
            cb(null, { id: 'user-1', email: 'test@example.com' }, undefined);
          };
        },
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

    test('returns 200 with refresh_token in body when client_type is mobile', async () => {
      const verifiedUser = {
        id: 'user-1',
        email: 'test@example.com',
        email_verification_timestamp: new Date(),
        name: 'Test User',
        first_name: 'Test',
        last_name: 'User',
      };

      (passport.authenticate as jest.Mock).mockImplementation(
        (_strategy: string, _options: any, cb: any) => {
          return (_req: any, _res: any, _next: any) => {
            cb(null, verifiedUser, undefined);
          };
        },
      );

      const response = await request(app).post('/auth/login').send({
        email: 'test@example.com',
        password: 'password',
        client_type: 'mobile',
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        token: 'access-token',
        expires_in: 600_000,
        user: expect.objectContaining({
          id: 'user-1',
          email: 'test@example.com',
        }),
        refresh_token: 'refresh-token',
      });
    });

    test('returns 200 without refresh_token in body when client_type is web', async () => {
      const verifiedUser = {
        id: 'user-1',
        email: 'test@example.com',
        email_verification_timestamp: new Date(),
        name: 'Test User',
        first_name: 'Test',
        last_name: 'User',
      };

      (passport.authenticate as jest.Mock).mockImplementation(
        (_strategy: string, _options: any, cb: any) => {
          return (_req: any, _res: any, _next: any) => {
            cb(null, verifiedUser, undefined);
          };
        },
      );

      const response = await request(app).post('/auth/login').send({
        email: 'test@example.com',
        password: 'password',
        client_type: 'web',
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        token: 'access-token',
        expires_in: 600_000,
        user: expect.objectContaining({
          id: 'user-1',
          email: 'test@example.com',
        }),
      });
      expect(response.body).not.toHaveProperty('refresh_token');
    });

    test('returns 200 without refresh_token in body when client_type is not provided', async () => {
      const verifiedUser = {
        id: 'user-2',
        email: 'user2@example.com',
        email_verification_timestamp: new Date(),
        name: 'Another User',
        first_name: 'Another',
        last_name: 'User',
      };

      (passport.authenticate as jest.Mock).mockImplementation(
        (_strategy: string, _options: any, cb: any) => {
          return (_req: any, _res: any, _next: any) => {
            cb(null, verifiedUser, undefined);
          };
        },
      );

      const response = await request(app).post('/auth/login').send({
        email: 'user2@example.com',
        password: 'password',
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        token: 'access-token',
        expires_in: 600_000,
        user: expect.objectContaining({
          id: 'user-2',
          email: 'user2@example.com',
        }),
      });
      expect(response.body).not.toHaveProperty('refresh_token');
    });

    test('returns 422 validation error when client_type is invalid enum value', async () => {
      const response = await request(app).post('/auth/login').send({
        email: 'test@example.com',
        password: 'password',
        client_type: 'desktop',
      });

      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        message: 'Validation Failed',
      });
    });

    test('sets httpOnly refresh_cookie regardless of client_type', async () => {
      const verifiedUser = {
        id: 'user-3',
        email: 'mobile@example.com',
        email_verification_timestamp: new Date(),
        name: 'Mobile User',
        first_name: 'Mobile',
        last_name: 'User',
      };

      (passport.authenticate as jest.Mock).mockImplementation(
        (_strategy: string, _options: any, cb: any) => {
          return (_req: any, _res: any, _next: any) => {
            cb(null, verifiedUser, undefined);
          };
        },
      );

      const response = await request(app).post('/auth/login').send({
        email: 'mobile@example.com',
        password: 'password',
        client_type: 'mobile',
      });

      expect(response.status).toBe(200);

      const setCookieHeaders = response.headers['set-cookie'];
      const cookieArray = Array.isArray(setCookieHeaders)
        ? setCookieHeaders
        : setCookieHeaders
          ? [setCookieHeaders]
          : [];

      const refreshCookie = cookieArray.find((c) =>
        c.startsWith('refresh_cookie='),
      );

      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toContain('refresh_cookie=refresh-token');
      expect(refreshCookie).toContain('HttpOnly');
      expect(refreshCookie).toContain('SameSite=Lax');
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

    test('returns 401 when no refresh token in cookie or body', async () => {
      const response = await request(app).post('/auth/refresh').send({});

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        message: 'Unauthorized',
      });

      expect(userService.refreshToken).not.toHaveBeenCalled();
    });

    test('accepts refresh token from cookie and returns 200 with new token', async () => {
      const verifiedUser = {
        id: 'user-1',
        email: 'test@example.com',
        email_verification_timestamp: new Date(),
        name: 'Test User',
        first_name: 'Test',
        last_name: 'User',
        blacklisted_tokens: [],
      };

      (userService.refreshToken as jest.Mock).mockResolvedValue(verifiedUser);

      const response = await request(app)
        .post('/auth/refresh')
        .set('Cookie', ['refresh_cookie=old-refresh-token']);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        token: 'access-token',
        expires_in: 600_000,
        user: expect.objectContaining({
          id: 'user-1',
          email: 'test@example.com',
        }),
      });
      expect(response.body).not.toHaveProperty('refresh_token');

      const setCookieHeaders = response.headers['set-cookie'];
      const cookieArray = Array.isArray(setCookieHeaders)
        ? setCookieHeaders
        : setCookieHeaders
          ? [setCookieHeaders]
          : [];

      const refreshCookie = cookieArray.find((c) =>
        c.startsWith('refresh_cookie='),
      );

      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toContain('refresh_cookie=refresh-token');
      expect(refreshCookie).toContain('HttpOnly');
      expect(refreshCookie).toContain('SameSite=Lax');
    });

    test('accepts refresh token from request body (mobile) and returns 200 with new token', async () => {
      const verifiedUser = {
        id: 'user-1',
        email: 'mobile@example.com',
        email_verification_timestamp: new Date(),
        name: 'Mobile User',
        first_name: 'Mobile',
        last_name: 'User',
        blacklisted_tokens: [],
      };

      (userService.refreshToken as jest.Mock).mockResolvedValue(verifiedUser);

      const response = await request(app).post('/auth/refresh').send({
        refresh_token: 'mobile-refresh-token',
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        token: 'access-token',
        expires_in: 600_000,
        user: expect.objectContaining({
          id: 'user-1',
          email: 'mobile@example.com',
        }),
      });
      expect(response.body).not.toHaveProperty('refresh_token');

      expect(userService.refreshToken).toHaveBeenCalledWith(
        'mobile-refresh-token',
      );
    });

    test('prefers body refresh_token over cookie when both present', async () => {
      const verifiedUser = {
        id: 'user-1',
        email: 'test@example.com',
        email_verification_timestamp: new Date(),
        name: 'Test User',
        first_name: 'Test',
        last_name: 'User',
        blacklisted_tokens: [],
      };

      (userService.refreshToken as jest.Mock).mockResolvedValue(verifiedUser);

      const response = await request(app)
        .post('/auth/refresh')
        .set('Cookie', ['refresh_cookie=cookie-token'])
        .send({
          refresh_token: 'body-token',
        });

      expect(response.status).toBe(200);
      expect(userService.refreshToken).toHaveBeenCalledWith('body-token');
    });

    test('does not include refresh_token in response body for web client', async () => {
      const verifiedUser = {
        id: 'user-1',
        email: 'test@example.com',
        email_verification_timestamp: new Date(),
        name: 'Test User',
        first_name: 'Test',
        last_name: 'User',
        blacklisted_tokens: [],
      };

      (userService.refreshToken as jest.Mock).mockResolvedValue(verifiedUser);

      const response = await request(app)
        .post('/auth/refresh')
        .set('Cookie', ['refresh_cookie=token']);

      expect(response.status).toBe(200);
      expect(response.body).not.toHaveProperty('refresh_token');
    });

    test('returns 401 when refresh token is blacklisted', async () => {
      const user = {
        id: 'user-1',
        email: 'test@example.com',
        email_verification_timestamp: new Date(),
        name: 'Test User',
        first_name: 'Test',
        last_name: 'User',
        blacklisted_tokens: ['old-refresh-token'],
      };

      (userService.refreshToken as jest.Mock).mockResolvedValue(user);

      const response = await request(app)
        .post('/auth/refresh')
        .set('Cookie', ['refresh_cookie=old-refresh-token']);

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        message: 'Unauthorized',
      });
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
        'token',
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
        new Error('Verification email already sent recently'),
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
        new Error('smtp down'),
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
        'new-token',
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
        new Error('smtp down'),
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
        'new-token',
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
