jest.mock('@myorganizer/app-api-client');
jest.mock('@myorganizer/core');

import type { AuthSessionModule } from './auth-session-module';
import { createAuthSessionModule } from './auth-session-module';
import type { AuthSessionStorageAdapter } from './auth-session-storage-adapter';
import type { AuthSessionTransportAdapter } from './auth-session-transport-adapter';
import type { AuthUser } from './auth-session-types';

describe('createAuthSessionModule', () => {
  let mockStorage: jest.Mocked<AuthSessionStorageAdapter>;
  let mockTransport: jest.Mocked<AuthSessionTransportAdapter>;
  let module: AuthSessionModule;

  const mockUser: AuthUser = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    firstName: 'Test',
    lastName: 'User',
  };

  const mockSessionData = {
    token: 'access-token-123',
    expiresIn: 600000,
    user: mockUser,
  };

  beforeEach(() => {
    mockStorage = {
      getAccessToken: jest.fn(),
      setAccessToken: jest.fn(),
      getCurrentUser: jest.fn(),
      setCurrentUser: jest.fn(),
      clearSession: jest.fn(),
    };

    mockTransport = {
      getAuthAxios: jest.fn(),
      getAuthApi: jest.fn().mockReturnValue({
        login: jest.fn(),
        registerUser: jest.fn(),
        refreshToken: jest.fn(),
        logout: jest.fn(),
        resendVerificationEmail: jest.fn(),
        resetPassword: jest.fn(),
        confirmResetPassword: jest.fn(),
      }),
    };

    module = createAuthSessionModule({
      storage: mockStorage,
      transport: mockTransport,
    });
  });

  describe('getSnapshot', () => {
    it('returns authenticated when token exists', () => {
      mockStorage.getAccessToken.mockReturnValue('token-123');

      const snapshot = module.getSnapshot();

      expect(snapshot).toEqual({ status: 'authenticated' });
    });

    it('returns restorable when user exists but no token', () => {
      mockStorage.getAccessToken.mockReturnValue(undefined);
      mockStorage.getCurrentUser.mockReturnValue(mockUser);

      const snapshot = module.getSnapshot();

      expect(snapshot).toEqual({ status: 'restorable' });
    });

    it('returns guest when neither token nor user exist', () => {
      mockStorage.getAccessToken.mockReturnValue(undefined);
      mockStorage.getCurrentUser.mockReturnValue(undefined);

      const snapshot = module.getSnapshot();

      expect(snapshot).toEqual({ status: 'guest' });
    });
  });

  describe('restoreSession', () => {
    it('returns authenticated when token already exists', async () => {
      mockStorage.getAccessToken.mockReturnValue('token-123');

      const result = await module.restoreSession();

      expect(result).toEqual({ kind: 'authenticated' });
    });

    it('returns session_cleared when no token and no user', async () => {
      mockStorage.getAccessToken.mockReturnValue(undefined);
      mockStorage.getCurrentUser.mockReturnValue(undefined);

      const result = await module.restoreSession();

      expect(result).toEqual({ kind: 'session_cleared' });
    });

    it('refreshes and returns authenticated when user exists', async () => {
      mockStorage.getAccessToken.mockReturnValue(undefined);
      mockStorage.getCurrentUser.mockReturnValue(mockUser);

      const mockAuthApi = mockTransport.getAuthApi();
      (mockAuthApi.refreshToken as jest.Mock).mockResolvedValue({
        data: mockSessionData,
      });

      const result = await module.restoreSession();

      expect(result).toEqual({ kind: 'authenticated' });
      expect(mockStorage.setAccessToken).toHaveBeenCalledWith(
        mockSessionData.token,
      );
      expect(mockStorage.setCurrentUser).toHaveBeenCalledWith(
        mockSessionData.user,
      );
    });

    it('clears session and returns session_cleared on refresh failure', async () => {
      mockStorage.getAccessToken.mockReturnValue(undefined);
      mockStorage.getCurrentUser.mockReturnValue(mockUser);

      const mockAuthApi = mockTransport.getAuthApi();
      (mockAuthApi.refreshToken as jest.Mock).mockRejectedValue(
        new Error('Refresh failed'),
      );

      const result = await module.restoreSession();

      expect(result).toEqual({ kind: 'session_cleared' });
      expect(mockStorage.clearSession).toHaveBeenCalled();
    });
  });

  describe('signIn', () => {
    it('returns ok:true with session data on successful login', async () => {
      const mockAuthApi = mockTransport.getAuthApi();
      (mockAuthApi.login as jest.Mock).mockResolvedValue({
        data: mockSessionData,
      });

      const result = await module.signIn({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.token).toBe(mockSessionData.token);
        expect(result.value.user).toEqual(mockSessionData.user);
      }
      expect(mockStorage.setAccessToken).toHaveBeenCalledWith(
        mockSessionData.token,
        'session',
      );
      expect(mockStorage.setCurrentUser).toHaveBeenCalledWith(
        mockSessionData.user,
      );
    });

    it('sets token to local storage when rememberMe is true', async () => {
      const mockAuthApi = mockTransport.getAuthApi();
      (mockAuthApi.login as jest.Mock).mockResolvedValue({
        data: mockSessionData,
      });

      await module.signIn({
        email: 'test@example.com',
        password: 'password123',
        rememberMe: true,
      });

      expect(mockStorage.setAccessToken).toHaveBeenCalledWith(
        mockSessionData.token,
        'local',
      );
    });

    it('sets token to session storage when rememberMe is false', async () => {
      const mockAuthApi = mockTransport.getAuthApi();
      (mockAuthApi.login as jest.Mock).mockResolvedValue({
        data: mockSessionData,
      });

      await module.signIn({
        email: 'test@example.com',
        password: 'password123',
        rememberMe: false,
      });

      expect(mockStorage.setAccessToken).toHaveBeenCalledWith(
        mockSessionData.token,
        'session',
      );
    });

    it('returns ok:false with error on login failure', async () => {
      const mockAuthApi = mockTransport.getAuthApi();
      (mockAuthApi.login as jest.Mock).mockRejectedValue(
        new Error('Login failed'),
      );

      const result = await module.signIn({
        email: 'test@example.com',
        password: 'wrongpassword',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeDefined();
        expect(result.error.message).toBeDefined();
      }
      expect(mockStorage.setAccessToken).not.toHaveBeenCalled();
    });

    it('does not throw on error — returns typed outcome', async () => {
      const mockAuthApi = mockTransport.getAuthApi();
      (mockAuthApi.login as jest.Mock).mockRejectedValue(
        new Error('Network error'),
      );

      const result = await module.signIn({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.ok).toBe(false);
    });
  });

  describe('signOut', () => {
    it('calls logout API and clears session when user exists', async () => {
      mockStorage.getCurrentUser.mockReturnValue(mockUser);

      const mockAuthApi = mockTransport.getAuthApi();
      (mockAuthApi.logout as jest.Mock).mockResolvedValue(undefined);

      const result = await module.signOut();

      expect(result).toEqual({ kind: 'signed_out' });
      expect(mockAuthApi.logout).toHaveBeenCalledWith({ userId: mockUser.id });
      expect(mockStorage.clearSession).toHaveBeenCalled();
    });

    it('clears session without API call when no user', async () => {
      mockStorage.getCurrentUser.mockReturnValue(undefined);

      const result = await module.signOut();

      expect(result).toEqual({ kind: 'signed_out' });
      const mockAuthApi = mockTransport.getAuthApi();
      expect(mockAuthApi.logout).not.toHaveBeenCalled();
      expect(mockStorage.clearSession).toHaveBeenCalled();
    });

    it('still clears session if logout API fails', async () => {
      mockStorage.getCurrentUser.mockReturnValue(mockUser);

      const mockAuthApi = mockTransport.getAuthApi();
      (mockAuthApi.logout as jest.Mock).mockRejectedValue(
        new Error('API error'),
      );

      const result = await module.signOut();

      expect(result).toEqual({ kind: 'signed_out' });
      expect(mockStorage.clearSession).toHaveBeenCalled();
    });
  });

  describe('signUp', () => {
    it('returns ok:true with message and user on successful signup', async () => {
      const mockAuthApi = mockTransport.getAuthApi();
      (mockAuthApi.registerUser as jest.Mock).mockResolvedValue({
        data: {
          message: 'Verification email sent. Please check your inbox.',
          user: mockUser,
        },
      });

      const result = await module.signUp({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.message).toContain('Verification email sent');
      }
    });

    it('includes phone in request when provided', async () => {
      const mockAuthApi = mockTransport.getAuthApi();
      (mockAuthApi.registerUser as jest.Mock).mockResolvedValue({
        data: {
          message: 'Verification email sent',
          user: mockUser,
        },
      });

      await module.signUp({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: 'password123',
        phone: '+1234567890',
      });

      expect(mockAuthApi.registerUser).toHaveBeenCalledWith(
        expect.objectContaining({
          userCreationBody: expect.objectContaining({
            phone: '+1234567890',
          }),
        }),
      );
    });

    it('returns ok:false with error on signup failure', async () => {
      const mockAuthApi = mockTransport.getAuthApi();
      (mockAuthApi.registerUser as jest.Mock).mockRejectedValue(
        new Error('Signup failed'),
      );

      const result = await module.signUp({
        firstName: 'Test',
        lastName: 'User',
        email: 'existing@example.com',
        password: 'password123',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeDefined();
        expect(result.error.message).toBeDefined();
      }
    });
  });

  describe('refreshAccessToken', () => {
    it('returns ok:true with updated session data on success', async () => {
      const mockAuthApi = mockTransport.getAuthApi();
      (mockAuthApi.refreshToken as jest.Mock).mockResolvedValue({
        data: mockSessionData,
      });

      const result = await module.refreshAccessToken();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.token).toBe(mockSessionData.token);
        expect(result.value.user).toEqual(mockSessionData.user);
      }
      expect(mockStorage.setAccessToken).toHaveBeenCalledWith(
        mockSessionData.token,
      );
      expect(mockStorage.setCurrentUser).toHaveBeenCalledWith(
        mockSessionData.user,
      );
    });

    it('returns ok:false with error on refresh failure', async () => {
      const mockAuthApi = mockTransport.getAuthApi();
      (mockAuthApi.refreshToken as jest.Mock).mockRejectedValue(
        new Error('Network error'),
      );

      const result = await module.refreshAccessToken();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeDefined();
        expect(result.error.message).toBeDefined();
      }
    });

    it('does not throw on error — returns typed outcome', async () => {
      const mockAuthApi = mockTransport.getAuthApi();
      (mockAuthApi.refreshToken as jest.Mock).mockRejectedValue(
        new Error('Unexpected error'),
      );

      const result = await module.refreshAccessToken();

      expect(result.ok).toBe(false);
    });
  });

  describe('resendVerificationEmail', () => {
    it('returns ok:true with message on success', async () => {
      const mockAxios = { post: jest.fn() };
      mockTransport.getAuthAxios.mockReturnValue(
        mockAxios as unknown as ReturnType<typeof mockTransport.getAuthAxios>,
      );

      mockAxios.post.mockResolvedValue({
        data: { message: 'Verification email resent' },
      });

      const result = await module.resendVerificationEmail('test@example.com');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.message).toContain('resent');
      }
      expect(mockAxios.post).toHaveBeenCalledWith('/auth/verify/resend', {
        email: 'test@example.com',
      });
    });

    it('returns ok:false with error on failure', async () => {
      const mockAxios = { post: jest.fn() };
      mockTransport.getAuthAxios.mockReturnValue(
        mockAxios as unknown as ReturnType<typeof mockTransport.getAuthAxios>,
      );

      mockAxios.post.mockRejectedValue(new Error('Request failed'));

      const result = await module.resendVerificationEmail('test@example.com');

      expect(result.ok).toBe(false);
    });
  });

  describe('requestPasswordReset', () => {
    it('returns ok:true with response data on success', async () => {
      const mockAuthApi = mockTransport.getAuthApi();
      (mockAuthApi.resetPassword as jest.Mock).mockResolvedValue({
        data: { message: 'Reset email sent', status: 200 },
      });

      const result = await module.requestPasswordReset({
        email: 'test@example.com',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.message).toContain('Reset email sent');
      }
    });

    it('returns ok:false with error on failure', async () => {
      const mockAuthApi = mockTransport.getAuthApi();
      (mockAuthApi.resetPassword as jest.Mock).mockRejectedValue({
        response: {
          data: { message: 'Email not found' },
        },
      });

      const result = await module.requestPasswordReset({
        email: 'nonexistent@example.com',
      });

      expect(result.ok).toBe(false);
    });
  });

  describe('confirmPasswordReset', () => {
    it('returns ok:true on successful reset', async () => {
      const mockAuthApi = mockTransport.getAuthApi();
      (mockAuthApi.confirmResetPassword as jest.Mock).mockResolvedValue({
        data: { message: 'Password reset successfully', status: 200 },
      });

      const result = await module.confirmPasswordReset({
        token: 'reset-token-123',
        password: 'newpassword',
        confirmPassword: 'newpassword',
      });

      expect(result.ok).toBe(true);
    });

    it('passes confirm_password with underscore to API', async () => {
      const mockAuthApi = mockTransport.getAuthApi();
      (mockAuthApi.confirmResetPassword as jest.Mock).mockResolvedValue({
        data: { message: 'Success', status: 200 },
      });

      await module.confirmPasswordReset({
        token: 'reset-token-123',
        password: 'newpassword',
        confirmPassword: 'newpassword',
      });

      expect(mockAuthApi.confirmResetPassword).toHaveBeenCalledWith(
        expect.objectContaining({
          confirmResetPasswordBody: expect.objectContaining({
            confirm_password: 'newpassword',
          }),
        }),
      );
    });

    it('returns ok:false with error on failure', async () => {
      const mockAuthApi = mockTransport.getAuthApi();
      (mockAuthApi.confirmResetPassword as jest.Mock).mockRejectedValue({
        response: {
          data: { message: 'Invalid or expired token' },
        },
      });

      const result = await module.confirmPasswordReset({
        token: 'bad-token',
        password: 'newpassword',
        confirmPassword: 'newpassword',
      });

      expect(result.ok).toBe(false);
    });
  });

  describe('direct access methods', () => {
    it('getAccessToken returns storage value', () => {
      mockStorage.getAccessToken.mockReturnValue('token-123');

      expect(module.getAccessToken()).toBe('token-123');
    });

    it('getCurrentUser returns storage value', () => {
      mockStorage.getCurrentUser.mockReturnValue(mockUser);

      expect(module.getCurrentUser()).toEqual(mockUser);
    });

    it('getAuthAxios returns transport instance', () => {
      const mockAxios = { get: jest.fn() };
      mockTransport.getAuthAxios.mockReturnValue(
        mockAxios as unknown as ReturnType<typeof mockTransport.getAuthAxios>,
      );

      expect(module.getAuthAxios()).toBe(mockAxios);
    });

    it('getAuthApi returns transport api', () => {
      const mockAuthApi = mockTransport.getAuthApi();

      expect(module.getAuthApi()).toBe(mockAuthApi);
    });
  });
});
