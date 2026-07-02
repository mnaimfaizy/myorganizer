import { createBrowserAuthSessionStorageAdapter } from './auth-session-storage-adapter';
import type { AuthSessionStorageAdapter } from './auth-session-storage-adapter';

describe('createBrowserAuthSessionStorageAdapter', () => {
  let adapter: AuthSessionStorageAdapter;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    firstName: 'Test',
    lastName: 'User',
  };

  beforeEach(() => {
    // Clear both storages before each test
    localStorage.clear();
    sessionStorage.clear();
    adapter = createBrowserAuthSessionStorageAdapter();
  });

  describe('setAccessToken and getAccessToken', () => {
    it('stores token in local storage by default (no prior mode preference)', () => {
      adapter.setAccessToken('token-123');

      // Default mode is 'local' when no preference set
      expect(localStorage.getItem('myorganizer_access_token')).toBe(
        'token-123',
      );
      expect(sessionStorage.getItem('myorganizer_access_token')).toBeNull();
    });

    it('stores token in session storage with mode:session', () => {
      adapter.setAccessToken('token-123', 'session');

      expect(sessionStorage.getItem('myorganizer_access_token')).toBe(
        'token-123',
      );
      expect(localStorage.getItem('myorganizer_access_token')).toBeNull();
    });

    it('stores token in local storage with mode:local', () => {
      adapter.setAccessToken('token-123', 'local');

      expect(localStorage.getItem('myorganizer_access_token')).toBe(
        'token-123',
      );
      expect(sessionStorage.getItem('myorganizer_access_token')).toBeNull();
    });

    it('retrieves token from session storage', () => {
      adapter.setAccessToken('token-123', 'session');

      const token = adapter.getAccessToken();

      expect(token).toBe('token-123');
    });

    it('retrieves token from local storage', () => {
      adapter.setAccessToken('token-456', 'local');

      const token = adapter.getAccessToken();

      expect(token).toBe('token-456');
    });

    it('clears both storages when setting token to null', () => {
      localStorage.setItem('myorganizer_access_token', 'local-token');
      sessionStorage.setItem('myorganizer_access_token', 'session-token');

      adapter.setAccessToken(null);

      expect(localStorage.getItem('myorganizer_access_token')).toBeNull();
      expect(sessionStorage.getItem('myorganizer_access_token')).toBeNull();
    });

    it('remembers previous storage mode preference', () => {
      // Store token in local first
      adapter.setAccessToken('token-1', 'local');
      expect(localStorage.getItem('myorganizer_token_storage')).toBe('local');

      // Switch to session
      adapter.setAccessToken('token-2', 'session');
      expect(localStorage.getItem('myorganizer_token_storage')).toBe('session');

      // Switch back to local
      adapter.setAccessToken('token-3', 'local');
      expect(localStorage.getItem('myorganizer_token_storage')).toBe('local');
    });

    it('prefers token from preferred storage mode on getAccessToken', () => {
      // Store token in both storages, with session marked as preferred
      sessionStorage.setItem('myorganizer_access_token', 'session-token');
      localStorage.setItem('myorganizer_access_token', 'local-token');
      localStorage.setItem('myorganizer_token_storage', 'session');

      const adapter2 = createBrowserAuthSessionStorageAdapter();
      const token = adapter2.getAccessToken();

      expect(token).toBe('session-token');
    });

    it('falls back to session storage if preferred storage is empty', () => {
      // Prefer local but it's empty, fallback to session
      localStorage.setItem('myorganizer_token_storage', 'local');
      sessionStorage.setItem('myorganizer_access_token', 'session-token');

      const adapter2 = createBrowserAuthSessionStorageAdapter();
      const token = adapter2.getAccessToken();

      expect(token).toBe('session-token');
    });

    it('falls back to local storage if session is empty', () => {
      // Prefer session but it's empty, fallback to local
      localStorage.setItem('myorganizer_token_storage', 'session');
      localStorage.setItem('myorganizer_access_token', 'local-token');

      const adapter2 = createBrowserAuthSessionStorageAdapter();
      const token = adapter2.getAccessToken();

      expect(token).toBe('local-token');
    });

    it('returns undefined if no token in any storage', () => {
      const token = adapter.getAccessToken();

      expect(token).toBeUndefined();
    });
  });

  describe('setCurrentUser and getCurrentUser', () => {
    it('stores user in local storage as JSON', () => {
      adapter.setCurrentUser(mockUser);

      const stored = localStorage.getItem('myorganizer_user');
      expect(stored).not.toBeNull();
      if (stored) {
        expect(JSON.parse(stored)).toEqual(mockUser);
      }
    });

    it('retrieves user from local storage', () => {
      adapter.setCurrentUser(mockUser);

      const user = adapter.getCurrentUser();

      expect(user).toEqual(mockUser);
    });

    it('clears user when setting to null', () => {
      adapter.setCurrentUser(mockUser);
      expect(localStorage.getItem('myorganizer_user')).not.toBeNull();

      adapter.setCurrentUser(null);

      expect(localStorage.getItem('myorganizer_user')).toBeNull();
    });

    it('returns undefined if user not set', () => {
      const user = adapter.getCurrentUser();

      expect(user).toBeUndefined();
    });

    it('returns undefined if stored user is invalid JSON', () => {
      localStorage.setItem('myorganizer_user', 'invalid-json{');

      const user = adapter.getCurrentUser();

      expect(user).toBeUndefined();
    });
  });

  describe('clearSession', () => {
    it('clears token and user from all storages', () => {
      adapter.setAccessToken('token-123', 'local');
      adapter.setCurrentUser(mockUser);

      adapter.clearSession();

      expect(localStorage.getItem('myorganizer_access_token')).toBeNull();
      expect(sessionStorage.getItem('myorganizer_access_token')).toBeNull();
      expect(localStorage.getItem('myorganizer_user')).toBeNull();
    });

    it('leaves storage mode preference intact', () => {
      adapter.setAccessToken('token-123', 'local');
      const initialMode = localStorage.getItem('myorganizer_token_storage');

      adapter.clearSession();

      const modeAfterClear = localStorage.getItem('myorganizer_token_storage');
      expect(modeAfterClear).toBe(initialMode);
    });
  });

  describe('remember-me policy: session vs local', () => {
    it('stores token in session storage for non-remember-me login', () => {
      adapter.setAccessToken('temp-token', 'session');

      expect(sessionStorage.getItem('myorganizer_access_token')).toBe(
        'temp-token',
      );
      expect(localStorage.getItem('myorganizer_access_token')).toBeNull();
    });

    it('stores token in local storage for remember-me login', () => {
      adapter.setAccessToken('persistent-token', 'local');

      expect(localStorage.getItem('myorganizer_access_token')).toBe(
        'persistent-token',
      );
      expect(sessionStorage.getItem('myorganizer_access_token')).toBeNull();
    });

    it('persists remember-me preference across adapter instances', () => {
      // First adapter signs in with remember-me (local)
      adapter.setAccessToken('token-1', 'local');

      // New adapter instance should respect the preference
      const adapter2 = createBrowserAuthSessionStorageAdapter();
      adapter2.setAccessToken('token-2');

      expect(localStorage.getItem('myorganizer_access_token')).toBe('token-2');
      expect(sessionStorage.getItem('myorganizer_access_token')).toBeNull();
    });

    it('switches from local to session storage when remember-me unchecked', () => {
      adapter.setAccessToken('local-token', 'local');
      expect(localStorage.getItem('myorganizer_access_token')).toBe(
        'local-token',
      );

      adapter.setAccessToken('session-token', 'session');

      expect(localStorage.getItem('myorganizer_access_token')).toBeNull();
      expect(sessionStorage.getItem('myorganizer_access_token')).toBe(
        'session-token',
      );
    });
  });

  describe('edge cases', () => {
    it('handles empty string token', () => {
      adapter.setAccessToken('');
      const token = adapter.getAccessToken();

      expect(token).toBeUndefined();
    });

    it('handles large user objects', () => {
      const largeUser = {
        ...mockUser,
        extra: 'x'.repeat(1000),
      };

      adapter.setCurrentUser(largeUser);
      const retrieved = adapter.getCurrentUser();

      expect(retrieved).toEqual(largeUser);
    });
  });
});
