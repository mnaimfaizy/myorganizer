import {
  clearAuthSession,
  getAccessToken,
  getCurrentUser,
  setAccessToken,
  setCurrentUser,
} from './auth';

describe('auth storage', () => {
  beforeEach(() => {
    clearAuthSession();
  });

  it('stores access token in localStorage when requested', () => {
    setAccessToken('abc', 'local');
    expect(getAccessToken()).toBe('abc');
    expect(window.localStorage.getItem('myorganizer_access_token')).toBe('abc');
    expect(window.sessionStorage.getItem('myorganizer_access_token')).toBe(
      null
    );
  });

  it('stores access token in sessionStorage when requested', () => {
    setAccessToken('def', 'session');
    expect(getAccessToken()).toBe('def');
    expect(window.sessionStorage.getItem('myorganizer_access_token')).toBe(
      'def'
    );
    expect(window.localStorage.getItem('myorganizer_access_token')).toBe(null);
  });

  it('stores and loads current user', () => {
    setCurrentUser({
      id: 'u1',
      email: 'a@example.com',
      name: 'A',
      firstName: 'A',
      lastName: 'B',
    });

    const user = getCurrentUser();
    expect(user?.id).toBe('u1');
    expect(user?.email).toBe('a@example.com');
  });
});
