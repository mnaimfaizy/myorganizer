import { REFRESH_TOKEN_TTL_DAYS } from './tokenLifetimes';

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
