jest.mock('@myorganiser/app-api-client');
jest.mock('@myorganiser/core');

import type { AuthSessionModule } from './auth-session-module';
import { createAuthSessionModule } from './auth-session-module';
import type { AuthSessionStorageAdapter } from './auth-session-storage-adapter';
import type { AuthSessionTransportAdapter } from './auth-session-transport-adapter';
import type { AuthUser } from './auth-session-types';
import {
  resolveInboundGuard,
  resolveOutboundGuard,
} from './guard-orchestration';

describe('guard-orchestration', () => {
  let mockSession: jest.Mocked<AuthSessionModule>;

  beforeEach(() => {
    mockSession = {
      getSnapshot: jest.fn(),
      restoreSession: jest.fn(),
      signOut: jest.fn(),
      signIn: jest.fn(),
      signUp: jest.fn(),
      resendVerificationEmail: jest.fn(),
      requestPasswordReset: jest.fn(),
      confirmPasswordReset: jest.fn(),
      refreshAccessToken: jest.fn(),
      getAccessToken: jest.fn(),
      getCurrentUser: jest.fn(),
      getAuthAxios: jest.fn(),
      getAuthApi: jest.fn(),
      onSessionEnded: jest.fn(),
    };
  });

  describe('resolveInboundGuard', () => {
    it('returns redirect_dashboard when authenticated', async () => {
      mockSession.getSnapshot.mockReturnValue({ status: 'authenticated' });

      const result = await resolveInboundGuard(mockSession);

      expect(result).toEqual({ kind: 'redirect_dashboard' });
      expect(mockSession.restoreSession).not.toHaveBeenCalled();
    });

    it('returns show_guest when guest (no restore attempted)', async () => {
      mockSession.getSnapshot.mockReturnValue({ status: 'guest' });

      const result = await resolveInboundGuard(mockSession);

      expect(result).toEqual({ kind: 'show_guest' });
      expect(mockSession.restoreSession).not.toHaveBeenCalled();
    });

    it('attempts restore and returns redirect_dashboard on success', async () => {
      mockSession.getSnapshot.mockReturnValue({ status: 'restorable' });
      mockSession.restoreSession.mockResolvedValue({
        kind: 'authenticated',
      });

      const result = await resolveInboundGuard(mockSession);

      expect(result).toEqual({ kind: 'redirect_dashboard' });
      expect(mockSession.restoreSession).toHaveBeenCalled();
    });

    it('returns show_guest when restore fails', async () => {
      mockSession.getSnapshot.mockReturnValue({ status: 'restorable' });
      mockSession.restoreSession.mockResolvedValue({
        kind: 'session_cleared',
      });

      const result = await resolveInboundGuard(mockSession);

      expect(result).toEqual({ kind: 'show_guest' });
    });

    it('returns restore_unavailable when the restore could not be completed', async () => {
      mockSession.getSnapshot.mockReturnValue({ status: 'restorable' });
      mockSession.restoreSession.mockResolvedValue({
        kind: 'not_restored',
      });

      const result = await resolveInboundGuard(mockSession);

      expect(result).toEqual({ kind: 'restore_unavailable' });
    });

    it('skips restore when authenticated snapshot found', async () => {
      mockSession.getSnapshot.mockReturnValue({ status: 'authenticated' });

      await resolveInboundGuard(mockSession);

      expect(mockSession.restoreSession).not.toHaveBeenCalled();
    });

    it('skips restore when guest snapshot found', async () => {
      mockSession.getSnapshot.mockReturnValue({ status: 'guest' });

      await resolveInboundGuard(mockSession);

      expect(mockSession.restoreSession).not.toHaveBeenCalled();
    });
  });

  describe('resolveOutboundGuard', () => {
    it('returns allow when authenticated', async () => {
      mockSession.getSnapshot.mockReturnValue({ status: 'authenticated' });

      const result = await resolveOutboundGuard(mockSession);

      expect(result).toEqual({ kind: 'allow' });
      expect(mockSession.restoreSession).not.toHaveBeenCalled();
    });

    it('returns redirect_login when guest', async () => {
      mockSession.getSnapshot.mockReturnValue({ status: 'guest' });

      const result = await resolveOutboundGuard(mockSession);

      expect(result).toEqual({ kind: 'redirect_login' });
      expect(mockSession.restoreSession).not.toHaveBeenCalled();
    });

    it('attempts restore and returns allow on success', async () => {
      mockSession.getSnapshot.mockReturnValue({ status: 'restorable' });
      mockSession.restoreSession.mockResolvedValue({
        kind: 'authenticated',
      });

      const result = await resolveOutboundGuard(mockSession);

      expect(result).toEqual({ kind: 'allow' });
      expect(mockSession.restoreSession).toHaveBeenCalled();
    });

    it('returns redirect_login when restore fails', async () => {
      mockSession.getSnapshot.mockReturnValue({ status: 'restorable' });
      mockSession.restoreSession.mockResolvedValue({
        kind: 'session_cleared',
      });

      const result = await resolveOutboundGuard(mockSession);

      expect(result).toEqual({ kind: 'redirect_login' });
    });

    it('returns restore_unavailable when the restore could not be completed', async () => {
      mockSession.getSnapshot.mockReturnValue({ status: 'restorable' });
      mockSession.restoreSession.mockResolvedValue({
        kind: 'not_restored',
      });

      const result = await resolveOutboundGuard(mockSession);

      expect(result).toEqual({ kind: 'restore_unavailable' });
    });

    it('skips restore when authenticated snapshot found', async () => {
      mockSession.getSnapshot.mockReturnValue({ status: 'authenticated' });

      await resolveOutboundGuard(mockSession);

      expect(mockSession.restoreSession).not.toHaveBeenCalled();
    });

    it('skips restore when guest snapshot found', async () => {
      mockSession.getSnapshot.mockReturnValue({ status: 'guest' });

      await resolveOutboundGuard(mockSession);

      expect(mockSession.restoreSession).not.toHaveBeenCalled();
    });
  });

  describe('guard routing outcomes', () => {
    it('inbound: guest user sees login page', async () => {
      mockSession.getSnapshot.mockReturnValue({ status: 'guest' });

      const result = await resolveInboundGuard(mockSession);

      expect(result.kind).toBe('show_guest');
    });

    it('inbound: authenticated user redirected to dashboard', async () => {
      mockSession.getSnapshot.mockReturnValue({ status: 'authenticated' });

      const result = await resolveInboundGuard(mockSession);

      expect(result.kind).toBe('redirect_dashboard');
    });

    it('outbound: guest user redirected to login', async () => {
      mockSession.getSnapshot.mockReturnValue({ status: 'guest' });

      const result = await resolveOutboundGuard(mockSession);

      expect(result.kind).toBe('redirect_login');
    });

    it('outbound: authenticated user allowed', async () => {
      mockSession.getSnapshot.mockReturnValue({ status: 'authenticated' });

      const result = await resolveOutboundGuard(mockSession);

      expect(result.kind).toBe('allow');
    });

    it('inbound: restorable user restored and redirected', async () => {
      mockSession.getSnapshot.mockReturnValue({ status: 'restorable' });
      mockSession.restoreSession.mockResolvedValue({
        kind: 'authenticated',
      });

      const result = await resolveInboundGuard(mockSession);

      expect(result.kind).toBe('redirect_dashboard');
    });

    it('outbound: restorable user restored and allowed', async () => {
      mockSession.getSnapshot.mockReturnValue({ status: 'restorable' });
      mockSession.restoreSession.mockResolvedValue({
        kind: 'authenticated',
      });

      const result = await resolveOutboundGuard(mockSession);

      expect(result.kind).toBe('allow');
    });
  });

  // The module is real here and only its two adapters are faked, so these pin
  // what a guard actually gets for a Session whose local state is inconsistent
  // (issue #1134): an access token this tab kept after another window signed
  // out and removed the shared user.
  describe('guards over local state the server may reject', () => {
    const user: AuthUser = {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      firstName: 'Test',
      lastName: 'User',
      role: 'user',
      disabled: false,
    };

    function createInMemoryStorage(initial: {
      token?: string;
      user?: AuthUser;
    }): AuthSessionStorageAdapter {
      let token = initial.token;
      let current = initial.user;
      return {
        getAccessToken: () => token,
        setAccessToken: (next) => {
          token = next ?? undefined;
        },
        getCurrentUser: () => current,
        setCurrentUser: (next) => {
          current = next ?? undefined;
        },
        clearSession: () => {
          token = undefined;
          current = undefined;
        },
      };
    }

    function createSession(
      storage: AuthSessionStorageAdapter,
      refreshToken: jest.Mock,
    ): AuthSessionModule {
      const transport: jest.Mocked<AuthSessionTransportAdapter> = {
        getAuthAxios: jest.fn(),
        getAuthApi: jest.fn().mockReturnValue({ refreshToken }),
      };
      return createAuthSessionModule({ storage, transport });
    }

    it('redirects to login, clears the session and signals once when the refresh is rejected with 401', async () => {
      const storage = createInMemoryStorage({ token: 'stale-tab-token' });
      const refreshToken = jest.fn().mockRejectedValue(
        Object.assign(new Error('Unauthorized'), {
          response: { status: 401 },
        }),
      );
      const session = createSession(storage, refreshToken);
      const listener = jest.fn();
      session.onSessionEnded(listener);

      const result = await resolveOutboundGuard(session);

      expect(result).toEqual({ kind: 'redirect_login' });
      expect(refreshToken).toHaveBeenCalledTimes(1);
      expect(refreshToken).toHaveBeenCalledWith({ refreshTokenBody: {} });
      expect(storage.getAccessToken()).toBeUndefined();
      expect(storage.getCurrentUser()).toBeUndefined();
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({ reason: 'refresh_rejected' });
    });

    it('allows and leaves the user present when the refresh succeeds', async () => {
      const storage = createInMemoryStorage({ token: 'stale-tab-token' });
      const refreshToken = jest.fn().mockResolvedValue({
        data: { token: 'fresh-token', expires_in: 600000, user },
      });
      const session = createSession(storage, refreshToken);
      const listener = jest.fn();
      session.onSessionEnded(listener);

      const result = await resolveOutboundGuard(session);

      expect(result).toEqual({ kind: 'allow' });
      expect(refreshToken).toHaveBeenCalledTimes(1);
      expect(storage.getAccessToken()).toBe('fresh-token');
      expect(storage.getCurrentUser()).toEqual(user);
      expect(listener).not.toHaveBeenCalled();
    });

    it('returns restore_unavailable and keeps the session when the refresh gets a 503', async () => {
      const storage = createInMemoryStorage({ token: 'stale-tab-token' });
      const refreshToken = jest.fn().mockRejectedValue(
        Object.assign(new Error('Service Unavailable'), {
          response: { status: 503 },
        }),
      );
      const session = createSession(storage, refreshToken);
      const listener = jest.fn();
      session.onSessionEnded(listener);

      const result = await resolveOutboundGuard(session);

      expect(result).toEqual({ kind: 'restore_unavailable' });
      expect(refreshToken).toHaveBeenCalledTimes(1);
      expect(storage.getAccessToken()).toBe('stale-tab-token');
      expect(listener).not.toHaveBeenCalled();
    });

    it('returns restore_unavailable and keeps the session when the refresh gets no response', async () => {
      const storage = createInMemoryStorage({ token: 'stale-tab-token' });
      const refreshToken = jest
        .fn()
        .mockRejectedValue(new Error('Network Error'));
      const session = createSession(storage, refreshToken);
      const listener = jest.fn();
      session.onSessionEnded(listener);

      const result = await resolveInboundGuard(session);

      expect(result).toEqual({ kind: 'restore_unavailable' });
      expect(refreshToken).toHaveBeenCalledTimes(1);
      expect(storage.getAccessToken()).toBe('stale-tab-token');
      expect(listener).not.toHaveBeenCalled();
    });

    it('allows a token with its user on the fast path, without a refresh', async () => {
      const storage = createInMemoryStorage({ token: 'tab-token', user });
      const refreshToken = jest.fn();
      const session = createSession(storage, refreshToken);

      const result = await resolveOutboundGuard(session);

      expect(result).toEqual({ kind: 'allow' });
      expect(refreshToken).not.toHaveBeenCalled();
      expect(storage.getAccessToken()).toBe('tab-token');
      expect(storage.getCurrentUser()).toEqual(user);
    });
  });
});
