import { describe, expect, test, afterEach } from '@jest/globals';
import type { Response } from 'express';

import {
  REFRESH_COOKIE_NAME,
  clearRefreshCookie,
  setRefreshCookie,
} from './cookieHelper';

function makeMockResponse(): Response {
  return {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  } as unknown as Response;
}

const originalNodeEnv = process.env.NODE_ENV;

function restoreNodeEnv() {
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
    return;
  }
  process.env.NODE_ENV = originalNodeEnv;
}

describe('setRefreshCookie', () => {
  afterEach(() => {
    restoreNodeEnv();
  });

  test('calls res.cookie with refresh_cookie and lax httpOnly options including expires', () => {
    process.env.NODE_ENV = 'test';
    const res = makeMockResponse();
    const refreshToken = 'rt-abc';

    setRefreshCookie(res, refreshToken);

    expect(res.cookie).toHaveBeenCalledTimes(1);
    expect(res.cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      refreshToken,
      expect.objectContaining({
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        expires: expect.any(Date),
      }),
    );
  });

  test('uses secure false when NODE_ENV is not production', () => {
    process.env.NODE_ENV = 'development';
    const res = makeMockResponse();

    setRefreshCookie(res, 'rt-dev');

    expect(res.cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      'rt-dev',
      expect.objectContaining({ secure: false }),
    );
  });

  test('uses secure true when NODE_ENV is production', () => {
    process.env.NODE_ENV = 'production';
    const res = makeMockResponse();

    setRefreshCookie(res, 'rt-prod');

    expect(res.cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      'rt-prod',
      expect.objectContaining({ secure: true }),
    );
  });
});

describe('clearRefreshCookie', () => {
  afterEach(() => {
    restoreNodeEnv();
  });

  test('calls res.clearCookie with matching attributes and no expires when not production', () => {
    process.env.NODE_ENV = 'test';
    const res = makeMockResponse();

    clearRefreshCookie(res);

    expect(res.clearCookie).toHaveBeenCalledTimes(1);
    expect(res.clearCookie).toHaveBeenCalledWith(REFRESH_COOKIE_NAME, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
    });
    const clearOptions = (res.clearCookie as jest.Mock).mock.calls[0][1];
    expect(clearOptions).not.toHaveProperty('expires');
  });

  test('calls res.clearCookie with secure true in production and no expires', () => {
    process.env.NODE_ENV = 'production';
    const res = makeMockResponse();

    clearRefreshCookie(res);

    expect(res.clearCookie).toHaveBeenCalledWith(REFRESH_COOKIE_NAME, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
    });
    const clearOptions = (res.clearCookie as jest.Mock).mock.calls[0][1];
    expect(clearOptions).not.toHaveProperty('expires');
  });
});
