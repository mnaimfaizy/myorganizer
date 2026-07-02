import type { AuthSessionModule } from './auth-session-module';
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
});
