import {
  buildLoginUserBody,
  buildRefreshTokenRequest,
  extractRefreshTokenFromLoginResponse,
  resolveAuthClientType,
  resolveRefreshTokenAfterRefresh,
  shouldIncludeRefreshTokenInLoginBody,
  shouldSendCredentials,
} from './refresh-client-contract';

describe('refresh-client-contract', () => {
  describe('resolveAuthClientType', () => {
    it('returns mobile when clientType is "mobile"', () => {
      expect(resolveAuthClientType('mobile')).toBe('mobile');
    });

    it('returns web when clientType is "web"', () => {
      expect(resolveAuthClientType('web')).toBe('web');
    });

    it('returns web when clientType is undefined', () => {
      expect(resolveAuthClientType(undefined)).toBe('web');
    });

    it('returns web when clientType is null', () => {
      expect(resolveAuthClientType(null)).toBe('web');
    });

    it('returns web when clientType is an unknown string', () => {
      expect(resolveAuthClientType('desktop')).toBe('web');
    });
  });

  describe('buildLoginUserBody', () => {
    const credentials = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('returns body with client_type: mobile when clientType is mobile', () => {
      const result = buildLoginUserBody(credentials, 'mobile');

      expect(result).toEqual({
        email: 'test@example.com',
        password: 'password123',
        client_type: 'mobile',
      });
    });

    it('returns body without client_type when clientType is web', () => {
      const result = buildLoginUserBody(credentials, 'web');

      expect(result).toEqual({
        email: 'test@example.com',
        password: 'password123',
      });
      expect(result).not.toHaveProperty('client_type');
    });

    it('defaults to web when clientType is not provided', () => {
      const result = buildLoginUserBody(credentials);

      expect(result).toEqual({
        email: 'test@example.com',
        password: 'password123',
      });
      expect(result).not.toHaveProperty('client_type');
    });
  });

  describe('buildRefreshTokenRequest', () => {
    it('returns empty object for web client', () => {
      const result = buildRefreshTokenRequest('web');

      expect(result).toEqual({});
    });

    it('returns object with refresh_token for mobile client with token', () => {
      const result = buildRefreshTokenRequest('mobile', 'token-abc');

      expect(result).toEqual({
        refresh_token: 'token-abc',
      });
    });

    it('throws error when mobile client has no stored refresh token', () => {
      expect(() => buildRefreshTokenRequest('mobile', undefined)).toThrow(
        'No refresh token available',
      );
    });

    it('throws error when mobile client has null refresh token', () => {
      expect(() => buildRefreshTokenRequest('mobile', null)).toThrow(
        'No refresh token available',
      );
    });

    it('throws error when mobile client has empty string refresh token', () => {
      expect(() => buildRefreshTokenRequest('mobile', '')).toThrow(
        'No refresh token available',
      );
    });
  });

  describe('shouldSendCredentials', () => {
    it('returns true for web client', () => {
      expect(shouldSendCredentials('web')).toBe(true);
    });

    it('returns false for mobile client', () => {
      expect(shouldSendCredentials('mobile')).toBe(false);
    });
  });

  describe('shouldIncludeRefreshTokenInLoginBody', () => {
    it('returns true for mobile client', () => {
      expect(shouldIncludeRefreshTokenInLoginBody('mobile')).toBe(true);
    });

    it('returns false for web client', () => {
      expect(shouldIncludeRefreshTokenInLoginBody('web')).toBe(false);
    });
  });

  describe('extractRefreshTokenFromLoginResponse', () => {
    it('returns undefined for web client even if response has refresh_token', () => {
      const response = { refresh_token: 'token-abc' };

      expect(
        extractRefreshTokenFromLoginResponse('web', response),
      ).toBeUndefined();
    });

    it('returns refresh_token from response for mobile client', () => {
      const response = { refresh_token: 'token-xyz' };

      expect(extractRefreshTokenFromLoginResponse('mobile', response)).toBe(
        'token-xyz',
      );
    });

    it('throws error for mobile client when response has no refresh_token', () => {
      const response = {};

      expect(() =>
        extractRefreshTokenFromLoginResponse('mobile', response),
      ).toThrow('Server did not return refresh token');
    });

    it('throws error for mobile client when refresh_token is undefined', () => {
      const response = { refresh_token: undefined };

      expect(() =>
        extractRefreshTokenFromLoginResponse('mobile', response),
      ).toThrow('Server did not return refresh token');
    });

    it('throws error for mobile client when refresh_token is empty string', () => {
      const response = { refresh_token: '' };

      expect(() =>
        extractRefreshTokenFromLoginResponse('mobile', response),
      ).toThrow('Server did not return refresh token');
    });
  });

  describe('resolveRefreshTokenAfterRefresh', () => {
    it('returns null for web client', () => {
      const response = { refresh_token: 'token-abc' };

      expect(resolveRefreshTokenAfterRefresh('web', response)).toBe(null);
    });

    it('returns new refresh_token from response for mobile client', () => {
      const response = { refresh_token: 'new-token-123' };

      expect(
        resolveRefreshTokenAfterRefresh('mobile', response, 'old-token'),
      ).toBe('new-token-123');
    });

    it('falls back to stored token when response has no refresh_token', () => {
      const response = {};

      expect(
        resolveRefreshTokenAfterRefresh('mobile', response, 'stored-token'),
      ).toBe('stored-token');
    });

    it('returns null when both response and stored token are missing', () => {
      const response = {};

      expect(resolveRefreshTokenAfterRefresh('mobile', response)).toBe(null);
    });

    it('returns null when stored token is explicitly null', () => {
      const response = { refresh_token: undefined };

      expect(resolveRefreshTokenAfterRefresh('mobile', response, null)).toBe(
        null,
      );
    });

    it('prefers new token over stored token', () => {
      const response = { refresh_token: 'new-token' };

      expect(
        resolveRefreshTokenAfterRefresh('mobile', response, 'old-token'),
      ).toBe('new-token');
    });
  });
});
