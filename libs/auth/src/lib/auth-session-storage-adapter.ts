import type { AuthUser } from './auth-session-types';

export type TokenStorageMode = 'local' | 'session';

export interface AuthSessionStorageAdapter {
  getAccessToken(): string | undefined;
  setAccessToken(token: string | null, mode?: TokenStorageMode): void;
  getCurrentUser(): AuthUser | undefined;
  setCurrentUser(user: AuthUser | null): void;
  clearSession(): void;
  /**
   * Watch for another window of the same browser signing out, and return the
   * function that stops watching.
   *
   * Optional because only a storage shared between windows can observe it: an
   * adapter with a single owner (a native app, an in-memory fake) omits it.
   */
  onSignedOutElsewhere?(listener: () => void): () => void;
}

const ACCESS_TOKEN_KEY = 'myorganizer_access_token';
const USER_KEY = 'myorganizer_user';
const TOKEN_STORAGE_KEY = 'myorganizer_token_storage';

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Whether this runtime can deliver `storage` events.
 *
 * Checks the capability itself rather than `typeof window`: React Native sets
 * `global.window = global`, so `window` exists there and cannot listen.
 */
function canListenForStorageEvents(): boolean {
  return (
    isBrowser() &&
    typeof window.addEventListener === 'function' &&
    typeof window.removeEventListener === 'function'
  );
}

function getPreferredTokenStorageMode(): TokenStorageMode {
  if (!isBrowser()) return 'local';
  const stored = window.localStorage.getItem(TOKEN_STORAGE_KEY);
  return stored === 'session' ? 'session' : 'local';
}

function setPreferredTokenStorageMode(mode: TokenStorageMode) {
  if (!isBrowser()) return;
  window.localStorage.setItem(TOKEN_STORAGE_KEY, mode);
}

function getStorage(mode: TokenStorageMode): Storage | undefined {
  if (!isBrowser()) return undefined;
  return mode === 'session' ? window.sessionStorage : window.localStorage;
}

export function createBrowserAuthSessionStorageAdapter(): AuthSessionStorageAdapter {
  return {
    getAccessToken(): string | undefined {
      if (!isBrowser()) return undefined;

      const preferred = getPreferredTokenStorageMode();
      const preferredStorage = getStorage(preferred);
      const tokenFromPreferred =
        preferredStorage?.getItem(ACCESS_TOKEN_KEY) || '';
      if (tokenFromPreferred) return tokenFromPreferred;

      const tokenFromSession =
        window.sessionStorage.getItem(ACCESS_TOKEN_KEY) || '';
      if (tokenFromSession) return tokenFromSession;

      const tokenFromLocal =
        window.localStorage.getItem(ACCESS_TOKEN_KEY) || '';
      if (tokenFromLocal) return tokenFromLocal;

      return undefined;
    },

    setAccessToken(
      token: string | null,
      mode: TokenStorageMode = getPreferredTokenStorageMode(),
    ) {
      if (!isBrowser()) return;

      window.localStorage.removeItem(ACCESS_TOKEN_KEY);
      window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);

      if (!token) {
        return;
      }

      setPreferredTokenStorageMode(mode);
      const storage = getStorage(mode);
      storage?.setItem(ACCESS_TOKEN_KEY, token);
    },

    getCurrentUser(): AuthUser | undefined {
      if (!isBrowser()) return undefined;
      const raw = window.localStorage.getItem(USER_KEY);
      if (!raw) return undefined;

      try {
        return JSON.parse(raw) as AuthUser;
      } catch {
        return undefined;
      }
    },

    setCurrentUser(user: AuthUser | null) {
      if (!isBrowser()) return;
      if (!user) {
        window.localStorage.removeItem(USER_KEY);
        return;
      }
      window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    },

    clearSession() {
      this.setAccessToken(null);
      this.setCurrentUser(null);
    },

    onSignedOutElsewhere(listener: () => void): () => void {
      if (!canListenForStorageEvents()) {
        return () => undefined;
      }

      // The browser delivers `storage` only to the *other* windows of an
      // origin, so this never fires for a removal this window made itself.
      const handleStorage = (event: StorageEvent) => {
        if (event.storageArea !== window.localStorage) return;
        // A null key is `localStorage.clear()`, which removes the user too.
        if (event.key !== USER_KEY && event.key !== null) return;
        if (event.newValue !== null) return;
        // Read the store, not the event: a sign-in that followed the removal
        // has already put a user back, and that Session is not one to end.
        if (window.localStorage.getItem(USER_KEY) !== null) return;
        listener();
      };

      window.addEventListener('storage', handleStorage);
      return () => {
        window.removeEventListener('storage', handleStorage);
      };
    },
  };
}
