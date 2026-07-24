import { describe, expect, test } from '@jest/globals';
import type * as express from 'express';

import {
  ForbiddenError,
  getAuthenticatedUser,
  isPlatformAdmin,
  requirePlatformAdmin,
  requireUserId,
  UnauthorizedError,
} from './AuthGuard';
import type { UserInterface } from '../types';

function makeReq(overrides: Partial<express.Request> = {}): express.Request {
  return {
    headers: {},
    body: {},
    ...overrides,
  } as express.Request;
}

function makeUser(overrides: Partial<UserInterface> = {}): UserInterface {
  return {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    password: 'hashed',
    password_reset_token: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

describe('UnauthorizedError', () => {
  test('has status 401, name, and default message', () => {
    const error = new UnauthorizedError();

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(error.status).toBe(401);
    expect(error.name).toBe('UnauthorizedError');
    expect(error.message).toBe('Unauthorized');
  });
});

describe('ForbiddenError', () => {
  test('has status 403, name, and default message', () => {
    const error = new ForbiddenError();

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ForbiddenError);
    expect(error.status).toBe(403);
    expect(error.name).toBe('ForbiddenError');
    expect(error.message).toBe('Forbidden');
  });
});

describe('isPlatformAdmin', () => {
  test('returns true when role is platform_admin', () => {
    expect(isPlatformAdmin({ role: 'platform_admin' })).toBe(true);
  });

  test('returns false for user role or missing role', () => {
    expect(isPlatformAdmin({ role: 'user' })).toBe(false);
    expect(isPlatformAdmin({})).toBe(false);
  });
});

describe('requirePlatformAdmin', () => {
  test('returns user when role is platform_admin and not disabled', () => {
    const user = makeUser({ role: 'platform_admin', disabled: false });
    const req = makeReq();
    (req as express.Request & { user?: UserInterface }).user = user;

    expect(requirePlatformAdmin(req)).toBe(user);
  });

  test('throws ForbiddenError when role is user', () => {
    const user = makeUser({ role: 'user' });
    const req = makeReq();
    (req as express.Request & { user?: UserInterface }).user = user;

    expect(() => requirePlatformAdmin(req)).toThrow(ForbiddenError);
    expect(() => requirePlatformAdmin(req)).toThrow(
      expect.objectContaining({
        status: 403,
        message: 'Platform Admin role required',
      }),
    );
  });

  test('throws UnauthorizedError when platform_admin is disabled', () => {
    const user = makeUser({ role: 'platform_admin', disabled: true });
    const req = makeReq();
    (req as express.Request & { user?: UserInterface }).user = user;

    expect(() => requirePlatformAdmin(req)).toThrow(UnauthorizedError);
    expect(() => requirePlatformAdmin(req)).toThrow(
      expect.objectContaining({
        status: 401,
        message: 'Account disabled',
      }),
    );
  });

  test('throws UnauthorizedError when no user is present', () => {
    const req = makeReq();

    expect(() => requirePlatformAdmin(req)).toThrow(UnauthorizedError);
    expect(() => requirePlatformAdmin(req)).toThrow(
      expect.objectContaining({ status: 401, message: 'Unauthorized' }),
    );
  });
});

describe('getAuthenticatedUser', () => {
  test('returns req.user when set', () => {
    const user = makeUser();
    const req = makeReq();
    (req as express.Request & { user?: UserInterface }).user = user;

    expect(getAuthenticatedUser(req)).toBe(user);
  });

  test('throws UnauthorizedError when req.user is undefined', () => {
    const req = makeReq();

    expect(() => getAuthenticatedUser(req)).toThrow(UnauthorizedError);
    expect(() => getAuthenticatedUser(req)).toThrow(
      expect.objectContaining({ status: 401, message: 'Unauthorized' }),
    );
  });

  test('throws UnauthorizedError when req.user is null', () => {
    const req = makeReq();
    (req as express.Request & { user?: UserInterface | null }).user = null;

    expect(() => getAuthenticatedUser(req)).toThrow(UnauthorizedError);
    expect(() => getAuthenticatedUser(req)).toThrow(
      expect.objectContaining({ status: 401, message: 'Unauthorized' }),
    );
  });
});

describe('requireUserId', () => {
  test('returns user.id when req.user has a valid id', () => {
    const user = makeUser({ id: 'user-42' });
    const req = makeReq();
    (req as express.Request & { user?: UserInterface }).user = user;

    expect(requireUserId(req)).toBe('user-42');
  });

  test('throws UnauthorizedError when req.user is undefined', () => {
    const req = makeReq();

    expect(() => requireUserId(req)).toThrow(UnauthorizedError);
    expect(() => requireUserId(req)).toThrow(
      expect.objectContaining({ status: 401, message: 'Unauthorized' }),
    );
  });

  test('throws UnauthorizedError when user.id is an empty string', () => {
    const user = makeUser({ id: '' });
    const req = makeReq();
    (req as express.Request & { user?: UserInterface }).user = user;

    expect(() => requireUserId(req)).toThrow(UnauthorizedError);
    expect(() => requireUserId(req)).toThrow(
      expect.objectContaining({ status: 401, message: 'Unauthorized' }),
    );
  });

  test('throws UnauthorizedError when user.id is undefined', () => {
    const user = makeUser({ id: undefined as unknown as string });
    const req = makeReq();
    (req as express.Request & { user?: UserInterface }).user = user;

    expect(() => requireUserId(req)).toThrow(UnauthorizedError);
    expect(() => requireUserId(req)).toThrow(
      expect.objectContaining({ status: 401, message: 'Unauthorized' }),
    );
  });
});
