import type { FilteredUserInterface } from '@myorganizer/app-api-client';

export type AuthUser = FilteredUserInterface;

export type AuthErrorCode =
  | 'invalid_credentials'
  | 'email_not_verified'
  | 'email_already_registered'
  | 'verification_resent'
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

export type RestoreSessionOutcome =
  | { kind: 'authenticated' }
  | { kind: 'session_cleared' };

export type SignOutOutcome = { kind: 'signed_out' };

export type InboundGuardOutcome =
  | { kind: 'redirect_dashboard' }
  | { kind: 'show_guest' };

export type OutboundGuardOutcome =
  | { kind: 'allow' }
  | { kind: 'redirect_login' };

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
  status: number;
}>;

export type PasswordResetConfirmOutcome = AuthOperationResult<{
  message: string;
  status: number;
}>;
