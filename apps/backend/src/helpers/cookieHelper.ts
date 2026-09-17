import type { CookieOptions, Response } from 'express';
import { REFRESH_TOKEN_TTL_DAYS } from './tokenLifetimes';

export const REFRESH_COOKIE_NAME = 'refresh_cookie';

/**
 * Expiry for the refresh cookie. Derived from the refresh token's own lifetime
 * so the cookie cannot outlive the token it carries.
 */
export const getExpiry = () => {
  const date = new Date();
  const expiration = new Date(
    date.setDate(date.getDate() + REFRESH_TOKEN_TTL_DAYS),
  );
  return expiration;
};

export function refreshCookieOptions(): CookieOptions {
  return {
    expires: getExpiry(),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  };
}

export function setRefreshCookie(res: Response, refreshToken: string): void {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME);
}
