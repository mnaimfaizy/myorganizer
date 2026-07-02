import { describe, expect, test } from '@jest/globals';
import type * as express from 'express';

import {
  getAuthenticatedUser,
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
