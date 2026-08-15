/**
 * Token lifetimes, declared once for the whole backend.
 *
 * These live apart from `ApiTokens` deliberately. Tests routinely mock the
 * token factory, and when the constants shared its module every such mock
 * silently replaced them with `undefined` — so a login response would claim
 * `expires_in: undefined` and only an equality assertion would notice.
 *
 * The paired forms are derived from a single number rather than written twice.
 * `'10m'` and `600_000` used to be independent literals in four places, so a
 * change to one left clients believing the other.
 */

const ACCESS_TOKEN_TTL_MINUTES = 10;

/** Access token lifetime, in the `jsonwebtoken` `expiresIn` format. */
export const ACCESS_TOKEN_TTL = `${ACCESS_TOKEN_TTL_MINUTES}m`;

/** The same lifetime in milliseconds, as reported to clients in `expires_in`. */
export const ACCESS_TOKEN_EXPIRES_IN_MS = ACCESS_TOKEN_TTL_MINUTES * 60_000;

/** Refresh token lifetime. The refresh cookie's expiry is derived from it. */
export const REFRESH_TOKEN_TTL_DAYS = 7;
export const REFRESH_TOKEN_TTL = `${REFRESH_TOKEN_TTL_DAYS}d`;

/**
 * Single-use email tokens. Their lifetime doubles as the resend cooldown:
 * a still-valid token is what makes a repeat request return 429, so shortening
 * these shortens the cooldown with them.
 */
export const VERIFY_TOKEN_TTL = '10m';
export const RESET_TOKEN_TTL = '10m';
