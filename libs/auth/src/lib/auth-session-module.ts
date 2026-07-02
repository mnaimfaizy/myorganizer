import type {
  AuthenticationApi,
  ConfirmResetPasswordBody,
} from '@myorganizer/app-api-client';
import axios, { type AxiosInstance } from 'axios';

import { toAuthError, toAuthErrorFromMessage } from './auth-error-mapping';
import type { AuthSessionStorageAdapter } from './auth-session-storage-adapter';
import { createBrowserAuthSessionStorageAdapter } from './auth-session-storage-adapter';
import type { AuthSessionTransportAdapter } from './auth-session-transport-adapter';
import { createAuthSessionTransportAdapter } from './auth-session-transport-adapter';
import type {
  AuthSessionData,
  PasswordResetConfirmOutcome,
  PasswordResetRequestOutcome,
  ResendVerificationOutcome,
  RestoreSessionOutcome,
  SessionSnapshot,
  SignInOutcome,
  SignOutOutcome,
  SignUpOutcome,
  AuthOperationResult,
} from './auth-session-types';
import {
  buildLoginUserBody,
  buildRefreshTokenRequest,
} from './refresh-client-contract';

function toSessionData(
  response: import('@myorganizer/app-api-client').Login200Response,
): AuthSessionData {
  return {
    token: response.token,
    expiresIn: response.expires_in,
    user: response.user,
  };
}

function extractMessage(err: unknown): string {
  if (!axios.isAxiosError(err)) return 'Unexpected error.';
  const data = err.response?.data as { message?: string } | undefined;
  if (data?.message && typeof data.message === 'string') return data.message;
  return err.message || 'Request failed.';
}

export interface AuthSessionModule {
  getSnapshot(): SessionSnapshot;
  restoreSession(): Promise<RestoreSessionOutcome>;
  signOut(): Promise<SignOutOutcome>;
  signIn(args: {
    email: string;
    password: string;
    rememberMe?: boolean;
  }): Promise<SignInOutcome>;
  signUp(args: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    phone?: string;
  }): Promise<SignUpOutcome>;
  resendVerificationEmail(email: string): Promise<ResendVerificationOutcome>;
  requestPasswordReset(args: {
    email: string;
  }): Promise<PasswordResetRequestOutcome>;
  confirmPasswordReset(args: {
    token: string;
    password: string;
    confirmPassword: string;
  }): Promise<PasswordResetConfirmOutcome>;
  refreshAccessToken(): Promise<AuthOperationResult<AuthSessionData>>;
  getAccessToken(): string | undefined;
  getCurrentUser(): ReturnType<AuthSessionStorageAdapter['getCurrentUser']>;
  getAuthAxios(): AxiosInstance;
  getAuthApi(): AuthenticationApi;
}

export function createAuthSessionModule(deps: {
  storage: AuthSessionStorageAdapter;
  transport: AuthSessionTransportAdapter;
}): AuthSessionModule {
  const { storage, transport } = deps;

  async function refreshSessionViaTransport(): Promise<AuthSessionData> {
    const res = await transport.getAuthApi().refreshToken({
      refreshTokenRequest: buildRefreshTokenRequest('web'),
    });
    const session = toSessionData(res.data);
    storage.setAccessToken(session.token);
    storage.setCurrentUser(session.user);
    return session;
  }

  return {
    getSnapshot(): SessionSnapshot {
      if (storage.getAccessToken()) {
        return { status: 'authenticated' };
      }
      if (storage.getCurrentUser()) {
        return { status: 'restorable' };
      }
      return { status: 'guest' };
    },

    async restoreSession(): Promise<RestoreSessionOutcome> {
      if (storage.getAccessToken()) {
        return { kind: 'authenticated' };
      }

      if (!storage.getCurrentUser()) {
        return { kind: 'session_cleared' };
      }

      try {
        await refreshSessionViaTransport();
        return { kind: 'authenticated' };
      } catch {
        storage.clearSession();
        return { kind: 'session_cleared' };
      }
    },

    async signOut(): Promise<SignOutOutcome> {
      const user = storage.getCurrentUser();
      if (!user?.id) {
        storage.clearSession();
        return { kind: 'signed_out' };
      }

      try {
        await transport.getAuthApi().logout({ userId: user.id });
      } catch {
        // API call may fail — still clear local session
      } finally {
        storage.clearSession();
      }

      return { kind: 'signed_out' };
    },

    async signIn(args): Promise<SignInOutcome> {
      try {
        const res = await transport.getAuthApi().login({
          userLoginBody: buildLoginUserBody(
            {
              email: args.email,
              password: args.password,
            },
            'web',
          ),
        });

        const session = toSessionData(res.data);
        storage.setAccessToken(
          session.token,
          args.rememberMe ? 'local' : 'session',
        );
        storage.setCurrentUser(session.user);
        return { ok: true, value: session };
      } catch (err) {
        return {
          ok: false,
          error: toAuthErrorFromMessage(extractMessage(err)),
        };
      }
    },

    async signUp(args): Promise<SignUpOutcome> {
      try {
        const res = await transport.getAuthApi().registerUser({
          userCreationBody: {
            firstName: args.firstName,
            lastName: args.lastName,
            email: args.email,
            password: args.password,
            ...(args.phone ? { phone: args.phone } : {}),
          },
        });

        const data = res.data as
          | { message: string; user?: AuthSessionData['user'] }
          | AuthSessionData['user'];

        if (data && typeof data === 'object' && 'message' in data) {
          return {
            ok: true,
            value: {
              message: data.message,
              user: data.user,
            },
          };
        }

        return {
          ok: true,
          value: {
            message: 'Verification email sent. Please check your inbox.',
            user: data as AuthSessionData['user'],
          },
        };
      } catch (err) {
        return {
          ok: false,
          error: toAuthErrorFromMessage(extractMessage(err)),
        };
      }
    },

    async resendVerificationEmail(
      email: string,
    ): Promise<ResendVerificationOutcome> {
      try {
        const res = await transport.getAuthAxios().post('/auth/verify/resend', {
          email,
        });
        return { ok: true, value: res.data as { message: string } };
      } catch (err) {
        return { ok: false, error: toAuthError(err) };
      }
    },

    async requestPasswordReset(args): Promise<PasswordResetRequestOutcome> {
      try {
        const res = await transport.getAuthApi().resetPassword({
          resetPasswordByEmailBody: {
            email: args.email,
          },
        });
        return { ok: true, value: res.data };
      } catch (err) {
        return {
          ok: false,
          error: toAuthErrorFromMessage(extractMessage(err)),
        };
      }
    },

    async confirmPasswordReset(args): Promise<PasswordResetConfirmOutcome> {
      try {
        const body: ConfirmResetPasswordBody = {
          token: args.token,
          password: args.password,
          confirm_password: args.confirmPassword,
        };

        const res = await transport.getAuthApi().confirmResetPassword({
          confirmResetPasswordBody: body,
        });

        return { ok: true, value: res.data };
      } catch (err) {
        return {
          ok: false,
          error: toAuthErrorFromMessage(extractMessage(err)),
        };
      }
    },

    async refreshAccessToken(): Promise<AuthOperationResult<AuthSessionData>> {
      try {
        const session = await refreshSessionViaTransport();
        return { ok: true, value: session };
      } catch (err) {
        return {
          ok: false,
          error: toAuthErrorFromMessage(extractMessage(err)),
        };
      }
    },

    getAccessToken: () => storage.getAccessToken(),
    getCurrentUser: () => storage.getCurrentUser(),
    getAuthAxios: () => transport.getAuthAxios(),
    getAuthApi: () => transport.getAuthApi(),
  };
}

export function createDefaultAuthSessionModule(): AuthSessionModule {
  const storage = createBrowserAuthSessionStorageAdapter();
  const transport = createAuthSessionTransportAdapter(storage);
  return createAuthSessionModule({ storage, transport });
}
