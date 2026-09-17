import { PlatformTokenHandler } from './PlatformTokenHandler';
import apiTokens from './ApiTokens';
import filterUser from './filterUser';
import type { User } from '../models/User';
import type { FilteredUserInterface } from '../types';

// Redirect @myorganizer/auth to refresh-client-contract only so ts-jest does not
// compile libs/auth/src/lib/auth.ts (unrelated TS errors under backend tsconfig).
jest.mock('@myorganizer/auth', () =>
  jest.requireActual('../../../../libs/auth/src/lib/refresh-client-contract'),
);

jest.mock('./ApiTokens', () => ({
  __esModule: true,
  default: {
    createTokens: jest.fn(),
  },
}));

jest.mock('./filterUser', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockCreateTokens = jest.mocked(apiTokens.createTokens);
const mockFilterUser = jest.mocked(filterUser);

describe('PlatformTokenHandler', () => {
  const mockUser: User = {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
  };

  const filteredUser: FilteredUserInterface = {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'user',
    disabled: false,
  };

  beforeEach(() => {
    mockCreateTokens.mockReset();
    mockFilterUser.mockReset();
    mockFilterUser.mockReturnValue(filteredUser);
  });

  describe('issueLoginSession', () => {
    it('includes refresh_token in the body for mobile clients when refresh token succeeds', () => {
      mockCreateTokens.mockReturnValue({
        token: 'access-token',
        refreshToken: 'refresh-token',
      });

      const session = PlatformTokenHandler.issueLoginSession(
        mockUser,
        'mobile',
      );

      expect(mockCreateTokens).toHaveBeenCalledWith(mockUser);
      expect(mockFilterUser).toHaveBeenCalledWith(mockUser);
      expect(session.body).toEqual({
        token: 'access-token',
        expires_in: 600_000,
        user: filteredUser,
        refresh_token: 'refresh-token',
      });
      expect(session.refreshToken).toBe('refresh-token');
    });

    it('omits refresh_token in the body for web clients', () => {
      mockCreateTokens.mockReturnValue({
        token: 'access-token',
        refreshToken: 'refresh-token',
      });

      const session = PlatformTokenHandler.issueLoginSession(mockUser, 'web');

      expect(session.body).toEqual({
        token: 'access-token',
        expires_in: 600_000,
        user: filteredUser,
      });
      expect(session.body).not.toHaveProperty('refresh_token');
      expect(session.refreshToken).toBe('refresh-token');
    });

    it('defaults to web behavior when clientType is omitted', () => {
      mockCreateTokens.mockReturnValue({
        token: 'access-token',
        refreshToken: 'refresh-token',
      });

      const session = PlatformTokenHandler.issueLoginSession(mockUser);

      expect(session.body).toEqual({
        token: 'access-token',
        expires_in: 600_000,
        user: filteredUser,
      });
      expect(session.body).not.toHaveProperty('refresh_token');
      expect(session.refreshToken).toBe('refresh-token');
    });

    it('throws when access token creation fails', () => {
      mockCreateTokens.mockReturnValue({
        token: new Error('jwt sign failed'),
        refreshToken: 'refresh-token',
      });

      expect(() =>
        PlatformTokenHandler.issueLoginSession(mockUser, 'mobile'),
      ).toThrow('Failed to create auth tokens');
    });

    it('throws when refresh token creation fails', () => {
      mockCreateTokens.mockReturnValue({
        token: 'access-token',
        refreshToken: new Error('refresh sign failed'),
      });

      expect(() =>
        PlatformTokenHandler.issueLoginSession(mockUser, 'mobile'),
      ).toThrow('Failed to create auth tokens');
    });
  });
});
