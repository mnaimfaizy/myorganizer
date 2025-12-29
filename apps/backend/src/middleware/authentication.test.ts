import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import type * as express from 'express';

import { decodeToken } from '../helpers/jwtHelper';
import userService from '../services/UserService';
import { expressAuthentication } from './authentication';

jest.mock('../services/UserService', () => ({
  __esModule: true,
  default: {
    getById: jest.fn(),
  },
}));

jest.mock('../helpers/jwtHelper', () => ({
  __esModule: true,
  decodeToken: jest.fn(),
}));

const decodeTokenMock = decodeToken as any;
const getByIdMock = (userService as any).getById as any;

function makeReq(overrides: Partial<express.Request> = {}): express.Request {
  return {
    headers: {},
    body: {},
    ...overrides,
  } as any;
}

describe('expressAuthentication (tsoa jwt)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ACCESS_JWT_SECRET = 'secret';
  });

  test('rejects when no token provided', async () => {
    const req = makeReq();

    await expect(expressAuthentication(req, 'jwt')).rejects.toHaveProperty(
      'status',
      401
    );

    await expect(expressAuthentication(req, 'jwt')).rejects.toHaveProperty(
      'message',
      'No token provided'
    );
  });

  test('rejects unsupported security scheme', async () => {
    const req = makeReq();

    await expect(expressAuthentication(req, 'api_key')).rejects.toHaveProperty(
      'status',
      401
    );

    await expect(expressAuthentication(req, 'api_key')).rejects.toHaveProperty(
      'message',
      'Unsupported security scheme'
    );
  });

  test('uses Authorization Bearer token', async () => {
    decodeTokenMock.mockReturnValue({ userId: 'u1' });
    getByIdMock.mockResolvedValue({ id: 'u1' });

    const req = makeReq({ headers: { authorization: 'Bearer abc' } });
    const user = await expressAuthentication(req, 'jwt');

    expect(decodeToken).toHaveBeenCalledWith('abc', 'secret');
    expect(userService.getById).toHaveBeenCalledWith('u1');
    expect((req as any).user).toEqual({ id: 'u1' });
    expect(user).toEqual({ id: 'u1' });
  });

  test('falls back to body.token when header missing', async () => {
    decodeTokenMock.mockReturnValue({ userId: 'u1' });
    getByIdMock.mockResolvedValue({ id: 'u1' });

    const req = makeReq({ body: { token: 'abc' } });
    const user = await expressAuthentication(req, 'jwt');

    expect(decodeToken).toHaveBeenCalledWith('abc', 'secret');
    expect((req.headers as any).authorization).toBe('Bearer abc');
    expect(user).toEqual({ id: 'u1' });
  });

  test('rejects when body.token is not a string', async () => {
    const req = makeReq({ body: { token: 123 } as any });

    await expect(expressAuthentication(req, 'jwt')).rejects.toHaveProperty(
      'status',
      401
    );

    await expect(expressAuthentication(req, 'jwt')).rejects.toHaveProperty(
      'message',
      'No token provided'
    );
  });

  test('rejects invalid token', async () => {
    decodeTokenMock.mockReturnValue(new Error('bad'));

    const req = makeReq({ headers: { authorization: 'Bearer abc' } });

    await expect(expressAuthentication(req, 'jwt')).rejects.toHaveProperty(
      'status',
      401
    );

    await expect(expressAuthentication(req, 'jwt')).rejects.toHaveProperty(
      'message',
      'Invalid token'
    );
  });

  test('rejects when decoded payload missing userId', async () => {
    decodeTokenMock.mockReturnValue({});

    const req = makeReq({ headers: { authorization: 'Bearer abc' } });

    await expect(expressAuthentication(req, 'jwt')).rejects.toHaveProperty(
      'status',
      401
    );

    await expect(expressAuthentication(req, 'jwt')).rejects.toHaveProperty(
      'message',
      'Invalid token'
    );
  });

  test('rejects when user not found', async () => {
    decodeTokenMock.mockReturnValue({ userId: 'u1' });
    getByIdMock.mockResolvedValue(null);

    const req = makeReq({ headers: { authorization: 'Bearer abc' } });

    await expect(expressAuthentication(req, 'jwt')).rejects.toHaveProperty(
      'status',
      401
    );

    await expect(expressAuthentication(req, 'jwt')).rejects.toHaveProperty(
      'message',
      'User not found'
    );
  });
});
