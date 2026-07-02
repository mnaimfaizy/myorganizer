import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import type { ReactNode } from 'react';
import type { FilteredUserInterface } from '@myorganizer/app-api-client';
import {
  buildLoginUserBody,
  buildRefreshTokenRequest,
  extractRefreshTokenFromLoginResponse,
  resolveRefreshTokenAfterRefresh,
} from '@myorganizer/auth';
import {
  saveRefreshToken,
  getRefreshToken,
  clearRefreshToken,
} from '../storage/keychain';
import {
  apiClient,
  createAuthApi,
  setAccessToken,
  setTokenRefreshCallback,
} from '../api/client';
import type { AuthSession, AuthTokens } from '../api/types';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: FilteredUserInterface | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({
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

  useEffect(() => {
    async function restoreSession(): Promise<void> {
      try {
        const storedRefreshToken = await getRefreshToken();
        if (!storedRefreshToken) {
          setStatus('unauthenticated');
          return;
        }

        const authApi = createAuthApi();
        const response = await authApi.refreshToken({
          refreshTokenRequest: buildRefreshTokenRequest(
            'mobile',
            storedRefreshToken,
          ),
        });

        const data = response.data;
        const newAccessToken = data.token;
        const newRefreshToken = resolveRefreshTokenAfterRefresh(
          'mobile',
          data,
          storedRefreshToken,
        );

        if (!newAccessToken) {
          await clearSession();
          return;
        }

        setAccessToken(newAccessToken);

        if (newRefreshToken) {
          await saveRefreshToken(newRefreshToken);
        }

        setSession({
          user: data.user,
          tokens: {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken ?? storedRefreshToken,
            expiresIn: data.expires_in,
          },
        });
        setStatus('authenticated');
      } catch {
        await clearSession();
      }
    }

    restoreSession();
  }, [clearSession]);

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
    try {
      if (session?.user.id) {
        const authApi = createAuthApi();
        await authApi.logout({ userId: session.user.id });
      }
    } catch {
      // Continue with local logout even if server logout fails
    }
    await clearSession();
  }, [session, clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user: session?.user ?? null,
      login,
      logout,
    }),
    [status, session, login, logout],
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
