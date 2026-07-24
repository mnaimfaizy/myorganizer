/**
 * Returns true when a JWT (access or refresh) was issued before the User's
 * sessions were invalidated (disable / force logout).
 *
 * `tokenIat` is the JWT `iat` claim in seconds since epoch.
 */
export function isTokenIssuedBeforeInvalidation(
  tokenIat: number | undefined,
  sessionsInvalidatedAt: Date | null | undefined,
): boolean {
  if (!sessionsInvalidatedAt || tokenIat == null) {
    return false;
  }
  return tokenIat * 1000 < sessionsInvalidatedAt.getTime();
}
