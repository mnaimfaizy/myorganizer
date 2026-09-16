/**
 * Minimal typings for the parts of Google Identity Services (GIS) we use.
 *
 * GIS is loaded as a script from `https://accounts.google.com/gsi/client` in
 * the browser. The provider only uses the token model (no implicit grant,
 * no server-stored refresh tokens).
 */

export interface GisTokenResponse {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

export interface GisTokenClient {
  callback: (resp: GisTokenResponse) => void;
  requestAccessToken(options?: { prompt?: string }): void;
}

/**
 * A non-OAuth failure. GIS delivers these to `error_callback`, never to
 * `callback`: without one registered, a blocked or dismissed popup settles
 * nothing at all.
 */
export interface GisErrorResponse {
  type?: 'popup_failed_to_open' | 'popup_closed' | 'unknown' | string;
  message?: string;
}

export interface GoogleAccountsOauth2 {
  initTokenClient(config: {
    client_id: string;
    scope: string;
    callback: (resp: GisTokenResponse) => void;
    error_callback?: (err: GisErrorResponse) => void;
  }): GisTokenClient;
  revoke(token: string, done?: () => void): void;
}

export interface GoogleAccounts {
  oauth2: GoogleAccountsOauth2;
}

export interface GoogleNamespace {
  accounts: GoogleAccounts;
}

declare global {
  interface Window {
    google?: GoogleNamespace;
  }
}

export {};
