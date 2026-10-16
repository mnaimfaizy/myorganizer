import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import type { ReactNode } from 'react';
import type { FilteredUserInterface } from '@myorganiser/app-api-client';
import {
  buildLoginUserBody,
  buildRefreshTokenRequest,
  extractRefreshTokenFromLoginResponse,
} from '@myorganiser/auth/portable';
import { saveRefreshToken, clearRefreshToken } from '../storage/keychain';
import {
  apiClient,
  createAuthApi,
  createUsersApi,
  refreshSession,
  setAccessToken,
  setTokenRefreshCallback,
} from '../api/client';
import { REFRESH_FAILURE_ENDS_SESSION } from '../api/sessionRefresh';
import { createUserDeletion } from '../api/userDeletion';
import type { AuthSession, AuthTokens } from '../api/types';

/**
 * `restorable` is a Restorable Session the app could not restore yet: the
 * device holds a Refresh Token, and the refresh that would turn it into an
 * Access Token could not be completed — no answer, or a server failure. The
 * User has not been signed out and is not shown a sign-in prompt; `restore`
 * asks again. It is reached on launch only, because that is the one moment
 * the app has a Refresh Token and no User to show anything for.
 */
export type AuthStatus =
  | 'loading'
  | 'authenticated'
  | 'restorable'
  | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: FilteredUserInterface | null;
  /**
   * Asks the server again for a Session the app could not restore. Resolves
   * once `status` has settled; it never rejects.
   */
  restore: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /**
   * User Deletion: deletes the signed-in User on the server, then wipes their
   * local data through `onLogout` and shows sign-in. Rejects with the
   * request's error, changing nothing on the device, when the server refuses.
   */
  deleteAccount: (password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  /**
   * What else belongs to this User on this device and must go when they log
   * out. Called with the User id before the session is cleared, and awaited,
   * so a local teardown cannot race the re-render that takes the User to
   * Login. Nothing it throws stops the logout — a keystore that refused a
   * delete must not leave the User signed in.
   *
   * It exists because Logout is the one choke point every sign-out passes
   * through, and the things it has to clean up — the Biometric Unlock keystore
   * item (ADR 0108 decision 3) among them — live in libraries this one must
   * not depend on. The app shell supplies it.
   */
  onLogout?: (userId: string) => void | Promise<void>;
  /**
   * Whether to restore the Session from the stored Refresh Token on mount.
   * Defaults to true. False starts signed out without sending anything: the
   * app shell passes it when the backend origin guard could not clear a
   * Refresh Token another backend issued, so that token never leaves the
   * device. The next sign-in replaces it.
   */
  restoreOnLaunch?: boolean;
  children: ReactNode;
}

export function AuthProvider({
  onLogout,
  restoreOnLaunch = true,
  children,
}: AuthProviderProps): React.JSX.Element {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<AuthSession | null>(null);

  const clearSession = useCallback(async () => {
    await clearRefreshToken();
    setAccessToken(null);
    setSession(null);
    setStatus('unauthenticated');
  }, []);

  const handleTokenRefresh = useCallback((tokens: AuthTokens | null) => {
    if (!tokens) {
      setSession(null);
      setStatus('unauthenticated');
      return;
    }

    setSession((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        tokens,
      };
    });
  }, []);

  useEffect(() => {
    setTokenRefreshCallback(handleTokenRefresh);
  }, [handleTokenRefresh]);

  const restore = useCallback(async (): Promise<void> => {
    const outcome = await refreshSession();

    if (outcome.kind === 'refreshed') {
      setSession({ user: outcome.user, tokens: outcome.tokens });
      setStatus('authenticated');
      return;
    }

    if (REFRESH_FAILURE_ENDS_SESSION[outcome.failure]) {
      await clearSession();
      return;
    }

    // The refresh could not be completed, which says nothing about the
    // Session: the Refresh Token stays in the keychain. A Session that is
    // already up is left alone — its requests fail and retry on their own.
    setStatus((current) =>
      current === 'authenticated' ? current : 'restorable',
    );
  }, [clearSession]);

  useEffect(() => {
    if (restoreOnLaunch) {
      void restore();
    } else {
      setStatus('unauthenticated');
    }
    // The flag is fixed for this provider's life: BackendOriginGate decides it
    // before the provider mounts.
  }, [restore, restoreOnLaunch]);

  const login = useCallback(
    async (email: string, password: string): Promise<void> => {
      const authApi = createAuthApi();
      const response = await authApi.login({
        userLoginBody: buildLoginUserBody(
          {
            email,
            password,
          },
          'mobile',
        ),
      });

      const data = response.data;
      const newAccessToken = data.token;
      const refreshToken = extractRefreshTokenFromLoginResponse('mobile', data);

      setAccessToken(newAccessToken);
      await saveRefreshToken(refreshToken);

      setSession({
        user: data.user,
        tokens: {
          accessToken: newAccessToken,
          refreshToken,
          expiresIn: data.expires_in,
        },
      });
      setStatus('authenticated');
    },
    [],
  );

  const logout = useCallback(async (): Promise<void> => {
    const userId = session?.user.id;
    if (userId && onLogout) {
      try {
        await onLogout(userId);
      } catch {
        // Continue with local logout even if the teardown failed.
      }
    }

    try {
      if (session?.user.id) {
        const authApi = createAuthApi();
        await authApi.logout({
          userId: session.user.id,
          refreshTokenBody: buildRefreshTokenRequest(
            'mobile',
            session.tokens.refreshToken,
          ),
        });
      }
    } catch {
      // Continue with local logout even if server logout fails
    }
    await clearSession();
  }, [session, clearSession, onLogout]);

  const deleteAccount = useCallback(
    (password: string): Promise<void> => {
      const userId = session?.user.id;
      return createUserDeletion({
        requestDeletion: async (userDeletionBody) => {
          await createUsersApi().deleteMe({ userDeletionBody });
        },
        // The same teardown Logout runs: the one clear-local-data function.
        clearLocalData: async () => {
          if (userId && onLogout) await onLogout(userId);
        },
        endSession: clearSession,
      })(password);
    },
    [session, clearSession, onLogout],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user: session?.user ?? null,
      restore,
      login,
      logout,
      deleteAccount,
    }),
    [status, session, restore, login, logout, deleteAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export { apiClient };
