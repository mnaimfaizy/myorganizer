import { isRevokedTokenError } from './youtubeSyncErrors';

describe('isRevokedTokenError', () => {
  it('returns true when the error message includes invalid_grant', () => {
    expect(isRevokedTokenError(new Error('invalid_grant'))).toBe(true);
  });

  it('returns true when the error message includes Token has been expired or revoked', () => {
    expect(
      isRevokedTokenError(new Error('Token has been expired or revoked')),
    ).toBe(true);
  });

  it('returns false for unrelated Error messages', () => {
    expect(isRevokedTokenError(new Error('Network error'))).toBe(false);
  });

  it('returns false for a non-Error value without a revoked grant message', () => {
    expect(isRevokedTokenError('subscriptions unavailable')).toBe(false);
  });
});
