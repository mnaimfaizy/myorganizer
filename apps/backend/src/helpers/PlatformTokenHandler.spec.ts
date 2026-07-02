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
  };

  beforeEach(() => {
    mockCreateTokens.mockReset();
    mockFilterUser.mockReset();
    mockFilterUser.mockReturnValue(filteredUser);
  });

  describe('buildLoginResponse', () => {
    it('includes refresh_token in the body for mobile clients when refresh token succeeds', () => {
      mockCreateTokens.mockReturnValue({
        token: 'access-token',
        refreshToken: 'refresh-token',
      });

      const response = PlatformTokenHandler.buildLoginResponse(
        mockUser,
        'mobile',
      );

      expect(mockCreateTokens).toHaveBeenCalledWith(mockUser);
      expect(mockFilterUser).toHaveBeenCalledWith(mockUser);
      expect(response).toEqual({
        token: 'access-token',
        expires_in: 600_000,
        user: filteredUser,
        refresh_token: 'refresh-token',
      });
    });

    it('omits refresh_token in the body for web clients', () => {
      mockCreateTokens.mockReturnValue({
        token: 'access-token',
        refreshToken: 'refresh-token',
      });

      const response = PlatformTokenHandler.buildLoginResponse(mockUser, 'web');

      expect(response).toEqual({
        token: 'access-token',
        expires_in: 600_000,
        user: filteredUser,
      });
      expect(response).not.toHaveProperty('refresh_token');
    });

    it('defaults to web behavior when clientType is omitted', () => {
      mockCreateTokens.mockReturnValue({
        token: 'access-token',
        refreshToken: 'refresh-token',
      });

      const response = PlatformTokenHandler.buildLoginResponse(mockUser);

      expect(response).toEqual({
        token: 'access-token',
        expires_in: 600_000,
        user: filteredUser,
      });
      expect(response).not.toHaveProperty('refresh_token');
    });

    it('throws when access token creation fails', () => {
      mockCreateTokens.mockReturnValue({
        token: new Error('jwt sign failed'),
        refreshToken: 'refresh-token',
      });

      expect(() =>
        PlatformTokenHandler.buildLoginResponse(mockUser, 'mobile'),
      ).toThrow('Failed to create access token');
    });

    it('omits refresh_token for mobile when refresh token creation fails', () => {
      mockCreateTokens.mockReturnValue({
        token: 'access-token',
        refreshToken: new Error('refresh sign failed'),
      });

      const response = PlatformTokenHandler.buildLoginResponse(
        mockUser,
        'mobile',
      );

      expect(response).toEqual({
        token: 'access-token',
        expires_in: 600_000,
        user: filteredUser,
      });
      expect(response).not.toHaveProperty('refresh_token');
    });
  });
});
