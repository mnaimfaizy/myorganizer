import type {
  RefreshToken200Response,
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

/**
 * A `/auth/refresh` response as this contract reads it.
 *
 * The endpoint returns `{ token, expires_in, user }` and does not rotate the
 * refresh token today, so `refresh_token` is absent in practice. The field
 * stays optional rather than being dropped because ADR 0006 keeps two delivery
 * channels for that token and requires them to stay in sync: a server that
 * began rotating would send the new token here, and
 * `resolveRefreshTokenAfterRefresh` already prefers it over the stored one.
 *
 * Spelling this as a union of the two real shapes is deliberate. Written as a
 * lone optional field it is a weak type, and TypeScript rejects the generated
 * `RefreshToken200Response` for sharing no properties with it — which is
 * precisely what both mobile callers pass. An index signature does not help
 * either: `RefreshToken200Response` is an interface, and interfaces carry no
 * implicit index signature.
 */
export type RefreshTokenResponse =
  | RefreshToken200Response
  | LoginRefreshResponse;

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
  clientType: 'mobile',
  response: LoginRefreshResponse,
): string;
export function extractRefreshTokenFromLoginResponse(
  clientType: AuthClientType,
  response: LoginRefreshResponse,
): string | undefined;
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
  response: RefreshTokenResponse,
  storedRefreshToken?: string | null,
): string | null {
  if (clientType !== 'mobile') {
    return null;
  }

  const rotated =
    'refresh_token' in response ? response.refresh_token : undefined;

  return rotated ?? storedRefreshToken ?? null;
}
