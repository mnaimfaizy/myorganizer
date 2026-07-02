import type {
  RefreshTokenRequest,
  UserLoginBody,
} from '@myorganizer/app-api-client';

/**
 * Client-type contract for web cookie-based refresh vs mobile body refresh-token
 * delivery. See docs/adr/0006-mobile-refresh-token-delivery.md.
 */
export type AuthClientType = 'web' | 'mobile';

export type LoginCredentials = {
  email: string;
  password: string;
};

export type LoginRefreshResponse = {
  refresh_token?: string;
};

export function resolveAuthClientType(
  clientType?: string | null,
): AuthClientType {
  return clientType === 'mobile' ? 'mobile' : 'web';
}

export function buildLoginUserBody(
  credentials: LoginCredentials,
  clientType: AuthClientType = 'web',
): UserLoginBody {
  if (clientType === 'mobile') {
    return {
      email: credentials.email,
      password: credentials.password,
      client_type: 'mobile',
    };
  }

  return {
    email: credentials.email,
    password: credentials.password,
  };
}

export function buildRefreshTokenRequest(
  clientType: AuthClientType,
  storedRefreshToken?: string | null,
): RefreshTokenRequest | undefined {
  if (clientType === 'mobile') {
    if (!storedRefreshToken) {
      throw new Error('No refresh token available');
    }

    return { refresh_token: storedRefreshToken };
  }

  return {};
}

export function shouldSendCredentials(clientType: AuthClientType): boolean {
  return clientType === 'web';
}

export function shouldIncludeRefreshTokenInLoginBody(
  clientType: AuthClientType,
): boolean {
  return clientType === 'mobile';
}

export function extractRefreshTokenFromLoginResponse(
  clientType: AuthClientType,
  response: LoginRefreshResponse,
): string | undefined {
  if (clientType !== 'mobile') {
    return undefined;
  }

  const refreshToken = response.refresh_token;
  if (!refreshToken) {
    throw new Error('Server did not return refresh token');
  }

  return refreshToken;
}

export function resolveRefreshTokenAfterRefresh(
  clientType: AuthClientType,
  response: LoginRefreshResponse,
  storedRefreshToken?: string | null,
): string | null {
  if (clientType !== 'mobile') {
    return null;
  }

  return response.refresh_token ?? storedRefreshToken ?? null;
}
