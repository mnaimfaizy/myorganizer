import { clearAuthSession, getAccessToken, setAccessToken } from './auth';

describe('@myorganizer/auth', () => {
  beforeEach(() => {
    clearAuthSession();
  });

  it('stores and retrieves an access token', () => {
    setAccessToken('token-123', 'session');
    expect(getAccessToken()).toBe('token-123');
  });
});
