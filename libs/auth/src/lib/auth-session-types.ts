import type { FilteredUserInterface } from '@myorganiser/app-api-client';

export type AuthUser = FilteredUserInterface;

export type AuthErrorCode =
  | 'invalid_credentials'
  | 'email_not_verified'
  | 'email_already_registered'
  | 'verification_resent'
  | 'account_disabled'
  | 'network_error'
  | 'unknown';

export interface AuthError {
  code: AuthErrorCode;
  message: string;
}

export type AuthOperationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: AuthError };

export type SessionSnapshot =
  | { status: 'authenticated' }
  | { status: 'restorable' }
  | { status: 'guest' };

/**
 * - `session_cleared`: nothing to restore, or the server refused the refresh;
 *   storage is cleared.
 * - `not_restored`: the refresh could not be completed (no response, 5xx, 408,
 *   429). The Restorable Session is kept so a later attempt can restore it.
 */
export type RestoreSessionOutcome =
  | { kind: 'authenticated' }
  | { kind: 'session_cleared' }
  | { kind: 'not_restored' };

export type SignOutOutcome = { kind: 'signed_out' };

/**
 * `restore_unavailable`: the Session is a Restorable Session whose restore could
 * not be completed (`not_restored`). It is not a Guest, so it must not be sent
 * to sign-in; the guard shows the page it can and retries the restore later.
 */
export type InboundGuardOutcome =
  | { kind: 'redirect_dashboard' }
  | { kind: 'show_guest' }
  | { kind: 'restore_unavailable' };

export type OutboundGuardOutcome =
  | { kind: 'allow' }
  | { kind: 'redirect_login' }
  | { kind: 'restore_unavailable' };

export interface AuthSessionData {
  token: string;
  expiresIn: number;
  user: AuthUser;
}

export type SignInOutcome = AuthOperationResult<AuthSessionData>;

export type SignUpOutcome = AuthOperationResult<{
  message: string;
  user?: AuthUser;
}>;

export type ResendVerificationOutcome = AuthOperationResult<{
  message: string;
}>;

export type PasswordResetRequestOutcome = AuthOperationResult<{
  message: string;
}>;

export type PasswordResetConfirmOutcome = AuthOperationResult<{
  message: string;
}>;
