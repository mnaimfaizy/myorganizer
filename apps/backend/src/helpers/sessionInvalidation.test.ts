import { describe, expect, test } from '@jest/globals';

import { isTokenIssuedBeforeInvalidation } from './sessionInvalidation';

describe('isTokenIssuedBeforeInvalidation', () => {
  const invalidatedAt = new Date('2025-06-01T12:00:00.000Z');

  test('returns false when sessions_invalidated_at is null or undefined', () => {
    expect(isTokenIssuedBeforeInvalidation(1_700_000_000, null)).toBe(false);
    expect(isTokenIssuedBeforeInvalidation(1_700_000_000, undefined)).toBe(
      false,
    );
  });

  test('returns true when token iat is before invalidation timestamp', () => {
    const iatSeconds = Math.floor(invalidatedAt.getTime() / 1000 - 60);

    expect(isTokenIssuedBeforeInvalidation(iatSeconds, invalidatedAt)).toBe(
      true,
    );
  });

  test('returns false when token iat is after invalidation timestamp', () => {
    const iatSeconds = Math.floor(invalidatedAt.getTime() / 1000 + 60);

    expect(isTokenIssuedBeforeInvalidation(iatSeconds, invalidatedAt)).toBe(
      false,
    );
  });

  test('returns false when token iat is missing', () => {
    expect(isTokenIssuedBeforeInvalidation(undefined, invalidatedAt)).toBe(
      false,
    );
  });
});
